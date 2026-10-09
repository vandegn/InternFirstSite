import { describe, expect, it } from 'vitest';
import { runCareerEventsSync, type CareerEventsRepo } from './career-events-service';
import { ledgerKey, type CareerEvent, type EventPreferences, type EventSource, type LedgerEntry, type PlannedNotification } from './career-events';

// In-memory CareerEventsRepo — mirrors the Postgres behaviour the real repo
// relies on: unique (source_id, external_id) upserts that leave is_major alone,
// the career-fair-starts-major insert trigger, and ON CONFLICT DO NOTHING ledger
// claims.
function memoryRepo(init: { sources: EventSource[]; students?: { user_id: string; school_id: number | null; school_state: string | null }[] }) {
  const state = {
    sources: init.sources,
    events: [] as CareerEvent[],
    favorites: [] as { user_id: string; event_id: string }[],
    preferences: [] as EventPreferences[],
    ledger: [] as LedgerEntry[],
    notifications: [] as PlannedNotification[],
    students: init.students ?? [],
  };
  let seq = 0;
  const clock = { now: '2026-10-09T12:00:00.000Z' };

  const repo: CareerEventsRepo = {
    async listActiveSources(id) { return state.sources.filter((s) => s.is_active && (!id || s.id === id)); },
    async upsertEvents(rows) {
      for (const row of rows) {
        const existing = state.events.find((e) => e.source_id === row.source_id && e.external_id === row.external_id);
        if (existing) Object.assign(existing, row);
        else {
          const major = row.origin === 'ical' && row.category === 'career_fair';
          state.events.push({ ...row, id: `ev${++seq}`, is_major: major, major_marked_at: major ? clock.now : null, created_at: clock.now });
        }
      }
    },
    async recordSourceResult(id, r) {
      const s = state.sources.find((x) => x.id === id)!;
      s.last_synced_at = r.syncedAt; s.last_error = r.error;
      if (r.count != null) s.last_event_count = r.count;
    },
    async getEventsStartingBetween(from, to) { return state.events.filter((e) => e.status === 'active' && e.starts_at > from && e.starts_at <= to); },
    async getRecentMajorEvents(since, now) {
      return state.events.filter((e) => e.status === 'active' && e.is_major && (e.major_marked_at ?? '') >= since && e.starts_at > now);
    },
    async getFavoritesForEvents(ids) { return state.favorites.filter((f) => ids.includes(f.event_id)); },
    async getStudentsForScopes({ schoolIds, states, includeAll }) {
      return state.students.filter((s) => includeAll || (s.school_id != null && schoolIds.includes(s.school_id)) || (s.school_state != null && states.includes(s.school_state)));
    },
    async getPreferences(ids) { return state.preferences.filter((p) => ids.includes(p.user_id)); },
    async getLedger(ids, kind) { return state.ledger.filter((l) => l.kind === kind && ids.includes(l.event_id)); },
    async claimLedger(entries) {
      const have = new Set(state.ledger.map(ledgerKey));
      const claimed = entries.filter((e) => !have.has(ledgerKey(e)) && have.add(ledgerKey(e)));
      state.ledger.push(...claimed);
      return claimed;
    },
    async insertNotifications(rows) { state.notifications.push(...rows); },
  };
  return { repo, state, clock };
}

function source(partial: Partial<EventSource>): EventSource {
  return {
    id: 'src', name: 'Source', ical_url: 'https://events.unc.edu/calendar.ics',
    school_id: 199120, school_name: 'UNC', city: null, state: 'North Carolina',
    default_category: 'other', default_timezone: 'America/New_York', include_keywords: null,
    is_active: true, last_synced_at: null, last_error: null, last_event_count: null,
    ...partial,
  };
}

const ICS = (body: string) => `BEGIN:VCALENDAR\r\nVERSION:2.0\r\n${body}\r\nEND:VCALENDAR`;
const FAIR = 'BEGIN:VEVENT\r\nUID:fair\r\nDTSTART:20261010T110000Z\r\nSUMMARY:Fall Career Fair\r\nEND:VEVENT';
const TALK = 'BEGIN:VEVENT\r\nUID:talk\r\nDTSTART:20261020T180000Z\r\nSUMMARY:Info Session: Acme\r\nEND:VEVENT';

