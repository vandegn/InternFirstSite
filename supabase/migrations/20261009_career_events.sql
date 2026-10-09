-- ============================================
-- CAREER EVENTS — auto-updating campus + local events calendar
-- ============================================
-- Students see career events from their own campus and from their school's
-- state, plus online events open to everyone. Events arrive two ways:
--
--   * iCal feeds registered by an admin in `event_sources` (Localist, Presence,
--     CampusGroups, Engage and most campus calendars publish .ics). The sync
--     route /api/career-events/sync pulls every active feed and upserts by
--     (source_id, external_id), so re-running it is idempotent.
--   * Manual entry by an admin on /dashboard/admin/events.
--
-- Location model: schools in us-schools.json carry a state but no city or
-- coordinates, so "around the student" means the school's state. A source is
-- tagged either to one school (campus events) or to a city/state region (local
-- events); its events inherit that tag.
--
-- Notifications (favorite reminders ~24h out, new major events) are written by
-- the same sync/cron path with the service role. `career_event_notifications`
-- is the dedupe ledger: one row per (user, event, kind), so nobody is notified
-- twice no matter how often the cron runs.
--
-- Run this in the Supabase SQL Editor. Then (optionally) schedule the hourly
-- sync with 20261009_career_events_cron.sql.

-- ----- Sources: registered iCal feeds -----
create table if not exists event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  ical_url text not null check (ical_url ~* '^https?://'),
  -- Campus feed: tagged to one school (same ids as students.school_id).
  school_id integer,
  school_name text,
  -- Region feed (or the campus's state): full state name, like students.school_state.
  city text,
  state text,
  default_category text not null default 'other'
    check (default_category in ('career_fair', 'info_session', 'workshop', 'networking', 'employer_event', 'other')),
  -- IANA zone used for "floating" iCal times that carry no TZID or Z suffix.
  default_timezone text not null default 'America/New_York',
  -- Optional allow-list: when set, only events whose title/description/
  -- categories contain one of these words are imported. Lets a general campus
  -- feed be narrowed to career events ({career, internship, employer, ...}).
  include_keywords text[],
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  last_event_count integer,
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ical_url),
  -- A source must say where its events are, or nobody would ever see them.
  check (school_id is not null or state is not null)
);

-- ----- Events -----
create table if not exists career_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references event_sources(id) on delete cascade,
  -- UID (+ RECURRENCE-ID) from the feed; null for manual events.
  external_id text,
  origin text not null default 'manual' check (origin in ('ical', 'manual')),
  title text not null check (length(trim(title)) > 0),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  timezone text,
  location text,
  virtual_url text,
  url text,
  organizer text,
  category text not null default 'other'
    check (category in ('career_fair', 'info_session', 'workshop', 'networking', 'employer_event', 'other')),
  -- Where the event is relevant. school_id set = campus event for that school;
  -- school_id null + state set = local event; both null = online/national.
  school_id integer,
  school_name text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  is_major boolean not null default false,
  -- When is_major last flipped to true; the "new major event" notification
  -- window keys off this, so promoting an old event still notifies.
  major_marked_at timestamptz,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_career_events_starts on career_events(starts_at) where status = 'active';
create index if not exists idx_career_events_school on career_events(school_id, starts_at);
create index if not exists idx_career_events_state on career_events(state, starts_at);
create index if not exists idx_career_events_major on career_events(major_marked_at) where is_major;

create or replace function career_events_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- Career fairs from feeds start out major. INSERT only: on an upsert that
  -- hits an existing row, is_major isn't in the update set, so an admin who
  -- un-flags a fair keeps it un-flagged across re-syncs.
  if tg_op = 'INSERT' and new.origin = 'ical' and new.category = 'career_fair' then
    new.is_major := true;
  end if;
  if new.is_major and (tg_op = 'INSERT' or not coalesce(old.is_major, false)) then
    new.major_marked_at := now();
  elsif not new.is_major then
    new.major_marked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_career_events_touch on career_events;
create trigger trg_career_events_touch
  before insert or update on career_events
  for each row execute function career_events_touch();

-- ----- Favorites -----
create table if not exists student_event_favorites (
  user_id uuid not null references profiles(user_id) on delete cascade,
  event_id uuid not null references career_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_event_favorites_event on student_event_favorites(event_id);

-- ----- Per-student notification switches -----
-- Missing row = both on. Lives here rather than on students because the
-- settings page's notification toggles are not persisted yet.
create table if not exists career_event_preferences (
  user_id uuid primary key references profiles(user_id) on delete cascade,
  notify_favorites boolean not null default true,
  notify_major boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ----- Notification dedupe ledger (service role only) -----
create table if not exists career_event_notifications (
  user_id uuid not null references profiles(user_id) on delete cascade,
  event_id uuid not null references career_events(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'major')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, kind)
);

-- ----- The bell needs a name for this -----
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('message', 'application_status', 'new_application', 'interview', 'offer', 'career_event'));

-- ============================================
-- RLS
-- ============================================
alter table event_sources enable row level security;
alter table career_events enable row level security;
alter table student_event_favorites enable row level security;
alter table career_event_preferences enable row level security;
alter table career_event_notifications enable row level security;

-- Sources: admin only (feed URLs and sync errors are operational detail).
create policy "Admins manage event sources"
  on event_sources for all to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'))
  with check (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'));

-- Events: students read them (relevance is filtered in the app — these are
-- public campus/community events, not private data); admins manage them.
create policy "Students read career events"
  on career_events for select to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'student'));

create policy "Admins manage career events"
  on career_events for all to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'))
  with check (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'));

-- Favorites: each student manages only their own.
create policy "Users read own event favorites"
  on student_event_favorites for select to authenticated
  using (user_id = auth.uid());
create policy "Users add own event favorites"
  on student_event_favorites for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users remove own event favorites"
  on student_event_favorites for delete to authenticated
  using (user_id = auth.uid());

-- Preferences: own row only.
create policy "Users read own event preferences"
  on career_event_preferences for select to authenticated
  using (user_id = auth.uid());
create policy "Users insert own event preferences"
  on career_event_preferences for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users update own event preferences"
  on career_event_preferences for update to authenticated
  using (user_id = auth.uid());

-- Ledger: no policies — only the service role (sync route) touches it.

comment on table career_events is
  'Career events shown on /dashboard/student/events. Synced from event_sources iCal feeds or entered on /dashboard/admin/events.';
comment on table event_sources is
  'Registered iCal feeds pulled by /api/career-events/sync. Tagged to a school (campus) or a city/state (local).';
