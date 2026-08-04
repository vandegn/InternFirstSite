-- ============================================
-- STUDENT CERTIFICATIONS
-- ============================================
-- Credentials a student can prove with a document — Six Sigma belts, OSHA 30,
-- CPR, a cloud cert. Deliberately shaped like student_resumes: one row per
-- uploaded file in the shared `images` bucket, many rows per student, and the
-- file itself is a public URL rather than a signed one (same trade-off the
-- resume upload already makes).
--
-- The certification number sits alongside the file because that's what an
-- employer checks against the issuer's registry — the PDF alone can't be
-- verified. It's nullable so an unnumbered credential can still be uploaded;
-- the profile form asks for it every time.
--
-- Run this in the Supabase SQL Editor.

create table if not exists student_certifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  name text not null,                 -- display name, e.g. "Lean Six Sigma Green Belt"
  certification_number text,          -- credential/licence ID as printed on the certificate
  file_url text not null,             -- PDF in the `images` bucket
  uploaded_at timestamptz default now() not null
);

create index if not exists idx_student_certifications_student
  on student_certifications(student_id);

alter table student_certifications enable row level security;

-- ----- Students manage their own certifications -----
drop policy if exists "Students can view own certifications" on student_certifications;
create policy "Students can view own certifications"
  on student_certifications for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

drop policy if exists "Students can insert own certifications" on student_certifications;
create policy "Students can insert own certifications"
  on student_certifications for insert to authenticated
  with check (student_id in (select id from students where user_id = auth.uid()));

drop policy if exists "Students can update own certifications" on student_certifications;
create policy "Students can update own certifications"
  on student_certifications for update to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

drop policy if exists "Students can delete own certifications" on student_certifications;
create policy "Students can delete own certifications"
  on student_certifications for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- ----- Employers see the certifications of their own applicants -----
-- Same reach as the other applicant-PII tables (20260801_employer_verification.sql,
-- "Gate 3"): approved employers only, and only for students who applied to one
-- of their listings. An employer who guesses a student id gets nothing.
drop policy if exists "Employers can view certifications of applicants" on student_certifications;
create policy "Employers can view certifications of applicants"
  on student_certifications for select to authenticated
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
