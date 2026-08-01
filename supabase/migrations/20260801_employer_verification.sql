-- ============================================
-- EMPLOYER VERIFICATION
-- ============================================
-- Turns the unused `verified` boolean into a reviewable workflow and deletes
-- the self-attested `business_id` (EIN) field, which nothing ever checked.
--
--   pending    -> awaiting admin review (default for every new signup)
--   needs_info -> reviewer asked for something; the note is shown to the employer
--   approved   -> reviewed; listings go live and candidate data unlocks
--   rejected   -> denied; note is shown to the employer
--
-- `verified` is kept as a derived mirror of (verification_status = 'approved')
-- so existing reads (employer settings/account pages) keep working. A trigger
-- maintains it -- never write `verified` directly.
--
-- Automated signals (domain age, email/website domain match, free-provider
-- email) are stored on the row so a reviewer triages instead of investigating
-- from scratch. They are INPUTS to a human decision and never auto-approve:
-- a matching domain only proves someone controls a domain, which costs $12.
-- Domain *age* is the signal that actually separates real companies from
-- purpose-built fronts.
--
-- WHAT THIS GATES (unverified employers keep full access to everything else,
-- including creating and editing listings -- the friction is deliberately at
-- the point where student data is exposed, not at signup):
--   * their listings are hidden from students and the public browse page
--   * applications to their listings are invisible
--   * applicant resumes, skills, experiences, organizations, and custom-
--     question answers are invisible
--
-- BACKFILL: `verified = true` maps to 'approved', everything else to 'pending'.
-- At time of writing that is 33 seeded employers approved (133 active listings
-- stay live) and 5 real signups moved to pending (4 active listings go dark
-- until reviewed). Approving them in the admin queue restores them.
--
-- Run this in the Supabase SQL Editor.

begin;

-- ----- Safety guard: business_id is dropped below, so refuse if it holds data -----
do $$
declare
  b_count int;
begin
  select count(business_id) into b_count from employers;
  if b_count > 0 then
    raise exception
      'Aborting: % employer(s) have a business_id value. This migration drops '
      'that column. Export the values first if they are worth keeping.', b_count;
  end if;
end $$;

-- ----- Schema -----

alter table employers
  add column if not exists verification_status text not null default 'pending',
  add column if not exists verification_note text,          -- reviewer -> employer
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references profiles(user_id) on delete set null,
  -- Automated signals, refreshed by /api/employer/verification-signals
  add column if not exists email_domain text,
  add column if not exists website_domain text,
  add column if not exists domain_match boolean,
  add column if not exists free_email_provider boolean,
  add column if not exists domain_registered_at timestamptz,
  add column if not exists domain_age_days int,
  add column if not exists signals_checked_at timestamptz,
  add column if not exists signals_error text;

alter table employers
  drop constraint if exists employers_verification_status_check;
alter table employers
  add constraint employers_verification_status_check
  check (verification_status in ('pending', 'needs_info', 'approved', 'rejected'));

alter table employers drop column if exists business_id;

create index if not exists idx_employers_verification_status
  on employers(verification_status);

-- ----- Backfill (before the trigger exists, so `verified` is left as-is) -----
update employers
  set verification_status = case when verified then 'approved' else 'pending' end;

-- Seeded/pre-existing approvals were never actually reviewed by a human.
-- Record that honestly rather than inventing a reviewer.
update employers
  set verification_note = 'Auto-approved during the verification backfill; not human-reviewed.'
  where verification_status = 'approved' and verification_note is null;

-- ----- Keep `verified` in sync -----
create or replace function sync_employer_verified()
returns trigger
language plpgsql
as $$
begin
  new.verified := (new.verification_status = 'approved');
  return new;
end;
$$;

drop trigger if exists trg_sync_employer_verified on employers;
create trigger trg_sync_employer_verified
  before insert or update of verification_status on employers
  for each row execute function sync_employer_verified();

-- ----- Predicates used by the policies below -----
-- security definer so tightening the `employers`/`profiles` select policies
-- later cannot silently turn these into `false` and lock everyone out.

create or replace function is_approved_employer(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from employers
    where user_id = uid and verification_status = 'approved'
  );
$$;

create or replace function is_intern_first_admin(uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles
    where user_id = uid and role = 'intern_first_admin'
  );
$$;

-- ----- Admins can read and action every employer -----

drop policy if exists "Admins can view all employers" on employers;
create policy "Admins can view all employers"
  on employers for select to authenticated
  using (is_intern_first_admin(auth.uid()));

drop policy if exists "Admins can update verification" on employers;
create policy "Admins can update verification"
  on employers for update to authenticated
  using (is_intern_first_admin(auth.uid()))
  with check (is_intern_first_admin(auth.uid()));

-- ----- Gate 1: listings from unapproved employers are not visible -----
-- Employers still see and edit their own via "Employers can manage own listings".

drop policy if exists "Active listings are viewable by authenticated users" on internship_listings;
create policy "Active listings are viewable by authenticated users"
  on internship_listings for select to authenticated
  using (
    employer_id in (
      select id from employers where verification_status = 'approved'
    )
  );

drop policy if exists "Active listings are publicly viewable" on internship_listings;
create policy "Active listings are publicly viewable"
  on internship_listings for select to anon
  using (
    status = 'active'
    and employer_id in (
      select id from employers where verification_status = 'approved'
    )
  );

-- ----- Gate 2: applications are invisible until approved -----

drop policy if exists "Employers can view applications to their listings" on applications;
create policy "Employers can view applications to their listings"
  on applications for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Employers can update application status" on applications;
create policy "Employers can update application status"
  on applications for update to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ----- Gate 3: applicant PII is invisible until approved -----

drop policy if exists "Employers can view resumes on applications to their listings" on student_resumes;
create policy "Employers can view resumes on applications to their listings"
  on student_resumes for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and id in (
      select a.resume_id from applications a
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
        and a.resume_id is not null
    )
  );

drop policy if exists "Employers can view skills of applicants" on student_skills;
create policy "Employers can view skills of applicants"
  on student_skills for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Employers can view experiences of applicants" on student_experiences;
create policy "Employers can view experiences of applicants"
  on student_experiences for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Employers can view organizations of applicants" on student_organizations;
create policy "Employers can view organizations of applicants"
  on student_organizations for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

drop policy if exists "Employers read answers on their listings" on application_answers;
create policy "Employers read answers on their listings"
  on application_answers for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and application_id in (
      select a.id from applications a
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ----- Applicant count that survives the gate -----
-- "3 applicants are waiting" converts far better than "verify to see
-- applicants", so expose the count (and nothing else) to pending employers.
-- security definer deliberately bypasses Gate 2; it returns a bare integer
-- scoped to the caller's own listings and leaks no per-applicant data.

create or replace function employer_pending_applicant_count()
returns int
language sql
stable
security definer
set search_path = public
as $$
  select count(a.id)::int
  from applications a
  join internship_listings il on a.listing_id = il.id
  join employers e on il.employer_id = e.id
  where e.user_id = auth.uid();
$$;

revoke all on function employer_pending_applicant_count() from public;
grant execute on function employer_pending_applicant_count() to authenticated;

commit;
