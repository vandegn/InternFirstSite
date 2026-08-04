-- ============================================
-- OFFERS
-- ============================================
-- Moving a candidate into an "Offered" column is the one board move the
-- student experiences as a life event, so it stops being a bare stage change
-- and becomes a record: who was offered what, the offer letter, and whether
-- they accepted. The employer confirms twice on the board before this row
-- exists (see the pipeline's ExtendOfferModal).
--
-- Shaped like interview_schedules — the platform's other two-sided commitment —
-- so the same habits apply: a status the student moves, a partial unique index
-- keeping one live row per application, and notifications on both sides.
--
-- The offer letter is applicant-facing PII and lives in the private
-- `applicant-docs` bucket under offer-letters/<applicationId>/, read only
-- through GET /api/files/offer/[id]. It is optional: plenty of offers are made
-- verbally first and the letter follows.
--
-- Employer-side access resolves through acting_employer_ids() rather than
-- employers.user_id, matching every other employer policy after
-- 20260803_employer_team.sql: an invited recruiter extends offers for their
-- company, and a deactivated member stops being able to immediately.
--
-- Run this in the Supabase SQL Editor, after 20260803_employer_team.sql.

create table if not exists offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  status text not null default 'extended'
    check (status in ('extended', 'accepted', 'declined', 'withdrawn')),
  storage_path text,          -- offer letter PDF in `applicant-docs`, optional
  note text,                  -- what the employer wants the student to read first
  extended_at timestamptz default now() not null,
  responded_at timestamptz
);

create index if not exists idx_offers_application on offers(application_id);
create index if not exists idx_offers_student on offers(student_id, status);
create index if not exists idx_offers_employer on offers(employer_id, status);

-- One live offer per application. Withdrawn and declined rows stay as history,
-- so an employer who withdraws can extend a fresh offer. Mirrors the partial
-- index on interview_availability_requests.
create unique index if not exists idx_offers_one_live
  on offers(application_id)
  where status in ('extended', 'accepted');

alter table offers enable row level security;

-- ----- Employers own the offers they extend -----
drop policy if exists "Employers manage offers on own listings" on offers;
create policy "Employers manage offers on own listings"
  on offers for all to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select il.id from internship_listings il
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    is_approved_employer(auth.uid())
    and listing_id in (
      select il.id from internship_listings il
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- Students read their own offers -----
drop policy if exists "Students view own offers" on offers;
create policy "Students view own offers"
  on offers for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- ----- Students accept or decline, and nothing else -----
-- The with check pins the reachable statuses: a student cannot withdraw an
-- offer, re-extend one, or reassign the row to another application.
drop policy if exists "Students respond to own offers" on offers;
create policy "Students respond to own offers"
  on offers for update to authenticated
  using (student_id in (select id from students where user_id = auth.uid()))
  with check (
    student_id in (select id from students where user_id = auth.uid())
    and status in ('accepted', 'declined')
  );

-- ----- Employers upload the letter into the private bucket -----
-- The student-side policy from 20260803_private_applicant_docs.sql covers
-- folders the student owns; an offer letter is written by the employer, so it
-- needs its own INSERT policy, scoped to applications on their own listings.
-- Still no SELECT policy anywhere on this bucket: /api/files is the only read
-- path.
drop policy if exists "Employers upload offer letters" on storage.objects;
create policy "Employers upload offer letters"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-docs'
    and (storage.foldername(name))[1] = 'offer-letters'
    and (storage.foldername(name))[2] in (
      select a.id::text from applications a
      join internship_listings il on il.id = a.listing_id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- The bell needs a name for this -----
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('message', 'application_status', 'new_application', 'interview', 'offer'));
