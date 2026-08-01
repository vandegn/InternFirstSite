-- ============================================
-- CUSTOMIZABLE JOB POSTINGS
-- ============================================
-- Gives employers four axes of control over a listing:
--   1. Structured compensation + free-form role tags
--   2. Extra content sections beyond the core three
--   3. Per-listing branding (banner image + accent color)
--   4. Custom screening questions answered at apply time
--
-- Design notes:
--   * `industry` stays a required 12-value preset. It drives PPJ/PPA pricing
--     (cpaForIndustry), the filter pills, and major-based recommendations, so
--     it is NOT made free-form. `role_tags` is the additive escape hatch.
--   * The legacy `compensation` text column is kept and stays populated with a
--     display string derived from the new structured columns. getActiveListings'
--     paid/unpaid filter keys off the literal string 'Unpaid', so this must
--     keep being written on every create/update.
--   * Child tables mirror the pipeline_stages pattern: per-listing, ordered by
--     an int `position`, RLS scoped through internship_listings -> employers.
--
-- Run this in the Supabase SQL Editor.

-- ============================================
-- 1. NEW COLUMNS ON internship_listings
-- ============================================
alter table internship_listings
  add column if not exists comp_type text
    check (comp_type in ('hourly', 'salary', 'stipend', 'unpaid', 'other')),
  add column if not exists comp_min_cents int,
  add column if not exists comp_max_cents int,
  add column if not exists comp_note text,
  add column if not exists role_tags text[] not null default '{}',
  add column if not exists banner_url text,
  add column if not exists accent_color text
    check (accent_color ~ '^#[0-9a-fA-F]{6}$');

-- ============================================
-- 2. LISTING SECTIONS (extra content blocks)
-- ============================================
-- Job Overview / Qualifications / Key Responsibilities remain columns on
-- internship_listings — they feed the keyword search in getActiveListings.
-- These are additional employer-authored markdown blocks rendered after them.
create table if not exists listing_sections (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  heading text not null,
  body text not null,
  position int not null default 0,
  created_at timestamptz default now() not null
);

create index if not exists idx_listing_sections_listing
  on listing_sections(listing_id, position);

alter table listing_sections enable row level security;

drop policy if exists "Employers manage sections on own listings" on listing_sections;
create policy "Employers manage sections on own listings"
  on listing_sections for all to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  )
  with check (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Sections on active listings are viewable" on listing_sections;
create policy "Sections on active listings are viewable"
  on listing_sections for select to authenticated
  using (
    listing_id in (select id from internship_listings where status = 'active')
  );

-- Matches add_public_listing_access.sql: logged-out visitors can browse
-- active listings, so they must be able to read their sections too.
drop policy if exists "Sections on active listings are publicly viewable" on listing_sections;
create policy "Sections on active listings are publicly viewable"
  on listing_sections for select to anon
  using (
    listing_id in (select id from internship_listings where status = 'active')
  );

-- ============================================
-- 3. LISTING QUESTIONS (custom screening questions)
-- ============================================
-- knockout_answer is only meaningful for question_type = 'yes_no'. When the
-- student's answer matches it, the application is flagged for the employer —
-- it never blocks submission.
create table if not exists listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  prompt text not null,
  help_text text,
  question_type text not null default 'short_text'
    check (question_type in ('short_text', 'long_text', 'single_select', 'multi_select', 'yes_no', 'file')),
  options text[] not null default '{}',
  required boolean not null default false,
  knockout_answer text check (knockout_answer in ('yes', 'no')),
  position int not null default 0,
  created_at timestamptz default now() not null
);

create index if not exists idx_listing_questions_listing
  on listing_questions(listing_id, position);

alter table listing_questions enable row level security;

drop policy if exists "Employers manage questions on own listings" on listing_questions;
create policy "Employers manage questions on own listings"
  on listing_questions for all to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  )
  with check (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Questions on active listings are viewable" on listing_questions;
create policy "Questions on active listings are viewable"
  on listing_questions for select to authenticated
  using (
    listing_id in (select id from internship_listings where status = 'active')
  );

drop policy if exists "Questions on active listings are publicly viewable" on listing_questions;
create policy "Questions on active listings are publicly viewable"
  on listing_questions for select to anon
  using (
    listing_id in (select id from internship_listings where status = 'active')
  );

-- ============================================
-- 4. APPLICATION ANSWERS
-- ============================================
-- One row per (application, question). Which column is populated depends on
-- the question type: answer_text for short/long/yes_no/single_select,
-- answer_options for multi_select, file_url for file uploads.
create table if not exists application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  question_id uuid references listing_questions(id) on delete cascade not null,
  answer_text text,
  answer_options text[] not null default '{}',
  file_url text,
  created_at timestamptz default now() not null,
  unique(application_id, question_id)
);

create index if not exists idx_application_answers_application
  on application_answers(application_id);
create index if not exists idx_application_answers_question
  on application_answers(question_id);

alter table application_answers enable row level security;

-- Students insert and read answers on their own applications. Deliberately no
-- update/delete policy — answers are immutable once submitted.
drop policy if exists "Students insert answers on own applications" on application_answers;
create policy "Students insert answers on own applications"
  on application_answers for insert to authenticated
  with check (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "Students read answers on own applications" on application_answers;
create policy "Students read answers on own applications"
  on application_answers for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

drop policy if exists "Employers read answers on their listings" on application_answers;
create policy "Employers read answers on their listings"
  on application_answers for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ============================================
-- 5. KNOCKOUT FLAG
-- ============================================
alter table applications
  add column if not exists flagged_knockout boolean not null default false;

-- Set server-side rather than by the client, so a student cannot submit a
-- disqualifying answer with the flag suppressed.
create or replace function flag_knockout_answer()
returns trigger as $$
declare
  ko text;
  qtype text;
begin
  select knockout_answer, question_type into ko, qtype
    from listing_questions where id = new.question_id;

  if qtype = 'yes_no' and ko is not null and lower(new.answer_text) = ko then
    update applications set flagged_knockout = true where id = new.application_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_flag_knockout_answer on application_answers;
create trigger trg_flag_knockout_answer
  after insert on application_answers
  for each row execute function flag_knockout_answer();
