// Supabase-backed CareerEventsRepo. Runs with the service-role client: the
// sync is a trusted server job (cron or an admin-triggered sync), it writes
// the service-only notification ledger, and it inserts notifications for
// other users, which the notifications insert policy only allows as yourself.

import type { SupabaseClient } from '@supabase/supabase-js';
import type { CareerEventsRepo } from './career-events-service';
import type { CareerEvent, EventPreferences, EventSource, LedgerEntry } from './career-events';

const CHUNK = 200;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function createCareerEventsRepo(db: SupabaseClient): CareerEventsRepo {
  return {
    async listActiveSources(sourceId) {
      let q = db.from('event_sources').select('*').eq('is_active', true).order('created_at');
      if (sourceId) q = q.eq('id', sourceId);
      const { data, error } = await q;
      fail('Loading event sources', error);
      return (data ?? []) as EventSource[];
    },

    async upsertEvents(rows) {
      for (const part of chunks(rows)) {
        const { error } = await db.from('career_events').upsert(part, { onConflict: 'source_id,external_id' });
        fail('Saving events', error);
      }
    },

    async recordSourceResult(sourceId, { syncedAt, count, error: syncError }) {
      const patch: Record<string, unknown> = { last_synced_at: syncedAt, last_error: syncError };
      if (count != null) patch.last_event_count = count;
      const { error } = await db.from('event_sources').update(patch).eq('id', sourceId);
      fail('Recording sync result', error);
    },

    async getEventsStartingBetween(from, to) {
      const { data, error } = await db
        .from('career_events')
        .select('*')
        .eq('status', 'active')
        .gt('starts_at', from)
        .lte('starts_at', to);
      fail('Loading upcoming events', error);
      return (data ?? []) as CareerEvent[];
    },

    async getRecentMajorEvents(since, now) {
      const { data, error } = await db
        .from('career_events')
        .select('*')
        .eq('status', 'active')
        .eq('is_major', true)
        .gte('major_marked_at', since)
        .gt('starts_at', now);
      fail('Loading major events', error);
      return (data ?? []) as CareerEvent[];
    },

    async getFavoritesForEvents(eventIds) {
      const out: { user_id: string; event_id: string }[] = [];
      for (const part of chunks(eventIds)) {
        const { data, error } = await db.from('student_event_favorites').select('user_id, event_id').in('event_id', part);
        fail('Loading favorites', error);
        out.push(...(data ?? []));
      }
      return out;
    },

    async getStudentsForScopes({ schoolIds, states, includeAll }) {
      type Row = { user_id: string; school_id: number | null; school_state: string | null };
      const out = new Map<string, Row>();
      const add = (rows: Row[] | null) => rows?.forEach((r) => r.user_id && out.set(r.user_id, r));
      if (includeAll) {
        // Paged: PostgREST caps a response at 1000 rows by default.
        for (let from = 0; ; from += 1000) {
          const { data, error } = await db.from('students').select('user_id, school_id, school_state').range(from, from + 999);
          fail('Loading students', error);
          add(data as Row[]);
          if (!data || data.length < 1000) break;
        }
        return [...out.values()];
      }
      for (const part of chunks(schoolIds)) {
        const { data, error } = await db.from('students').select('user_id, school_id, school_state').in('school_id', part);
        fail('Loading students', error);
        add(data as Row[]);
      }
      for (const part of chunks(states)) {
        const { data, error } = await db.from('students').select('user_id, school_id, school_state').in('school_state', part);
        fail('Loading students', error);
        add(data as Row[]);
      }
      return [...out.values()];
    },

    async getPreferences(userIds) {
      const out: EventPreferences[] = [];
      for (const part of chunks(userIds)) {
        const { data, error } = await db
          .from('career_event_preferences')
          .select('user_id, notify_favorites, notify_major')
          .in('user_id', part);
        fail('Loading preferences', error);
        out.push(...((data ?? []) as EventPreferences[]));
      }
      return out;
    },

    async getLedger(eventIds, kind) {
      const out: LedgerEntry[] = [];
      for (const part of chunks(eventIds)) {
        const { data, error } = await db
          .from('career_event_notifications')
          .select('user_id, event_id, kind')
          .eq('kind', kind)
          .in('event_id', part);
        fail('Loading notification ledger', error);
        out.push(...((data ?? []) as LedgerEntry[]));
      }
      return out;
    },

    async claimLedger(entries) {
      const claimed: LedgerEntry[] = [];
      for (const part of chunks(entries)) {
        // ON CONFLICT DO NOTHING ... RETURNING only returns rows actually inserted.
        const { data, error } = await db
          .from('career_event_notifications')
          .upsert(part, { onConflict: 'user_id,event_id,kind', ignoreDuplicates: true })
          .select('user_id, event_id, kind');
        fail('Claiming notification ledger', error);
        claimed.push(...((data ?? []) as LedgerEntry[]));
      }
      return claimed;
    },

    async insertNotifications(rows) {
      for (const part of chunks(rows)) {
        const { error } = await db.from('notifications').insert(
          part.map((n) => ({ user_id: n.user_id, actor_id: null, type: 'career_event', title: n.title, body: n.body, link: n.link })),
        );
        fail('Inserting notifications', error);
      }
    },
  };
}
