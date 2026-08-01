-- Cap each student at 10 skills
-- ============================================
-- Authoritative guard: rejects an insert that would push a student past the
-- limit, regardless of client. Mirrors MAX_STUDENT_SKILLS in
-- app/src/lib/constants.ts — keep the number (10) in sync.

create or replace function enforce_skill_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from student_skills where student_id = new.student_id) >= 10 then
    raise exception 'A student can have at most 10 skills.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger student_skills_limit
  before insert on student_skills
  for each row execute function enforce_skill_limit();
