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
