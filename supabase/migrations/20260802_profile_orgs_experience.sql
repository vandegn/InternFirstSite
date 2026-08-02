-- Student profile restructure.
--
-- Two things changed in how a student describes themselves:
--
--   1. "Campus Involvement" lived under Experience, which put student clubs
--      next to professional internships. Experience is now strictly
--      professional (internships, jobs, projects) and Organizations absorbs
--      everything campus-side — Greek life, clubs, and campus involvement.
--
--   2. Organizations had no way to say "I'm still in this." Students were
--      picking today's date as the end date to work around it.
--
-- ============================================
-- 1. Organizations gain is_current + description, and two new types
-- ============================================

alter table student_organizations
  add column if not exists is_current boolean default false;

-- Campus involvement entries carried a free-text description; organizations
-- need somewhere to put it or the migrated rows lose their detail.
alter table student_organizations
  add column if not exists description text;

alter table student_organizations
  drop constraint if exists student_organizations_type_check;

alter table student_organizations
  add constraint student_organizations_type_check
  check (type in ('greek_life', 'club', 'campus_involvement', 'other'));

-- Anything with no end date is, by definition, still current. Backfills the
-- rows that predate the column.
update student_organizations
   set is_current = true
 where end_date is null
   and is_current is distinct from true;

-- ============================================
-- 2. Move campus_involvement rows out of experiences
-- ============================================
--
-- title held the student's role ("Vice President") and organization held the
-- group ("Habitat for Humanity"), so they swap sides on the way over. Rows
-- with no organization fall back to the title as the name, since
-- student_organizations.name is not null.

insert into student_organizations
  (student_id, type, name, role, join_date, end_date, is_current, description, created_at)
select
  e.student_id,
  'campus_involvement',
  coalesce(nullif(trim(e.organization), ''), e.title),
  case when nullif(trim(e.organization), '') is null then null else e.title end,
  e.start_date,
  e.end_date,
  coalesce(e.is_current, e.end_date is null),
  e.description,
  e.created_at
from student_experiences e
where e.type = 'campus_involvement';

delete from student_experiences where type = 'campus_involvement';

-- ============================================
-- 3. Experience is professional only
-- ============================================

alter table student_experiences
  drop constraint if exists student_experiences_type_check;

alter table student_experiences
  add constraint student_experiences_type_check
  check (type in ('internship', 'work', 'project'));

comment on column student_organizations.is_current is
  'Student is still a member. When true the UI ignores end_date and shows "Present".';
