-- ============================================
-- Students: the school they attend
-- ============================================
-- Students pick their institution from the Department of Education's approved
-- list (bundled at app/src/data/us-schools.json, served through /api/schools).
-- Three columns rather than one so the value survives the list changing:
--
--   school_id    the federal institution id — stable even if a school is
--                renamed, and the join key if this ever becomes a real table
--   school_name  the canonical name, denormalised so profile and candidate
--                views render without a lookup
--   school_state full state name, the only way to tell apart the ~90 schools
--                that share a name across states ("Bethel University")
--
-- Nullable: Google OAuth signups never see the register form, and every
-- account created before this migration has no school on file. Both fill it in
-- from /dashboard/student/profile.
--
-- Not to be confused with students.university_id, a dead FK left over from the
-- removed university portal (see docs/UNIVERSITY_PORTAL_ARCHIVE.md). Nothing
-- writes it and this does not touch it.
--
-- Run this in the Supabase SQL Editor.

alter table students
  add column if not exists school_id integer,
  add column if not exists school_name text,
  add column if not exists school_state text;

-- Employers filtering a candidate list by school hit this; students are read
-- one row at a time so no other index is warranted.
create index if not exists idx_students_school_id on students(school_id);
