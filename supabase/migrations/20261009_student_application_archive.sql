-- ============================================
-- STUDENT APPLICATION ARCHIVE (My Applications tabs)
-- ============================================
--
-- Students can tidy their My Applications view by archiving an application
-- (Open / Rejected / Archive tabs, plus an Archive action on the dashboard
-- home list). Archiving is the student's personal filing — it is NOT a hiring
-- status:
--
--   * it never touches applications.status / stage_id, so the employer's
--     board, counts and notifications are unaffected;
--   * employers keep moving archived applications through their pipeline, and
--     the application stays archived (nothing auto-restores it);
--   * employers can't see it at all — there is no employer policy here.
--
-- Shaped like saved_listings: a student-private side table rather than a
-- column on applications. A column would need an UPDATE policy for students on
-- applications, and RLS can't restrict which columns an UPDATE touches — a
-- student who could flip "archived" could also rewrite their own stage. With a
-- side table the student never gets UPDATE on applications at all, so "archive
-- can't alter hiring status" holds structurally.
--
-- Archive = insert a row, restore = delete it. One row per application
-- (primary key), so a double-click can't create two.
--
-- Run this in the Supabase SQL Editor. Safe to re-run.

create table if not exists student_application_archives (
  application_id uuid primary key references applications(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  archived_at timestamptz not null default now()
);

create index if not exists idx_student_application_archives_student
  on student_application_archives(student_id);

alter table student_application_archives enable row level security;

drop policy if exists "Students view own application archives" on student_application_archives;
create policy "Students view own application archives"
  on student_application_archives for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- The application must be the caller's own, and the row's student_id must be
-- that application's student — so a student can't archive someone else's
-- application or file their own under another student. Columns of the new row
-- are table-qualified: inside the subquery an unqualified `student_id` would
-- bind to applications.student_id and make the check vacuous.
drop policy if exists "Students archive own applications" on student_application_archives;
create policy "Students archive own applications"
  on student_application_archives for insert to authenticated
  with check (
    exists (
      select 1
      from applications a
      join students s on s.id = a.student_id
      where a.id = student_application_archives.application_id
        and a.student_id = student_application_archives.student_id
        and s.user_id = auth.uid()
    )
  );

drop policy if exists "Students restore own applications" on student_application_archives;
create policy "Students restore own applications"
  on student_application_archives for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- Deliberately no UPDATE policy (archive/restore is insert/delete) and no
-- employer or admin policy (the archive is the student's private view).
