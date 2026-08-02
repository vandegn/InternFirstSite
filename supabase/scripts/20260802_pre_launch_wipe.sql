-- ============================================
-- PRE-LAUNCH WIPE — DESTRUCTIVE, NOT REVERSIBLE
-- ============================================
--
-- Clears all platform content and every student and employer account so real
-- postings go in against an empty database. This is a one-off operation
-- script, NOT a migration: it is destructive, not idempotent, and must never
-- be moved into supabase/migrations/.
--
-- Run once, on 2026-08-02, ahead of launch. Kept in the repo as the record of
-- what was removed and why, not as something to run again.
--
-- There is no undo. Every account on the platform at the time of writing was
-- a test account, confirmed by the team, so nothing here was backed up. That
-- will not be true the next time — if this script is ever reached for again,
-- take a pg_dump first.
--
-- WHAT GOES
--   - All 223 internship_listings
--   - All ~21,124 applications, plus pipeline stages, views, sections,
--     questions, saved listings, interviews (all by cascade)
--   - All 121 student accounts
--   - All 38 employer accounts
--   - All 18 messages
--
-- WHAT STAYS
--   - The intern_first_admin account. Without it there is no way back into
--     the admin dashboard short of hand-writing a profiles row in SQL.
--   - The 2 university_admin accounts.
--   - The waitlist (12 entries) — leads, unrelated to listings.
--   - Archived copies of employer_billing and listing_payments. The originals
--     cascade away with their employers; these snapshots preserve the Stripe
--     customer and payment-method IDs. Confirmed test mode, so this is
--     record-keeping rather than financial data.
--
-- ORDER MATTERS. messages.sender_id/receiver_id and listing_views.viewer_id
-- are ON DELETE NO ACTION, so an account with message history raises a
-- foreign-key violation unless messages go first. listing_views cascade with
-- the listings, which are deleted before any account.

begin;

-- ── 0. Archive Stripe linkage before it cascades ─────────────────────
create table if not exists _archive_employer_billing as
  select b.*, p.email as employer_email, now() as archived_at
  from employer_billing b
  left join employers e on e.id = b.employer_id
  left join profiles p on p.user_id = e.user_id;

create table if not exists _archive_listing_payments as
  select lp.*, now() as archived_at
  from listing_payments lp;

-- ── Who is being removed ─────────────────────────────────────────────
-- Every student and employer. Admin and university roles are excluded by
-- the role filter and again by the explicit guard below.
create temporary table _doomed_users on commit drop as
select user_id, email, role
from profiles
where role in ('student', 'employer');

delete from _doomed_users
where role in ('intern_first_admin', 'university_admin')
   or user_id in (
        select user_id from profiles
        where role in ('intern_first_admin', 'university_admin')
      );

-- Refuse to run if the admin would be caught, or if the match looks nothing
-- like what this script was written against.
do $$
declare
  n int;
  admins_left int;
begin
  select count(*) into n from _doomed_users;
  select count(*) into admins_left
    from profiles
   where role = 'intern_first_admin'
     and user_id not in (select user_id from _doomed_users);

  raise notice 'accounts targeted: %', n;

  if admins_left = 0 then
    raise exception 'Refusing to run: this would leave no admin account.';
  end if;
  if n = 0 then
    raise exception 'Refusing to run: matched 0 accounts.';
  end if;
end $$;

-- ── 1. Messages ──────────────────────────────────────────────────────
-- NO ACTION on both FKs, so these must go before the profiles do.
delete from messages
where sender_id in (select user_id from _doomed_users)
   or receiver_id in (select user_id from _doomed_users);

-- ── 2. Every listing ─────────────────────────────────────────────────
-- Cascades to applications and their answers, pipeline_stages,
-- listing_views, listing_sections, listing_questions, saved_listings,
-- interview_schedules, applicant_charges.
delete from internship_listings;

-- ── 3. The accounts ──────────────────────────────────────────────────
-- auth.users cascades to profiles, then to students/employers and
-- everything hanging off them: skills, experiences, organizations, resumes,
-- survey responses, EEO, notifications, billing.
delete from auth.users
where id in (select user_id from _doomed_users);

-- ── Verify before committing ─────────────────────────────────────────
-- Expect: 0 listings, 0 applications, 0 students, 0 employers, 0 messages,
-- 1 admin, 2 university admins, 12 waitlist, and both archive tables populated.
select
  (select count(*) from internship_listings)                        as listings,
  (select count(*) from applications)                               as applications,
  (select count(*) from profiles where role='student')              as students,
  (select count(*) from profiles where role='employer')             as employers,
  (select count(*) from messages)                                   as messages,
  (select count(*) from profiles where role='intern_first_admin')   as admins,
  (select count(*) from profiles where role='university_admin')     as university_admins,
  (select count(*) from waitlist)                                   as waitlist,
  (select count(*) from _archive_employer_billing)                  as archived_billing,
  (select count(*) from _archive_listing_payments)                  as archived_payments;

-- Read the row above. `admins` must be 1. If it all looks right:
commit;
-- Otherwise:
-- rollback;
