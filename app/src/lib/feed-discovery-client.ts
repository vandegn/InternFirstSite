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
  status: 'new' | 'approved' | 'dismissed';
  source_id: string | null;
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

function check(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

export async function listFeedCandidates(): Promise<FeedCandidate[]> {
  const { data, error } = await supabase
    .from('feed_candidates')
    .select('*')
    .eq('status', 'new')
    .order('school_name')
    .order('career_count', { ascending: false });
  check(error, 'Could not load suggested feeds.');
  return (data ?? []) as FeedCandidate[];
}

export async function listDiscoveryChecks(): Promise<DiscoveryCheckRow[]> {
  const { data, error } = await supabase.from('feed_discovery_checks').select('*').order('checked_at', { ascending: false });
  check(error, 'Could not load checked schools.');
  return (data ?? []) as DiscoveryCheckRow[];
}

async function markReviewed(id: string, patch: { status: 'approved' | 'dismissed'; source_id?: string }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('feed_candidates')
    .update({ ...patch, reviewed_by: user?.id ?? null, reviewed_at: new Date().toISOString() })
    .eq('id', id);
  check(error, 'Could not update the suggestion.');
}

/** Creates the event source (tagged to the candidate's school) and marks the suggestion approved. */
export async function approveFeedCandidate(c: FeedCandidate, opts: { careerOnly: boolean }): Promise<EventSource> {
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
  await markReviewed(c.id, { status: 'approved', source_id: source.id });
  return source;
}

export async function dismissFeedCandidate(id: string): Promise<void> {
  await markReviewed(id, { status: 'dismissed' });
}

export async function triggerFeedDiscovery(target?: { schoolId: number; domain: string }): Promise<DiscoverySummary> {
  const res = await fetch('/api/career-events/discover', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(target ?? {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Feed search failed (HTTP ${res.status}).`);
  return body as DiscoverySummary;
}
