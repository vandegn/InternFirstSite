// ============================================
// CAREER EVENTS — sync + notification flow
// ============================================
// Runs against a narrow repository seam (Supabase implementation in
// career-events-repo.ts, in-memory one in the tests) and an injected feed
// fetcher, so the whole cron path is testable without a network or database.
//
// One run = pull every active iCal source (each isolated: one broken feed
// records its error and the rest carry on), then plan and write notifications.
// Notifications are written ledger-first: the (user, event, kind) row is
// claimed before the notification is inserted, and only rows this run actually
// claimed get a notification — so overlapping runs can never double-notify.

import {
  eventsFromFeed,
  normalizeFeedUrl,
  planFavoriteReminders,
  planMajorEventNotifications,
  REMINDER_WINDOW_MS,
  MAJOR_LOOKBACK_MS,
  ledgerKey,
  type CareerEvent,
  type CareerEventUpsert,
  type EventPreferences,
  type EventSource,
  type LedgerEntry,
  type PlannedNotification,
} from './career-events';

export type CareerEventsRepo = {
  listActiveSources(sourceId?: string): Promise<EventSource[]>;
  upsertEvents(rows: CareerEventUpsert[]): Promise<void>;
  recordSourceResult(sourceId: string, result: { syncedAt: string; count: number | null; error: string | null }): Promise<void>;

  /** Active events starting in (from, to]. */
  getEventsStartingBetween(from: string, to: string): Promise<CareerEvent[]>;
  /** Active, upcoming major events marked major at or after `since`. */
  getRecentMajorEvents(since: string, now: string): Promise<CareerEvent[]>;
  getFavoritesForEvents(eventIds: string[]): Promise<{ user_id: string; event_id: string }[]>;
  /** Students whose school or school state matches; every student when includeAll. */
  getStudentsForScopes(scope: { schoolIds: number[]; states: string[]; includeAll: boolean }): Promise<
    { user_id: string; school_id: number | null; school_state: string | null }[]
  >;
  getPreferences(userIds: string[]): Promise<EventPreferences[]>;
  getLedger(eventIds: string[], kind: LedgerEntry['kind']): Promise<LedgerEntry[]>;
  /** Insert, ignoring ones that already exist; returns only the rows this call created. */
  claimLedger(entries: LedgerEntry[]): Promise<LedgerEntry[]>;
  insertNotifications(rows: PlannedNotification[]): Promise<void>;
};

export type FeedFetcher = (url: string) => Promise<string>;

export type SourceSyncResult = { sourceId: string; name: string; ok: boolean; count: number; error?: string };

export type SyncSummary = {
  sources: SourceSyncResult[];
  reminders: number;
  majorNotifications: number;
};

function message(e: unknown): string {
  const m = e instanceof Error ? e.message : String(e);
  return m.length > 500 ? `${m.slice(0, 497)}...` : m;
}

export async function syncSources(
  repo: CareerEventsRepo,
  fetchFeed: FeedFetcher,
  now: Date,
  sourceId?: string,
): Promise<SourceSyncResult[]> {
  const sources = await repo.listActiveSources(sourceId);
  const results: SourceSyncResult[] = [];
  for (const source of sources) {
    try {
      const safe = normalizeFeedUrl(source.ical_url);
      if (!safe.ok) throw new Error(safe.error);
      const text = await fetchFeed(safe.url);
      const rows = eventsFromFeed(text, source, now);
      if (rows.length > 0) await repo.upsertEvents(rows);
      await repo.recordSourceResult(source.id, { syncedAt: now.toISOString(), count: rows.length, error: null });
      results.push({ sourceId: source.id, name: source.name, ok: true, count: rows.length });
    } catch (e) {
      const error = message(e);
      try {
        await repo.recordSourceResult(source.id, { syncedAt: now.toISOString(), count: null, error });
      } catch {
        // recording the failure must not stop the other sources
      }
      results.push({ sourceId: source.id, name: source.name, ok: false, count: 0, error });
    }
  }
  return results;
}

