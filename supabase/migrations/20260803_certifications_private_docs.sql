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
