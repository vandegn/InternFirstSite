-- ============================================
-- PRE-LAUNCH DATA RESET — DESTRUCTIVE, NOT REVERSIBLE
-- ============================================
--
-- Removes all seeded/demo content so real postings can go in against a clean
-- platform. This is a one-off operation script, NOT a migration — it is not
-- idempotent and must never be added to the migrations folder.
--
-- TAKE A BACKUP FIRST. Supabase Dashboard -> Database -> Backups, or confirm
-- Point-in-Time Recovery is enabled. There is no undo.
--
-- WHAT GOES
--   - All 223 internship_listings (every listing, regardless of owner)
--   - 30 employer accounts @internfirst-test.com
--   -  4 legacy demo employers: boss.com, apexdigital.io, greenfieldcap.com,
--      brightpathmarketing.com
--   - 100 seeded student accounts @test.edu
--   - ~21,124 applications and ~1,089 pipeline stages (by cascade)
--
-- WHAT STAYS
--   - The documented test logins in CLAUDE.md: chud@htn.org (employer),
--     chud@htn.edu (student), the university admin. Their listings are
--     deleted but the accounts survive so QA still has somewhere to log in.
--   - InternFirst Inc. (maxvandessel@intern-first.com) — account kept, its
--     4 listings deleted.
--   - The admin (ceo@intern-first.com) and all 13 real student signups
--     (ncsu, osu, charlotte, umich, ufl, uncc, outlook, miamioh).
--
-- ORDER MATTERS. messages.sender_id/receiver_id are ON DELETE NO ACTION, so
-- deleting an account that has ever sent or received a message raises a
-- foreign-key violation. Messages are cleared first. Everything else cascades.

begin;

-- ── Who is being removed ─────────────────────────────────────────────
-- Materialised up front so every later statement targets the same set even
-- as rows disappear underneath it.
create temporary table _doomed_users on commit drop as
select p.user_id, p.email, p.role
from profiles p
where (p.role = 'employer' and (
        p.email like '%@internfirst-test.com'
     or p.email in (
          'boss@boss.com',
          'recruiting@apexdigital.io',
          'talent@greenfieldcap.com',
          'hr@brightpathmarketing.com'
        )
      ))
   or (p.role = 'student' and p.email like '%@test.edu');

-- Guard rail: if this count is wildly off from 134, something has changed
-- since the script was written — stop and re-check before committing.
do $$
declare n int;
begin
  select count(*) into n from _doomed_users;
  raise notice 'accounts targeted for deletion: %', n;
  if n = 0 then
    raise exception 'Refusing to run: matched 0 accounts. Check the email patterns.';
  end if;
  if n > 200 then
    raise exception 'Refusing to run: matched % accounts, expected ~134.', n;
  end if;
end $$;

-- Never delete the accounts we rely on, whatever the patterns above matched.
delete from _doomed_users
where email in (
  'chud@htn.org',
  'chud@htn.edu',
  'maxvandessel@intern-first.com',
  'ceo@intern-first.com',
  'eliot.seifrit@outlook.com'
);

-- ── 1. Messages ──────────────────────────────────────────────────────
-- NO ACTION on both FKs, so these must go before the profiles do.
delete from messages
where sender_id in (select user_id from _doomed_users)
   or receiver_id in (select user_id from _doomed_users);

-- ── 2. Every listing ─────────────────────────────────────────────────
-- Cascades to: applications (and their answers), pipeline_stages,
-- listing_views, listing_sections, listing_questions, saved_listings,
-- interview_schedules, applicant_charges.
-- listing_payments.listing_id is SET NULL, so payment history survives as an
-- audit trail rather than vanishing with the listing.
delete from internship_listings;

-- ── 3. The accounts ──────────────────────────────────────────────────
-- auth.users cascades to profiles, which cascades to employers/students and
-- everything hanging off them (skills, experiences, organizations, resumes,
-- surveys, EEO, notifications, billing).
delete from auth.users
where id in (select user_id from _doomed_users);

-- ── Verify before committing ─────────────────────────────────────────
-- Expect: 0 listings, 0 applications, 4 employers, 21 students.
select
  (select count(*) from internship_listings) as listings,
  (select count(*) from applications)        as applications,
  (select count(*) from pipeline_stages)     as pipeline_stages,
  (select count(*) from profiles where role='employer') as employers_left,
  (select count(*) from profiles where role='student')  as students_left,
  (select count(*) from messages)            as messages_left;

-- Review the row above. If it looks right:
commit;
-- If anything looks wrong instead:
-- rollback;
