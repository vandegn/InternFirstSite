// Browser-side data access for the feed finder (admin only — RLS restricts
// feed_candidates and feed_discovery_checks to intern_first_admin).

import { supabase } from '@/lib/supabase';
import { createEventSource } from '@/lib/career-events-client';
import type { EventSource } from '@/lib/career-events';
import { CAREER_KEYWORDS, candidateSourceName } from '@/lib/feed-discovery';
import type { DiscoverySummary } from '@/lib/feed-discovery-service';

export type FeedCandidate = {
  id: string;
  school_id: number;
  school_name: string;
  school_state: string | null;
  domain: string;
  ical_url: string;
  platform: string;
  found_on: string | null;
  calendar_name: string | null;
  timezone: string | null;
  upcoming_count: number;
  career_count: number;
  sample_titles: string[];
  /** approved = added as a source; dismissed = skipped (see note). */
  status: 'new' | 'approved' | 'dismissed';
  source_id: string | null;
  note: string | null;
  discovered_at: string;
  last_checked_at: string;
};

export type DiscoveryCheckRow = {
  school_id: number;
  school_name: string;
  school_state: string | null;
  domain: string;
  checked_at: string;
  feeds_found: number;
  error: string | null;
};

export type DiscoveryResponse = DiscoverySummary & { eventsImported?: number };

function check(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

/** Every feed the finder has found, newest first. */
export async function listFeedCandidates(): Promise<FeedCandidate[]> {
  const { data, error } = await supabase
    .from('feed_candidates')
    .select('*')
    .order('discovered_at', { ascending: false })
    .limit(200);
  check(error, 'Could not load found feeds.');
  return (data ?? []) as FeedCandidate[];
}

export async function listDiscoveryChecks(): Promise<DiscoveryCheckRow[]> {
  const { data, error } = await supabase.from('feed_discovery_checks').select('*').order('checked_at', { ascending: false });
  check(error, 'Could not load checked schools.');
  return (data ?? []) as DiscoveryCheckRow[];
}

/** "Add anyway" for a feed the finder skipped. */
export async function addSkippedFeed(c: FeedCandidate, opts: { careerOnly: boolean }): Promise<EventSource> {
  const source = await createEventSource({
    name: candidateSourceName(c),
    ical_url: c.ical_url,
    school_id: c.school_id,
    school_name: c.school_name,
    city: null,
    state: c.school_state,
    default_category: 'other',
    default_timezone: c.timezone || 'America/New_York',
    include_keywords: opts.careerOnly ? CAREER_KEYWORDS : null,
  });
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('feed_candidates')
    .update({
      status: 'approved',
      source_id: source.id,
      note: opts.careerOnly ? 'Added by an admin: career-related events only.' : 'Added by an admin: all events.',
      reviewed_by: user?.id ?? null,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', c.id);
  check(error, 'Added the feed, but could not update the log.');
  return source;
}

export async function triggerFeedDiscovery(target?: { schoolId: number; domain: string }): Promise<DiscoveryResponse> {
  const res = await fetch('/api/career-events/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Feed search failed (HTTP ${res.status}).`);
  return body as DiscoveryResponse;
}
