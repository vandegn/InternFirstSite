-- ============================================
-- CAREER EVENTS — automatic feed finder
-- ============================================
-- /api/career-events/discover looks for public iCal feeds at the schools our
-- students attend (domain taken from their .edu email) by trying the
-- addresses the common campus calendar platforms use (Anthology Engage,
-- Localist, Trumba, LiveWhale, The Events Calendar, 25Live) and scanning the
-- school's events pages for .ics links. Every feed that parses and has
-- upcoming events lands here as a *suggestion*. Nothing is synced until an
-- admin approves it on /dashboard/admin/events, which creates the
-- event_sources row.
--
-- Requires 20261009_career_events.sql. Run this in the Supabase SQL Editor,
-- then (optionally) schedule the daily run with 20261117_feed_discovery_cron.sql.

create table if not exists feed_candidates (
  id uuid primary key default gen_random_uuid(),
  school_id integer not null,
  school_name text not null,
  school_state text,
  domain text not null,
  ical_url text not null check (ical_url ~* '^https?://'),
  -- engage | localist | trumba | livewhale | events_calendar | 25live | other
  platform text not null default 'other',
  -- The page the link was found on, or null when the address was guessed.
  found_on text,
  -- X-WR-CALNAME / X-WR-TIMEZONE from the feed when it has them.
  calendar_name text,
  timezone text,
  -- Counted with the same window + keyword filter the sync uses, so
  -- "career_count" is exactly what an approved, career-only source imports.
  upcoming_count integer not null default 0,
  career_count integer not null default 0,
  sample_titles text[] not null default '{}',
  status text not null default 'new' check (status in ('new', 'approved', 'dismissed')),
  source_id uuid references event_sources(id) on delete set null,
  discovered_at timestamptz not null default now(),
  last_checked_at timestamptz not null default now(),
  reviewed_by uuid references profiles(user_id) on delete set null,
  reviewed_at timestamptz,
  unique (ical_url)
);

create index if not exists idx_feed_candidates_status on feed_candidates(status, school_id);

-- One row per school the finder has looked at — including the ones where it
-- found nothing, so they are not re-checked every day and the admin page can
-- say which schools still need a feed added by hand.
create table if not exists feed_discovery_checks (
  school_id integer primary key,
  school_name text not null,
  school_state text,
  domain text not null,
  checked_at timestamptz not null default now(),
  feeds_found integer not null default 0,
  error text
);

alter table feed_candidates enable row level security;
alter table feed_discovery_checks enable row level security;

-- Admin only. The discovery job itself runs with the service role.
create policy "Admins manage feed candidates"
  on feed_candidates for all to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'))
  with check (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'));

create policy "Admins read feed discovery checks"
  on feed_discovery_checks for select to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'));

comment on table feed_candidates is
  'iCal feeds found automatically by /api/career-events/discover. Suggestions only: an admin approves one to create an event_sources row.';
comment on table feed_discovery_checks is
  'Last time the feed finder checked each school, and how many feeds it found.';
