// Supabase-backed FeedDiscoveryRepo. Runs with the service-role client: the
// finder reads every student's school + email domain, which no single user's
// RLS allows, and it is a trusted server job (cron or an admin-triggered run).

import type { SupabaseClient } from '@supabase/supabase-js';
import type { FeedDiscoveryRepo } from './feed-discovery-service';
import type { StudentSchoolRow } from './feed-discovery';

const CHUNK = 200;

function chunks<T>(items: T[], size = CHUNK): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

function fail(context: string, error: { message: string } | null): void {
  if (error) throw new Error(`${context}: ${error.message}`);
}

export function createFeedDiscoveryRepo(db: SupabaseClient): FeedDiscoveryRepo {
  return {
    async listStudentSchools() {
      type Student = { user_id: string; school_id: number; school_name: string | null; school_state: string | null };
      const students: Student[] = [];
      // Paged: PostgREST caps a response at 1000 rows by default.
      for (let from = 0; ; from += 1000) {
        const { data, error } = await db
          .from('students')
          .select('user_id, school_id, school_name, school_state')
          .not('school_id', 'is', null)
          .range(from, from + 999);
        fail('Loading students', error);
        students.push(...((data ?? []) as Student[]));
        if (!data || data.length < 1000) break;
      }
      const emails = new Map<string, string>();
      for (const part of chunks(students.map((s) => s.user_id))) {
        const { data, error } = await db.from('profiles').select('user_id, email').in('user_id', part);
        fail('Loading student emails', error);
        for (const p of data ?? []) emails.set(p.user_id, p.email);
      }
      return students.map((s): StudentSchoolRow => ({
        school_id: s.school_id, school_name: s.school_name, school_state: s.school_state, email: emails.get(s.user_id) ?? null,
      }));
    },

    async listChecks() {
      const { data, error } = await db.from('feed_discovery_checks').select('school_id, checked_at');
      fail('Loading discovery checks', error);
      return data ?? [];
    },

    async listSourceUrls() {
      const { data, error } = await db.from('event_sources').select('ical_url');
      fail('Loading event sources', error);
      return (data ?? []).map((r) => r.ical_url as string);
    },

    async getCandidateUrls(urls) {
      const out: string[] = [];
      for (const part of chunks(urls)) {
        const { data, error } = await db.from('feed_candidates').select('ical_url').in('ical_url', part);
        fail('Loading feed suggestions', error);
        out.push(...(data ?? []).map((r) => r.ical_url as string));
      }
      return out;
    },

    async insertCandidates(rows) {
      // Two schools can share a feed (a system-wide calendar); first one wins.
      const { error } = await db.from('feed_candidates').upsert(rows, { onConflict: 'ical_url', ignoreDuplicates: true });
      fail('Saving feed suggestions', error);
    },

    async refreshCandidates(rows) {
      for (const r of rows) {
        const { error } = await db
          .from('feed_candidates')
          .update({
            calendar_name: r.calendar_name,
            timezone: r.timezone,
            upcoming_count: r.upcoming_count,
            career_count: r.career_count,
            sample_titles: r.sample_titles,
            last_checked_at: r.last_checked_at,
          })
          .eq('ical_url', r.ical_url);
        fail('Refreshing feed suggestion', error);
      }
    },

    async recordCheck(check) {
      const { error } = await db.from('feed_discovery_checks').upsert(check, { onConflict: 'school_id' });
      fail('Recording discovery check', error);
    },
  };
}
