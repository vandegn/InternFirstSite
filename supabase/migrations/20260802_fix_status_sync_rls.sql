-- ============================================
-- Fix: new applications land with status = NULL
-- ============================================
--
-- sync_application_status_from_stage() copies the stage's label into the legacy
-- `status` column on insert. It was created without `security definer`, so its
-- lookup ran under the *applying student's* RLS. The student's read policy on
-- pipeline_stages is
--
--     listing_id in (select a.listing_id from applications a
--                    join students s on a.student_id = s.id
--                    where s.user_id = auth.uid())
--
-- which is only satisfied once the student has an application on that listing.
-- In a BEFORE INSERT trigger the row does not exist yet, so the subquery
-- matched nothing, `select label into new.status` assigned NULL, and the
-- application was stored with no status at all.
--
-- The sibling trigger set_default_application_stage() already runs security
-- definer, which is why stage_id was assigned correctly while status was not --
-- and why the bug is invisible on the pipeline board (which keys off stage_id)
-- but shows up anywhere the legacy status text is read, including the offer
-- count in getStudentStats.
--
-- security definer + a pinned search_path, matching the sibling trigger.

create or replace function sync_application_status_from_stage()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.stage_id is not null then
    select label into new.status from pipeline_stages where id = new.stage_id;
  end if;
  return new;
end;
$$;

-- Repair rows already stored without a status.
update applications a
set status = ps.label
from pipeline_stages ps
where ps.id = a.stage_id
  and a.status is distinct from ps.label;