describe('career events sync flow', () => {
  it('syncs feeds, isolates a failing source, and is idempotent on re-run', async () => {
    const { repo, state } = memoryRepo({
      sources: [
        source({ id: 'good', ical_url: 'https://events.unc.edu/a.ics' }),
        source({ id: 'broken', ical_url: 'https://events.unc.edu/b.ics' }),
        source({ id: 'private', ical_url: 'http://localhost/c.ics' }),
        source({ id: 'off', is_active: false }),
      ],
    });
    const fetched: string[] = [];
    const fetchFeed = async (url: string) => {
      fetched.push(url);
      if (url.endsWith('b.ics')) throw new Error('Feed returned HTTP 500');
      return ICS(`${FAIR}\r\n${TALK}`);
    };
    const now = new Date('2026-10-09T12:00:00Z');

    const first = await runCareerEventsSync(repo, fetchFeed, now);
    expect(first.sources.map((s) => [s.sourceId, s.ok, s.count])).toEqual([['good', true, 2], ['broken', false, 0], ['private', false, 0]]);
    expect(fetched).toEqual(['https://events.unc.edu/a.ics', 'https://events.unc.edu/b.ics']); // never fetched localhost
    expect(state.sources.find((s) => s.id === 'broken')!.last_error).toBe('Feed returned HTTP 500');
    expect(state.sources.find((s) => s.id === 'good')!.last_event_count).toBe(2);
    expect(state.events).toHaveLength(2);

    await runCareerEventsSync(repo, fetchFeed, now);
    expect(state.events).toHaveLength(2);
  });

  it('sends favorite reminders and major-event notifications exactly once', async () => {
    const { repo, state } = memoryRepo({
      sources: [source({ id: 'unc' })],
      students: [
        { user_id: 'campus', school_id: 199120, school_state: 'North Carolina' },
        { user_id: 'other-school', school_id: 198419, school_state: 'North Carolina' },
      ],
    });
    const fetchFeed = async () => ICS(`${FAIR}\r\n${TALK}`);
    const now = new Date('2026-10-09T12:00:00Z');

    // First run imports; the fair is auto-major and campus-scoped.
    const first = await runCareerEventsSync(repo, fetchFeed, now);
    expect(first.majorNotifications).toBe(1);
    expect(state.notifications.map((n) => [n.user_id, n.kind, n.title])).toEqual([['campus', 'major', 'New major event: Fall Career Fair']]);

    // The student favorites both events; the next hourly run sends one reminder (fair is <24h out).
    const fair = state.events.find((e) => e.external_id === 'fair')!;
    const talk = state.events.find((e) => e.external_id === 'talk')!;
    state.favorites.push({ user_id: 'campus', event_id: fair.id }, { user_id: 'campus', event_id: talk.id });
    const second = await runCareerEventsSync(repo, fetchFeed, new Date('2026-10-09T13:00:00Z'));
    expect(second).toMatchObject({ reminders: 1, majorNotifications: 0 });

    // And nothing more on later runs.
    const third = await runCareerEventsSync(repo, fetchFeed, new Date('2026-10-09T14:00:00Z'));
    expect(third).toMatchObject({ reminders: 0, majorNotifications: 0 });
    expect(state.notifications.map((n) => `${n.user_id}:${n.kind}:${n.event_id}`)).toEqual([
      `campus:major:${fair.id}`,
      `campus:reminder:${fair.id}`,
    ]);
  });

  it('an admin un-flagging a synced career fair survives re-sync', async () => {
    const { repo, state } = memoryRepo({ sources: [source({})], students: [{ user_id: 's', school_id: 199120, school_state: 'North Carolina' }] });
    const fetchFeed = async () => ICS(FAIR);
    await runCareerEventsSync(repo, fetchFeed, new Date('2026-10-09T12:00:00Z'), { notify: false });
    state.events[0].is_major = false;
    state.events[0].major_marked_at = null;
    const run = await runCareerEventsSync(repo, fetchFeed, new Date('2026-10-09T12:30:00Z'));
    expect(state.events[0].is_major).toBe(false);
    expect(run.majorNotifications).toBe(0);
  });

  it('reports notification failures without losing the sync', async () => {
    const { repo, state } = memoryRepo({ sources: [source({})] });
    repo.getEventsStartingBetween = async () => { throw new Error('db down'); };
    const run = await runCareerEventsSync(repo, async () => ICS(FAIR), new Date('2026-10-09T12:00:00Z'));
    expect(run.sources[0].ok).toBe(true);
    expect(run.notificationError).toBe('db down');
    expect(state.events).toHaveLength(1);
  });
});
