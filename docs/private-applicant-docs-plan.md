# Plan: Move resumes + application file-answers to a private Supabase bucket

> Implementation plan for a fresh Claude instance. Written 2026-08-01. Read this
> top to bottom before touching code — it captures the current state, the design
> rationale, and a reversible rollout order. All app code lives in `app/` (run
> npm/tsc/eslint from there). Schema lives in `supabase/`.

## Goal

Resumes and student-uploaded application file-answers currently sit in a **public**
Supabase Storage bucket and are served via permanent public URLs. They contain PII
and should be **private**, viewable only by the owning student and the employer of
the listing the student applied to. Company logos, listing banners, and avatars are
branding/identity shown on public pages and **stay public**.

## Current state (verified in code)

All uploads go into a single **public `images` bucket**. Three upload paths in
`app/src/lib/supabase.ts`:

| Helper | Path prefix | Content | Target |
|---|---|---|---|
| `uploadImage(bucket, path, file)` (~line 143) | various | avatars, company logos, listing banners | keep public |
| `uploadResume(studentId, file, name)` (~line 943) | `resumes/<studentId>/` | resumes | **make private** |
| `uploadApplicationFile(studentId, file)` (~line 503) | `application-files/<studentId>/` | file-type question answers | **make private** |

- Each stores the result of `getPublicUrl()` into a DB column:
  - `student_resumes.file_url` (see `supabase/migrations/add_student_resumes.sql`)
  - `application_answers.file_url` (see `supabase/migrations/20260801_customizable_listings.sql`
    and `20260801_fix_question_table_collision.sql`; `question_type` includes `'file'`,
    answer stored in `file_url` when type is `file`)
- Render sites read `file_url` and drop it into an `<a href>`. Locations:
  - `app/src/app/dashboard/employer/applications/page.tsx` (resume href ~340; file answer `answer.file_url` ~366-368)
  - `app/src/app/dashboard/employer/pipeline/page.tsx` (~549)
  - `app/src/app/dashboard/employer/pipeline/all/page.tsx` (~215)
  - `app/src/app/dashboard/employer/posted-jobs/page.tsx` (~585)
  - `app/src/app/dashboard/student/internships/[id]/page.tsx` (~384, resume "View")
  - `app/src/app/dashboard/student/profile/page.tsx` (~884)
  - `app/src/components/ApplicationQuestionsForm.tsx` (uploads via `uploadApplicationFile`, ~62)
- **No emails or public pages reference these URLs** (checked `src/lib/email-templates*`
  and non-dashboard pages) — messaging is in-platform, EEO/EIN are table columns not files.

## Key design insight — reuse existing RLS, don't duplicate it

Both tables **already** encode the exact authorization rule we want:

- `student_resumes` (in `add_student_resumes.sql`): SELECT policies for the owner
  student AND "Employers can view resumes on applications to their listings"
  (joins `applications.resume_id`).
- `application_answers` (in schema.sql ~939 and the 20260801 migrations): SELECT
  policies "Students read answers on own applications" and "Employers read answers
  on their listings".

So the file route can authorize simply by **selecting the row with the user-scoped
server client** — if RLS returns it, the caller is allowed. Then sign with the
service-role client. No storage read policies and no duplicated SQL.

## Server client helpers (already exist)

`app/src/lib/supabase-server.ts`:
- `getServerSupabase()` — request-scoped, reads user from cookies, **RLS applies**.
- `getAdminSupabase()` — **service-role** (uses `SUPABASE_SERVICE_ROLE_KEY`), bypasses RLS.

Existing API routes to mirror for style/auth: `app/src/app/api/messages/route.ts`,
`app/src/app/api/interviews/*`. Env var `SUPABASE_SERVICE_ROLE_KEY` is already used.

## Design

- **New private bucket:** `applicant-docs`, holding both `resumes/<studentId>/...`
  and `application-files/<studentId>/...`.
- **Reads:** new API route `GET /api/files/[kind]/[id]` where `kind` ∈
  `resume | application-answer`:
  1. `getServerSupabase()`; require a logged-in user (401 otherwise).
  2. Look up the row by id, selecting `storage_path`, with the **user-scoped** client.
     RLS returns nothing → respond 404 (this is the authorization gate).
  3. `getAdminSupabase().storage.from('applicant-docs').createSignedUrl(path, 60, { download: false })`.
  4. `NextResponse.redirect(signedUrl, 302)`.
- **Render sites** keep the `<a href>` pattern; the href becomes a deterministic
  path — `/api/files/resume/${resume.id}` or `/api/files/application-answer/${answer.id}`.
  No async, no change to the data queries beyond selecting the row id (already selected).
