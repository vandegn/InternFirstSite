-- ============================================
-- FIX: listing_questions / application_answers schema collision
-- ============================================
-- 20260801_customizable_listings.sql created these two tables with
-- `create table if not exists`. Both names ALREADY EXISTED in the database
-- from earlier, never-wired-up work, with a different and much smaller shape:
--
--   listing_questions   (id, listing_id, question, position, created_at)
--   application_answers (id, application_id, question_id, question_text,
--                        answer, created_at)
--
-- So the create was silently skipped and the tables kept the old columns.
-- The application code expects prompt / help_text / question_type / options /
-- required / knockout_answer and answer_text / answer_options / file_url,
-- none of which exist. Left as-is this breaks in production:
--   * saving a listing's questions fails (unknown columns)
--   * submitting an application fails (question_text/answer are NOT NULL)
--   * the trigger below references knockout_answer and errors at runtime
--   * getEmployerApplications' select fails and returns [], so the employer
--     applications page silently shows ZERO applicants
--
-- Both tables were verified empty (0 rows) with no foreign keys pointing at
-- them and no code referencing the old columns, so recreating them is safe.
-- The guard below aborts instead of destroying anything if that has changed.
--
-- Run this in the Supabase SQL Editor.

-- ----- Safety guard -----
do $$
declare
  q_count int;
  a_count int;
begin
  select count(*) into q_count from listing_questions;
  select count(*) into a_count from application_answers;

  if q_count > 0 or a_count > 0 then
    raise exception
      'Aborting: listing_questions has % row(s) and application_answers has % row(s). '
      'This migration recreates both tables and would destroy that data. '
      'Migrate the rows by hand first.', q_count, a_count;
  end if;
end $$;

-- ----- Recreate with the shape the application expects -----
-- Dropping the tables also drops their stale policies, indexes, and the
-- knockout trigger; all three are recreated below.
drop table if exists application_answers cascade;
drop table if exists listing_questions cascade;

create table listing_questions (
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

create index idx_listing_questions_listing on listing_questions(listing_id, position);

alter table listing_questions enable row level security;

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

create policy "Questions on active listings are viewable"
  on listing_questions for select to authenticated
  using (listing_id in (select id from internship_listings where status = 'active'));

create policy "Questions on active listings are publicly viewable"
  on listing_questions for select to anon
  using (listing_id in (select id from internship_listings where status = 'active'));

create table application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  question_id uuid references listing_questions(id) on delete cascade not null,
  answer_text text,
  answer_options text[] not null default '{}',
  file_url text,
  created_at timestamptz default now() not null,
  unique(application_id, question_id)
);

create index idx_application_answers_application on application_answers(application_id);
create index idx_application_answers_question on application_answers(question_id);

alter table application_answers enable row level security;

-- Deliberately no update/delete policy — answers are immutable once submitted.
create policy "Students insert answers on own applications"
  on application_answers for insert to authenticated
  with check (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

create policy "Students read answers on own applications"
  on application_answers for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

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

-- ----- Reattach the knockout trigger -----
-- The function already exists; the trigger went away with the dropped table.
create trigger trg_flag_knockout_answer
  after insert on application_answers
  for each row execute function flag_knockout_answer();
