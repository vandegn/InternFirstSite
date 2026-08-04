-- ============================================================
-- Combined migration bundle - 2026-08-03
-- ============================================================
-- Paste into the Supabase SQL editor and run once, or apply the five source
-- files individually in this exact order. Order matters:
--   employer_team defines acting_employer_ids(), which offers' policies call;
--   offer_inbox_message adds a foreign key to the offers table.
-- Safe to re-run: every statement is idempotent or guarded.
--
-- Contents, in order:
--   1. 20260803_certifications_private_docs.sql
--      Certifications join the private applicant-docs bucket.
--   2. 20260803_employer_team.sql
--      Multi-user employer accounts; defines acting_employer_ids().
--   3. 20260803_manual_pipeline_movement.sql
--      Interviews stop moving pipeline cards.
--   4. 20260803_offers.sql
--      Offers table + RLS. Calls acting_employer_ids(), so it MUST follow the team migration.
--   5. 20260803_offer_inbox_message.sql
--      messages.offer_id, so an offer shows as a card in the inbox. Needs offers.
-- ============================================================



-- ############################################################
-- SOURCE: supabase/migrations/20260803_certifications_private_docs.sql
-- ############################################################

-- ============================================
-- CERTIFICATIONS JOIN THE PRIVATE APPLICANT DOCS
-- ============================================
-- student_certifications shipped hours before 20260803_private_applicant_docs.sql
-- and followed the old convention: the PDF went to the public `images` bucket
-- and the row stored a permanent public URL. A certificate carries the
-- student's name and credential number — the same class of applicant PII as a
-- resume — so it belongs in the private `applicant-docs` bucket behind
-- GET /api/files/certification/[id], on exactly the terms resumes now use.
--
-- No backfill: the table was created the same day and holds no rows whose file
-- lives in `images`. The backfill statement below is a no-op safety net in case
-- one was uploaded between the two migrations.
--
-- Run this in the Supabase SQL Editor, after 20260803_private_applicant_docs.sql.

-- ----- storage_path replaces the public URL -----
alter table student_certifications add column if not exists storage_path text;
alter table student_certifications alter column file_url drop not null;

-- Safety net for anything uploaded under the old public-bucket path.
update student_certifications
set storage_path = substring(file_url from '/storage/v1/object/public/images/(.*)$')
where storage_path is null
  and file_url like '%/storage/v1/object/public/images/%';

-- ----- Let students write into certifications/<studentId>/ -----
-- Recreated rather than altered: the policy from 20260803_private_applicant_docs.sql
-- allowlists the top-level folders, and `certifications` has to join that list.
-- Still no storage SELECT policy — the only read path stays the service-role
-- signed URL that /api/files issues after table RLS clears the caller.
drop policy if exists "Students upload own applicant docs" on storage.objects;
create policy "Students upload own applicant docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-docs'
    and (storage.foldername(name))[1] in ('resumes', 'application-files', 'certifications')
    and (storage.foldername(name))[2] in (
      select id::text from students where user_id = auth.uid()
    )
  );


-- ############################################################
-- SOURCE: supabase/migrations/20260803_employer_team.sql
-- ############################################################

