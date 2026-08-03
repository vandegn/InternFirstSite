-- ============================================
-- FIX: over-permissive SELECT policy on student_resumes (live DB only)
-- ============================================
-- Verified 2026-08-03: a brand-new authenticated user with no profile could
-- select every student_resumes row. The offending policy exists only in the
-- live database (added ad-hoc, never in a migration) — the repo's policies
-- (add_student_resumes.sql, tightened by 20260801_employer_verification.sql)
-- are owner-only + employer-with-application.
--
-- While resumes lived on the public `images` bucket this leaked nothing new,
-- but /api/files/resume/[id] now authorizes by an RLS-scoped select, so the
-- rogue policy would let any logged-in user fetch any resume. Drop every
-- SELECT policy on the table and recreate exactly the two intended ones.
--
-- Run this in the Supabase SQL Editor. The NOTICE output names what was
-- dropped.

do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'student_resumes' and cmd = 'SELECT'
  loop
    raise notice 'dropping SELECT policy on student_resumes: %', p.policyname;
    execute format('drop policy %I on student_resumes', p.policyname);
  end loop;
end $$;

create policy "Students can view own resumes"
  on student_resumes for select to authenticated
  using (
    student_id in (select id from students where user_id = auth.uid())
  );

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
