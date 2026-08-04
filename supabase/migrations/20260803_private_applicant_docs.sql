-- ============================================
-- PRIVATE APPLICANT DOCS
-- ============================================
-- Resumes and application file-answers move from the public `images` bucket to
-- a private `applicant-docs` bucket. Tables now store `storage_path` (the
-- object key inside `applicant-docs`) instead of a permanent public URL.
-- Reads go through GET /api/files/[kind]/[id], which authorizes by selecting
-- the row with the caller's own (RLS-scoped) session and then 302-redirects to
-- a 60-second signed URL created with the service role.
--
-- The bucket itself is created by app/scripts/private-docs-setup.mjs (service
-- role), which also copies the existing objects out of `images`. Run that
-- script and this migration before deploying the app change; the old public
-- objects stay in `images` until verification passes, so existing links keep
-- working throughout the rollout.
--
-- Run this in the Supabase SQL Editor.

-- ----- storage_path columns -----
alter table student_resumes add column if not exists storage_path text;
alter table application_answers add column if not exists storage_path text;

-- New uploads no longer write file_url (it was NOT NULL on student_resumes).
alter table student_resumes alter column file_url drop not null;

-- ----- Backfill from the old public URLs -----
-- Public URLs look like:
--   https://<ref>.supabase.co/storage/v1/object/public/images/resumes/<studentId>/<ts>.pdf
-- The storage path is everything after the bucket name.
update student_resumes
set storage_path = substring(file_url from '/storage/v1/object/public/images/(.*)$')
where storage_path is null
  and file_url like '%/storage/v1/object/public/images/%';

update application_answers
set storage_path = substring(file_url from '/storage/v1/object/public/images/(.*)$')
where storage_path is null
  and file_url like '%/storage/v1/object/public/images/%';

-- ----- Storage write policy -----
-- Uploads stay client-side, so students may INSERT only into their own
-- folders inside the private bucket. There is deliberately NO storage SELECT
-- policy: the bucket is unreadable directly, and the only read path is the
-- service-role signed URL issued by /api/files after table RLS lets the
-- caller see the row.
create policy "Students upload own applicant docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-docs'
    and (storage.foldername(name))[1] in ('resumes', 'application-files')
    and (storage.foldername(name))[2] in (
      select id::text from students where user_id = auth.uid()
    )
  );