- **Uploads** stay client-side (`supabase.storage.from('applicant-docs').upload(...)`),
  but store `storage_path` instead of a public URL. A storage INSERT policy scopes
  students to their own folder. No storage SELECT policy for users (bucket stays
  unreadable directly; only the service-role route reads it).
- **Signed URL lifetime: 60s** (enough for click→redirect→load; not long-lived).

## Steps

1. **DB migration** `supabase/migrations/<date>_private_applicant_docs.sql` (also mirror into `supabase/schema.sql`):
   - `alter table student_resumes add column storage_path text;`
   - `alter table application_answers add column storage_path text;`
   - Backfill `storage_path` from `file_url` by stripping the
     `.../storage/v1/object/public/images/` prefix (leaves e.g. `resumes/<id>/<ts>.pdf`).
   - Storage INSERT policy on bucket `applicant-docs` allowing an authenticated
     student to upload only under `resumes/<theirStudentId>/` and
     `application-files/<theirStudentId>/` (use `storage.foldername(name)` and join
     `students` on `auth.uid()`).

2. **Create the bucket** `applicant-docs` (private) — via a service-role Node script,
   not the dashboard. `supabase.storage.createBucket('applicant-docs', { public: false })`.

3. **API route** `app/src/app/api/files/[kind]/[id]/route.ts` — as designed above.
   Map `kind` → table (`resume`→`student_resumes`, `application-answer`→`application_answers`).

4. **Update upload helpers** in `app/src/lib/supabase.ts`:
   - `uploadResume`: upload to `applicant-docs`, insert `student_resumes` with
     `storage_path` (keep `name`; stop writing `file_url`, or write null).
   - `uploadApplicationFile`: upload to `applicant-docs`; return the `storage_path`
     so `ApplicationQuestionsForm` stores it in the answer's `storage_path`. Trace how
     the returned value flows into the `application_answers` insert (via
     `ApplicationAnswerInput` / the answers insert path) and switch it to `storage_path`.

5. **Switch render sites** (the 6-7 files listed above) from `file_url` to the route
   href. For resumes: `/api/files/resume/${resume.id}`. For file answers:
   `/api/files/application-answer/${answer.id}`. Keep the visible label/filename.

6. **One-time object migration script** (service-role, Node in a temp `app/scripts/`):
   list objects under `images/resumes/` and `images/application-files/`, **copy**
   them into `applicant-docs/...` (use `.copy()` — keep originals in `images` for now).
   Ensure every `storage_path` row matches an object now present in `applicant-docs`.

7. **Verify** end-to-end against live Supabase (same style as prior tests — sign in
   as the test accounts, exercise real REST/route calls, then clean up):
   - Student uploads a resume → route returns a working signed link (302 → 200 PDF).
   - Employer the student applied to → route returns the file.
   - Employer with **no** application from that student → route 404.
   - Random authenticated user → route 404.
   - Direct `applicant-docs` public URL → denied (bucket is private).
   - Delete any temp script afterward.

8. **Cleanup (only after step 7 passes):** delete the old public copies from
   `images/resumes/*` and `images/application-files/*`; remove any remaining
   `file_url` writes; optionally drop the `file_url` columns in a follow-up migration
   once nothing reads them.

## Rollout safety / reversibility

Originals stay in `images` until step 8, so there is **no window** where an existing
resume 404s. If any step regresses, revert the render sites (step 5) to `file_url`
and the old public objects still resolve.

## Test accounts

| Role | Email | Password |
|------|-------|----------|
| Student | chud@htn.edu | 111111 |
| Employer | chud@htn.org | 123456 |

Resumes attach to applications via `applications.resume_id`; an employer can only
see a resume/file if that student applied to one of the employer's listings.

## Open questions to confirm with the user before building

1. **Existing files:** full migration of already-uploaded resumes/files (step 6), or
   switch only *new* uploads to private and leave existing ones public for now?
2. **Service-role scripts:** OK to run service-role Node scripts against Supabase?
   Requires `SUPABASE_SERVICE_ROLE_KEY` set locally (check `app/.env.local`).
3. **Avatars:** confirm they stay public (recommended). Making them private adds a
   signed-URL round trip to every profile render for low security benefit.

## Decisions already made (change only if the user objects)

- New private bucket `applicant-docs`; `images` stays public.
- 60-second signed URL lifetime, inline view (`download: false`).
- Authorization reuses existing table RLS via the user-scoped server client; signing
  uses the service-role client. No storage read policies.
