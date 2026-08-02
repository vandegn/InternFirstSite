-- ============================================
-- EEO at apply time
-- ============================================
--
-- Two changes, both driven by the same requirement: every application now
-- carries its own equal-opportunity answers instead of a pointer to whatever
-- the student's settings happen to say today.
--
--  1. application_eeo -- a snapshot of the standard federal self-ID answers as
--     they stood when the application was submitted. student_eeo remains the
--     student's editable default that prefills the form; this table is the
--     immutable record of what they actually submitted for this role.
--
--  2. listing_questions.is_eeo -- lets an employer add their own equal
--     opportunity questions to a listing on top of the standard set. The
--     standard set is defined in app/src/lib/eeo.ts and is not stored here,
--     which is exactly why it cannot be removed or edited by an employer.

-- ============================================
-- 1. Per-application EEO snapshot
-- ============================================
-- Mirrors student_eeo's columns and constraints. Like student_eeo, this has
-- NO employer select policy and must not gain one: these answers are collected
-- for compliance reporting and are never an input to a hiring decision.

create table if not exists application_eeo (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  ethnicity_hispanic_latino text check (ethnicity_hispanic_latino in ('yes', 'no', 'declined')),
  race text[] not null default '{}',
  race_declined boolean not null default false,
  gender text check (gender in ('male', 'female', 'non_binary', 'self_describe', 'declined')),
  gender_self_describe text,
  veteran_status text check (veteran_status in ('protected_veteran', 'not_veteran', 'declined')),
  disability_status text check (disability_status in ('yes', 'no', 'declined')),
  work_authorized_us text check (work_authorized_us in ('yes', 'no')),
  requires_sponsorship text check (requires_sponsorship in ('yes', 'no')),
  -- The student ticked the acknowledgement box rather than the form being
  -- silently submitted on their behalf. Voluntariness has to be auditable.
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_application_eeo_application on application_eeo(application_id);

alter table application_eeo enable row level security;

create policy "Students can view own application EEO"
  on application_eeo for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join students s on s.id = a.student_id
      where s.user_id = auth.uid()
    )
  );

create policy "Students can insert own application EEO"
  on application_eeo for insert to authenticated
  with check (
    application_id in (
      select a.id from applications a
      join students s on s.id = a.student_id
      where s.user_id = auth.uid()
    )
  );

-- Deliberately no update or delete policy, and deliberately no employer policy.

-- ============================================
-- 2. Employer-added EEO questions on a listing
-- ============================================
-- The standard set always renders and is never stored as rows, so "can't
-- remove any" is structural rather than a rule the UI has to remember to
-- enforce. Anything flagged is_eeo here is additive.

alter table listing_questions
  add column if not exists is_eeo boolean not null default false;

create index if not exists idx_listing_questions_eeo
  on listing_questions(listing_id, is_eeo);
