// Browser-side data access for career events. Kept out of lib/supabase.ts so
// the feature stays self-contained; everything here runs through the user's
// RLS-scoped session (students read events + manage own favorites/preferences,
// admins manage sources and events).

import { supabase } from '@/lib/supabase';
import {
  normalizeFeedUrl,
  type CareerEvent,
  type EventCategory,
  type EventPreferences,
  type EventSource,
} from '@/lib/career-events';

export type { CareerEvent, EventSource };

function check(error: { message: string } | null, fallback: string): void {
  if (error) throw new Error(error.message || fallback);
}

// ----- Student -----

/** Active events that haven't ended yet (relevance is applied by the caller). */
export async function getUpcomingCareerEvents(now = new Date()): Promise<CareerEvent[]> {
  const since = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await supabase
    .from('career_events')
    .select('*')
    .eq('status', 'active')
    .gte('starts_at', since)
    .order('starts_at')
    .limit(1000);
  check(error, 'Could not load events.');
  return (data ?? []) as CareerEvent[];
}

export async function getEventFavoriteIds(userId: string): Promise<string[]> {
  const { data, error } = await supabase.from('student_event_favorites').select('event_id').eq('user_id', userId);
  check(error, 'Could not load favorites.');
  return (data ?? []).map((r: { event_id: string }) => r.event_id);
}

export async function setEventFavorite(userId: string, eventId: string, favorite: boolean): Promise<void> {
  if (favorite) {
    const { error } = await supabase
      .from('student_event_favorites')
      .upsert({ user_id: userId, event_id: eventId }, { onConflict: 'user_id,event_id', ignoreDuplicates: true });
    check(error, 'Could not save favorite.');
  } else {
    const { error } = await supabase.from('student_event_favorites').delete().eq('user_id', userId).eq('event_id', eventId);
    check(error, 'Could not remove favorite.');
  }
}

export async function getEventPreferences(userId: string): Promise<EventPreferences> {
  const { data } = await supabase
    .from('career_event_preferences')
    .select('user_id, notify_favorites, notify_major')
    .eq('user_id', userId)
    .maybeSingle();
  return (data as EventPreferences | null) ?? { user_id: userId, notify_favorites: true, notify_major: true };
}

export async function saveEventPreferences(prefs: EventPreferences): Promise<void> {
  const { error } = await supabase
    .from('career_event_preferences')
    .upsert({ ...prefs, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  check(error, 'Could not save notification settings.');
}

// ----- Admin: sources -----

export async function listEventSources(): Promise<EventSource[]> {
  const { data, error } = await supabase.from('event_sources').select('*').order('created_at', { ascending: false });
  check(error, 'Could not load sources.');
  return (data ?? []) as EventSource[];
}

export type NewEventSource = {
  name: string;
  ical_url: string;
  school_id: number | null;
  school_name: string | null;
  city: string | null;
  state: string | null;
  default_category: EventCategory;
  default_timezone: string;
  include_keywords: string[] | null;
};

export async function createEventSource(input: NewEventSource): Promise<EventSource> {
  const url = normalizeFeedUrl(input.ical_url);
  if (!url.ok) throw new Error(url.error);
  if (!input.school_id && !input.state) throw new Error('Tag the feed to a school or a state.');
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('event_sources')
    .insert({ ...input, ical_url: url.url, created_by: user?.id ?? null })
    .select('*')
    .single();
  if (error?.code === '23505') throw new Error('That feed URL is already registered.');
  check(error, 'Could not add source.');
  return data as EventSource;
}

export async function setEventSourceActive(id: string, isActive: boolean): Promise<void> {
  const { error } = await supabase.from('event_sources').update({ is_active: isActive }).eq('id', id);
  check(error, 'Could not update source.');
}

/** Deleting a source also deletes the events it imported (FK cascade). */
export async function deleteEventSource(id: string): Promise<void> {
  const { error } = await supabase.from('event_sources').delete().eq('id', id);
  check(error, 'Could not remove source.');
}

export type SyncResponse = {
  sources: { sourceId: string; name: string; ok: boolean; count: number; error?: string }[];
  reminders: number;
  majorNotifications: number;
  notificationError?: string;
};

export async function triggerCareerEventsSync(sourceId?: string): Promise<SyncResponse> {
  const res = await fetch('/api/career-events/sync', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(sourceId ? { sourceId } : {}),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error || `Sync failed (HTTP ${res.status}).`);
  return body as SyncResponse;
}

// ----- Admin: events -----

export async function listAdminEvents(includePast = false): Promise<CareerEvent[]> {
  let q = supabase.from('career_events').select('*').order('starts_at').limit(1000);
  if (!includePast) q = q.gte('starts_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());
  const { data, error } = await q;
  check(error, 'Could not load events.');
  return (data ?? []) as CareerEvent[];
}

export type EventInput = Pick<
  CareerEvent,
  'title' | 'description' | 'starts_at' | 'ends_at' | 'all_day' | 'timezone' | 'location' | 'virtual_url' | 'url' |
  'organizer' | 'category' | 'school_id' | 'school_name' | 'city' | 'state' | 'is_major' | 'status'
>;

export async function createCareerEvent(input: EventInput): Promise<CareerEvent> {
  const { data: { user } } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('career_events')
    .insert({ ...input, origin: 'manual', created_by: user?.id ?? null })
    .select('*')
    .single();
  check(error, 'Could not create event.');
  return data as CareerEvent;
}

export async function updateCareerEvent(id: string, patch: Partial<EventInput>): Promise<CareerEvent> {
  const { data, error } = await supabase.from('career_events').update(patch).eq('id', id).select('*').single();
  check(error, 'Could not update event.');
  return data as CareerEvent;
}

export async function deleteCareerEvent(id: string): Promise<void> {
  const { error } = await supabase.from('career_events').delete().eq('id', id);
  check(error, 'Could not delete event.');
}