-- ============================================
-- EMPLOYER TEAM — multi-user employer accounts
-- ============================================
--
-- Until now one login *was* the company: employers.user_id is unique and every
-- employer-side RLS policy keys on `employers.user_id = auth.uid()`. This
-- migration introduces employer_members so a Master Admin can invite
-- teammates, and rewrites those policies to be membership-based.
--
-- Decisions locked in with the product owner (2026-08-03):
--   * The user who registered the company becomes its Master Admin (backfilled
--     below; a trigger seeds the row for future signups).
--   * One employer, one role per user. The unique index on user_id enforces
--     it; multi-role and multi-company membership are future work.
--   * Invitations expire after 7 days and can be resent (extends the clock)
--     or revoked before acceptance.
--
-- Role library (from the customization-framework diagram):
--   master_admin, recruiting_lead, recruiter, hiring_manager, interviewer,
--   approver. Fine-grained per-role RLS (e.g. interviewers cannot edit
--   listings) is enforced at the application layer for now; the database
--   grants at membership level. Custom roles, permission bundles, scopes and
--   teams are deliberately NOT modeled yet.
--
-- All writes to employer_members go through the service-role API routes
-- (/api/employer/team/*) so the invariants — last-master-admin guard, invite
-- expiry, email match on acceptance — live in one place
-- (lib/employer-team-service.ts). There are intentionally no INSERT/UPDATE/
-- DELETE policies for authenticated users.

-- ============================================
-- 1. employer_members
-- ============================================
create table if not exists employer_members (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  -- Null until the invite is accepted.
  user_id uuid references profiles(user_id) on delete cascade,
  role text not null check (role in
    ('master_admin', 'recruiting_lead', 'recruiter', 'hiring_manager', 'interviewer', 'approver')),
  status text not null default 'invited' check (status in
    ('invited', 'active', 'deactivated', 'revoked')),
  invited_email text not null,
  invited_name text,
  invited_by uuid references profiles(user_id) on delete set null,
  -- Possession of the token proves the invite email reached its mailbox, so
  -- acceptance additionally requires the accepting account's email to match
  -- invited_email. The token is never exposed through RLS (see the select
  -- policy below); master admins get the join link back from the API.
  invite_token uuid unique default gen_random_uuid(),
  invite_expires_at timestamptz,
  accepted_at timestamptz,
  deactivated_at timestamptz,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- One company account per user, regardless of status. A deactivated member
-- still occupies their seat (reactivation restores it); joining a different
-- company is out of scope until multi-company membership is designed.
create unique index if not exists employer_members_one_account_per_user
  on employer_members (user_id) where user_id is not null;

-- One live invite per email per company; re-inviting means revoking first
-- (or resending, which extends the existing invite).
create unique index if not exists employer_members_one_live_invite
  on employer_members (employer_id, lower(invited_email)) where status = 'invited';

create index if not exists idx_employer_members_employer
  on employer_members (employer_id, status);

create trigger set_employer_members_updated_at
  before update on employer_members
  for each row execute function update_updated_at();

-- ============================================
-- 2. employer_team_events (audit trail)
-- ============================================
-- Insert-only history of every team-administration action: who did what to
-- whom, with the prior and new state. Immutability is structural — there are
-- no UPDATE or DELETE policies on this table for any role, and only the
-- service role (the team API) inserts. Searchable/exportable admin surfaces,
-- retention rules, and the platform-wide audit framework are future work.
create table if not exists employer_team_events (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  actor_user_id uuid references profiles(user_id) on delete set null,
  member_id uuid references employer_members(id) on delete set null,
  action text not null check (action in
    ('invite_sent', 'invite_resent', 'invite_revoked', 'invite_accepted',
     'role_changed', 'member_deactivated', 'member_reactivated')),
  subject_email text not null,
  prior jsonb,
  next jsonb,
  created_at timestamptz default now() not null
);

create index if not exists idx_employer_team_events_employer
  on employer_team_events (employer_id, created_at desc);

-- ============================================
-- 3. Membership helpers
-- ============================================
-- security definer for the same reason as is_approved_employer: these are
-- read inside other tables' policies, so employer_members' own RLS (or a
-- future tightening of it) must not silently turn them into `false`.

-- Every employer this user can act for. Today at most one row, but the setof
-- shape keeps every policy below valid if multi-company membership arrives.
create or replace function acting_employer_ids(uid uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select employer_id from employer_members
  where user_id = uid and status = 'active';
$$;

create or replace function is_employer_master_admin(uid uuid, emp uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employer_members
    where user_id = uid and employer_id = emp
      and status = 'active' and role = 'master_admin'
  );
$$;

-- Redefined from ownership to membership: any active member of an approved
-- company passes the verification gates. Backfill (section 5) guarantees
-- existing owners keep passing.
create or replace function is_approved_employer(uid uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employer_members m
    join employers e on e.id = m.employer_id
    where m.user_id = uid and m.status = 'active'
      and e.verification_status = 'approved'
  );
$$;

-- Same membership pivot for the pending-applicant teaser count.
create or replace function employer_pending_applicant_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(a.id)::int
  from applications a
  join internship_listings il on a.listing_id = il.id
  join employer_members m on il.employer_id = m.employer_id
  where m.user_id = auth.uid() and m.status = 'active';
$$;

-- ============================================
-- 4. RLS on the new tables
-- ============================================
alter table employer_members enable row level security;
alter table employer_team_events enable row level security;

-- Members see their own row; master admins see the whole roster; platform
-- admins see everything. Deliberately NOT roster-wide for regular members:
-- the row carries invite_token, and a non-admin must never be able to read a
-- pending invite's token (the sanitised roster comes from the API instead).
drop policy if exists "Members and master admins can view memberships" on employer_members;
create policy "Members and master admins can view memberships"
  on employer_members for select to authenticated
  using (
    user_id = auth.uid()
    or is_employer_master_admin(auth.uid(), employer_id)
    or is_intern_first_admin(auth.uid())
  );

drop policy if exists "Master admins can view team history" on employer_team_events;
create policy "Master admins can view team history"
  on employer_team_events for select to authenticated
  using (
    is_employer_master_admin(auth.uid(), employer_id)
    or is_intern_first_admin(auth.uid())
  );

-- ============================================
-- 5. Backfill + seed trigger
-- ============================================
-- Every existing company's registering user becomes its active Master Admin.
insert into employer_members (employer_id, user_id, role, status, invited_email, accepted_at, invite_token, invite_expires_at)
select e.id, e.user_id, 'master_admin', 'active', coalesce(p.email, ''), now(), null, null
from employers e
join profiles p on p.user_id = e.user_id
where not exists (select 1 from employer_members m where m.user_id = e.user_id);

-- And the same for companies registered after this migration runs.
create or replace function seed_master_admin_member()
returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into employer_members (employer_id, user_id, role, status, invited_email, accepted_at, invite_token, invite_expires_at)
  select new.id, new.user_id, 'master_admin', 'active', coalesce(p.email, ''), now(), null, null
  from profiles p
  where p.user_id = new.user_id
    and not exists (select 1 from employer_members m where m.user_id = new.user_id);
  return new;
end;
$$;

drop trigger if exists trg_seed_master_admin on employers;
create trigger trg_seed_master_admin
  after insert on employers
  for each row execute function seed_master_admin_member();

-- ============================================
-- 6. Rewrite ownership policies to membership
-- ============================================
-- Every policy below previously resolved "my company" through
-- `employers.user_id = auth.uid()`. They now resolve through active
-- membership, which (thanks to the backfill) is a superset containing the
-- original owner. A deactivated member — including a deactivated original
-- owner — loses all of these immediately, which is the point of deactivation.

-- ----- employers -----
-- The old FOR ALL "manage own record" also carried INSERT (registration) and
-- would have let a deactivated owner keep editing the company. Split it.
drop policy if exists "Employers can manage own record" on employers;

create policy "Users can create own employer record"
  on employers for insert to authenticated
  with check (auth.uid() = user_id);

-- "Employers are viewable by authenticated users" (using true) already covers
-- reads; this narrower one is kept so tightening that policy later cannot
-- lock members out of their own company.
drop policy if exists "Members can view own company" on employers;
create policy "Members can view own company"
  on employers for select to authenticated
  using (auth.uid() = user_id or id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Master admins can update company" on employers;
create policy "Master admins can update company"
  on employers for update to authenticated
  using (is_employer_master_admin(auth.uid(), id))
  with check (is_employer_master_admin(auth.uid(), id));

-- ----- internship_listings -----
drop policy if exists "Employers can view own listings" on internship_listings;
create policy "Employers can view own listings"
  on internship_listings for select to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Approved employers can create listings" on internship_listings;
create policy "Approved employers can create listings"
  on internship_listings for insert to authenticated
  with check (
    is_approved_employer(auth.uid())
    and employer_id in (select acting_employer_ids(auth.uid()))
  );

drop policy if exists "Employers can update own listings" on internship_listings;
create policy "Employers can update own listings"
  on internship_listings for update to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())))
  with check (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Employers can delete own listings" on internship_listings;
create policy "Employers can delete own listings"
  on internship_listings for delete to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())));

-- In case the pre-split FOR ALL policy is still live somewhere.
drop policy if exists "Employers can manage own listings" on internship_listings;

-- ----- listing_views -----
drop policy if exists "Employers can view analytics for their listings" on listing_views;
create policy "Employers can view analytics for their listings"
  on listing_views for select to authenticated
  using (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- applications -----
drop policy if exists "Employers can view applications to their listings" on applications;
create policy "Employers can view applications to their listings"
  on applications for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can update application status" on applications;
create policy "Employers can update application status"
  on applications for update to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can delete applications to their listings" on applications;
create policy "Employers can delete applications to their listings"
  on applications for delete to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- pipeline_stages -----
drop policy if exists "Employers manage stages on own listings" on pipeline_stages;
create policy "Employers manage stages on own listings"
  on pipeline_stages for all to authenticated
  using (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- interview_schedules -----
drop policy if exists "Employers can view own interviews" on interview_schedules;
create policy "Employers can view own interviews"
  on interview_schedules for select to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Employers can create interviews for own listings" on interview_schedules;
create policy "Employers can create interviews for own listings"
  on interview_schedules for insert to authenticated
  with check (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Employers can update own interviews" on interview_schedules;
create policy "Employers can update own interviews"
  on interview_schedules for update to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())));

-- ----- interview_availability_requests / slots -----
drop policy if exists "Employers view own availability requests" on interview_availability_requests;
create policy "Employers view own availability requests"
  on interview_availability_requests for select to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Employers create availability requests" on interview_availability_requests;
create policy "Employers create availability requests"
  on interview_availability_requests for insert to authenticated
  with check (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Employers update own availability requests" on interview_availability_requests;
create policy "Employers update own availability requests"
  on interview_availability_requests for update to authenticated
  using (employer_id in (select acting_employer_ids(auth.uid())))
  with check (employer_id in (select acting_employer_ids(auth.uid())));

drop policy if exists "Both parties view slots on their requests" on interview_availability_slots;
create policy "Both parties view slots on their requests"
  on interview_availability_slots for select to authenticated
  using (
    request_id in (
      select r.id from interview_availability_requests r
      where r.student_id in (select id from students where user_id = auth.uid())
         or r.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- listing_questions / listing_sections -----
drop policy if exists "Employers manage questions on own listings" on listing_questions;
create policy "Employers manage questions on own listings"
  on listing_questions for all to authenticated
  using (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers manage sections on own listings" on listing_sections;
create policy "Employers manage sections on own listings"
  on listing_sections for all to authenticated
  using (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- applicant PII (approval gate preserved on every one) -----
drop policy if exists "Employers read answers on their listings" on application_answers;
create policy "Employers read answers on their listings"
  on application_answers for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and application_id in (
      select a.id from applications a
      join internship_listings il on a.listing_id = il.id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can view resumes on applications to their listings" on student_resumes;
create policy "Employers can view resumes on applications to their listings"
  on student_resumes for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and id in (
      select a.resume_id from applications a
      join internship_listings il on a.listing_id = il.id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
        and a.resume_id is not null
    )
  );

drop policy if exists "Employers can view skills of applicants" on student_skills;
create policy "Employers can view skills of applicants"
  on student_skills for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select a.student_id from applications a
      join internship_listings il on a.listing_id = il.id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can view experiences of applicants" on student_experiences;
create policy "Employers can view experiences of applicants"
  on student_experiences for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select a.student_id from applications a
      join internship_listings il on a.listing_id = il.id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can view organizations of applicants" on student_organizations;
create policy "Employers can view organizations of applicants"
  on student_organizations for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select a.student_id from applications a
      join internship_listings il on a.listing_id = il.id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can view certifications of applicants" on student_certifications;
create policy "Employers can view certifications of applicants"
  on student_certifications for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select a.student_id from applications a
      join internship_listings il on a.listing_id = il.id
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- Deliberately untouched:
--   * employer_billing / listing_payments / applicant_charges stay keyed on
--     employers.user_id — billing remains visible to the original account
--     owner only until the billing-ownership question is answered.
--   * messages / notifications are per-user, not per-company; a shared team
--     inbox is a separate product decision.
--   * student_eeo remains invisible to all employer roles — the privacy wall
--     is intentional and out of scope here.


-- ############################################################
-- SOURCE: supabase/migrations/20260803_manual_pipeline_movement.sql
-- ############################################################

-- ============================================
-- THE PIPELINE BOARD IS MOVED BY HAND
-- ============================================
-- Scheduling an interview (or asking a candidate for their availability) used
-- to drag the card into the Interviewing column on its own, and declining or
-- cancelling walked it back. Interview state and board position are two
-- different things: an employer may interview someone who they have already
-- pushed to a later stage, or want a candidate to sit in Screening until the
-- interview actually happens. Only the employer decides where a card sits.
--
-- Interviews are unaffected — the invite, the calendar event, the emails and
-- the notifications all still fire. What goes away is the implicit stage write.
--
-- The functions are left in place (harmless without their triggers, and
-- move_application_to_stage_type is still used by nothing else today) so this
-- can be reverted by recreating the three triggers alone.
--
-- Run this in the Supabase SQL Editor.

-- Forward moves: interview scheduled / availability requested → Interviewing.
drop trigger if exists trg_sync_stage_on_interview_created on interview_schedules;
drop trigger if exists trg_sync_stage_on_availability_requested on interview_availability_requests;

-- Reverse move: interview declined or cancelled → back to the previous stage.
-- Goes too. With the forward moves gone, a card only sits in Interviewing
-- because the employer put it there, and a declined invite is not a reason to
-- undo that decision.
drop trigger if exists trg_sync_stage_on_interview_closed on interview_schedules;


-- ############################################################
-- SOURCE: supabase/migrations/20260803_offers.sql
-- ############################################################

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


-- ############################################################
-- SOURCE: supabase/migrations/20260803_offer_inbox_message.sql
-- ############################################################

-- ============================================
-- OFFERS LAND IN THE INBOX TOO
-- ============================================
-- Extending an offer already writes a notification. A notification is a
-- pointer that disappears once read, which is the wrong shape for the most
-- important thing an employer ever tells a student. So the offer also arrives
-- as a real message in the thread with that employer, where it stays, is
-- searchable, and can be replied to.
--
-- Same mechanism as the interview availability request
-- (messages.availability_request_id, 20260802_interview_availability.sql): the
-- id hangs off the message, and the Inbox renders a card in place of the text
-- bubble whenever it is set. `body` remains a readable fallback -- it is what
-- the email notification and any non-card surface shows.
--
-- Run this in the Supabase SQL Editor, after 20260803_offers.sql.

alter table messages
  add column if not exists offer_id uuid references offers(id) on delete set null;

create index if not exists idx_messages_offer on messages (offer_id);