async function deliver(repo: CareerEventsRepo, planned: PlannedNotification[]): Promise<number> {
  if (planned.length === 0) return 0;
  const claimed = await repo.claimLedger(planned.map(({ user_id, event_id, kind }) => ({ user_id, event_id, kind })));
  const won = new Set(claimed.map(ledgerKey));
  const toSend = planned.filter((p) => won.has(ledgerKey(p)));
  if (toSend.length > 0) await repo.insertNotifications(toSend);
  return toSend.length;
}

export async function sendFavoriteReminders(repo: CareerEventsRepo, now: Date): Promise<number> {
  const events = await repo.getEventsStartingBetween(now.toISOString(), new Date(now.getTime() + REMINDER_WINDOW_MS).toISOString());
  if (events.length === 0) return 0;
  const ids = events.map((e) => e.id);
  const favorites = await repo.getFavoritesForEvents(ids);
  if (favorites.length === 0) return 0;
  const [preferences, ledger] = await Promise.all([
    repo.getPreferences([...new Set(favorites.map((f) => f.user_id))]),
    repo.getLedger(ids, 'reminder'),
  ]);
  return deliver(repo, planFavoriteReminders({ favorites, events, preferences, ledger, now }));
}

export async function sendMajorEventNotifications(repo: CareerEventsRepo, now: Date): Promise<number> {
  const events = await repo.getRecentMajorEvents(new Date(now.getTime() - MAJOR_LOOKBACK_MS).toISOString(), now.toISOString());
  if (events.length === 0) return 0;
  const students = await repo.getStudentsForScopes({
    schoolIds: [...new Set(events.filter((e) => e.school_id != null).map((e) => e.school_id as number))],
    states: [...new Set(events.filter((e) => e.school_id == null && e.state).map((e) => e.state as string))],
    includeAll: events.some((e) => e.school_id == null && !e.state),
  });
  if (students.length === 0) return 0;
  const [preferences, ledger] = await Promise.all([
    repo.getPreferences(students.map((s) => s.user_id)),
    repo.getLedger(events.map((e) => e.id), 'major'),
  ]);
  return deliver(repo, planMajorEventNotifications({ events, students, preferences, ledger, now }));
}

/** The whole cron run. Notification failures are reported, not thrown, so a sync is never lost to them. */
export async function runCareerEventsSync(
  repo: CareerEventsRepo,
  fetchFeed: FeedFetcher,
  now: Date,
  opts: { sourceId?: string; notify?: boolean } = {},
): Promise<SyncSummary & { notificationError?: string }> {
  const sources = await syncSources(repo, fetchFeed, now, opts.sourceId);
  if (opts.notify === false) return { sources, reminders: 0, majorNotifications: 0 };
  try {
    const reminders = await sendFavoriteReminders(repo, now);
    const majorNotifications = await sendMajorEventNotifications(repo, now);
    return { sources, reminders, majorNotifications };
  } catch (e) {
    return { sources, reminders: 0, majorNotifications: 0, notificationError: message(e) };
  }
}

// ----- Real feed fetcher -----

export const MAX_FEED_BYTES = 5 * 1024 * 1024;

export const httpFeedFetcher: FeedFetcher = async (url) => {
  const res = await fetch(url, {
    headers: { Accept: 'text/calendar, text/plain;q=0.9, */*;q=0.5', 'User-Agent': 'InternFirst-EventSync/1.0 (+https://www.intern-first.com)' },
    redirect: 'follow',
    signal: AbortSignal.timeout(15000),
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Feed returned HTTP ${res.status}`);
  const declared = Number(res.headers.get('content-length') ?? 0);
  if (declared > MAX_FEED_BYTES) throw new Error('Feed is larger than 5 MB');
  const text = await res.text();
  if (text.length > MAX_FEED_BYTES) throw new Error('Feed is larger than 5 MB');
  return text;
};
