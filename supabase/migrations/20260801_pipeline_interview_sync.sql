-- ============================================
-- Pipeline: locked anchor titles + interview/stage sync
-- ============================================
-- Three related fixes to the employer CRM board:
--
-- 1. LOCKED ANCHOR TITLES. "Applied" and "Offered" are the board's fixed
--    endpoints — every other column lives between them and stage_type drives
--    the dashboard stats. The UI already refused to drag or delete them, but
--    the label input was still editable, so an employer could rename "Offered"
--    to something the stats no longer describe. Enforce it in the DB too.
--
-- 2. NO INTERVIEWING COLUMN. Listings seeded only two stages: Applied and
--    Offered. Moving a candidate one step forward therefore *had* to land them
--    in "Offered" — which is exactly the reported bug ("status shows offered
--    when he only moved onto interview stage"). Seed an Interviewing column
--    between the anchors.
--
-- 3. INTERVIEWS DIDN'T TOUCH THE BOARD. Scheduling an interview wrote
--    applications.status = 'interviewing' and declining wrote 'reviewed', both
--    as raw text. But every surface now renders the *stage* label (status is a
--    denormalized mirror maintained by trg_sync_application_status, which only
--    fires on stage_id writes). So those writes were invisible: the card never
--    moved, and declining an interview left the posting untouched. Drive the
--    board from interview_schedules with triggers instead, so it works no
--    matter which client path fires.
--
-- Run this in the Supabase SQL Editor.

-- ----- 1. Locked anchors cannot be renamed or retyped -----
create or replace function guard_locked_stage()
returns trigger
language plpgsql
as $$
begin
  if old.locked then
    if new.label is distinct from old.label then
      raise exception 'Cannot rename the locked "%" pipeline column', old.label
        using errcode = 'check_violation';
    end if;
    if new.stage_type is distinct from old.stage_type then
      raise exception 'Cannot change the type of the locked "%" pipeline column', old.label
        using errcode = 'check_violation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_locked_stage on pipeline_stages;
create trigger trg_guard_locked_stage
  before update on pipeline_stages
  for each row execute function guard_locked_stage();

-- ----- 2. Every listing gets an Interviewing column -----
-- Position 500 puts it between Applied (0) and Offered (1000). Unlike the
-- anchors it is NOT locked: employers can rename, recolor, reorder or delete
-- it. The interview sync below degrades gracefully if they delete it.
insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
select l.id, 'Interviewing', '#ede9fe', '#5b21b6', 500, 'interviewing', false
from internship_listings l
where not exists (
  select 1 from pipeline_stages ps
  where ps.listing_id = l.id and ps.stage_type = 'interviewing'
);

create or replace function seed_pipeline_stages_for_listing()
returns trigger as $$
begin
  insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
  values
    (new.id, 'Applied',      '#e0e7ff', '#3730a3', 0,    'applied',      true),
    (new.id, 'Interviewing', '#ede9fe', '#5b21b6', 500,  'interviewing', false),
    (new.id, 'Offered',      '#d1fae5', '#065f46', 1000, 'offered',      true);
  return new;
end;
$$ language plpgsql security definer;

-- ----- 3. Interview state drives the board -----

-- Where the candidate sat before the interview moved them, so declining puts
-- them back where they were instead of dumping everyone into "Applied".
alter table applications
  add column if not exists previous_stage_id uuid references pipeline_stages(id) on delete set null;

-- Move an application into the stage matching `target_type` for its own
-- listing. security definer because both sides of the interview flow call it:
-- the employer schedules, the student declines, and neither has RLS write
-- access to the other's view of the row.
create or replace function move_application_to_stage_type(
  p_application_id uuid,
  p_target_type text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_listing_id uuid;
  v_current    uuid;
  v_target     uuid;
begin
  select listing_id, stage_id into v_listing_id, v_current
  from applications where id = p_application_id;
  if v_listing_id is null then return; end if;

  select id into v_target
  from pipeline_stages
  where listing_id = v_listing_id and stage_type = p_target_type
  order by position
  limit 1;

  -- Employer deleted that column — leave the candidate where they are rather
  -- than guessing at a destination.
  if v_target is null or v_target = v_current then return; end if;

  update applications
     set previous_stage_id = v_current,
         stage_id = v_target
   where id = p_application_id;
end;
$$;

-- Scheduling an interview advances the candidate to Interviewing — but only
-- from the early stages. Someone already at Offered (or explicitly Rejected)
-- keeps their stage; a follow-up interview shouldn't walk them backwards.
create or replace function sync_stage_on_interview_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_type text;
begin
  if new.application_id is null then return new; end if;

  select ps.stage_type into v_current_type
  from applications a
  left join pipeline_stages ps on ps.id = a.stage_id
  where a.id = new.application_id;

  if v_current_type is null or v_current_type in ('applied', 'reviewing') then
    perform move_application_to_stage_type(new.application_id, 'interviewing');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_stage_on_interview_created on interview_schedules;
create trigger trg_sync_stage_on_interview_created
  after insert on interview_schedules
  for each row execute function sync_stage_on_interview_created();

-- Declining or cancelling an interview walks the candidate back to whichever
-- stage they came from. Only fires when they are still sitting in the
-- Interviewing column — if the employer has since moved them on, that decision
-- wins. Guarded on a live interview remaining: a candidate with two pending
-- invites shouldn't leave Interviewing because one was declined.
create or replace function sync_stage_on_interview_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_type text;
  v_previous     uuid;
  v_still_live   int;
begin
  if new.application_id is null then return new; end if;
  if new.status not in ('declined', 'cancelled') then return new; end if;
  if old.status = new.status then return new; end if;

  select count(*) into v_still_live
  from interview_schedules
  where application_id = new.application_id
    and id <> new.id
    and status in ('pending', 'accepted', 'reschedule_requested');
  if v_still_live > 0 then return new; end if;

  select ps.stage_type, a.previous_stage_id into v_current_type, v_previous
  from applications a
  left join pipeline_stages ps on ps.id = a.stage_id
  where a.id = new.application_id;

  if v_current_type is distinct from 'interviewing' then return new; end if;

  -- Fall back to the Applied anchor if the original column is gone.
  if v_previous is null or not exists (select 1 from pipeline_stages where id = v_previous) then
    perform move_application_to_stage_type(new.application_id, 'applied');
  else
    update applications
       set stage_id = v_previous,
           previous_stage_id = null
     where id = new.application_id;
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_stage_on_interview_closed on interview_schedules;
create trigger trg_sync_stage_on_interview_closed
  after update of status on interview_schedules
  for each row execute function sync_stage_on_interview_closed();

-- ----- 4. Backfill candidates stranded by the old raw-status writes -----
-- Anyone with a live interview belongs in Interviewing regardless of what the
-- legacy status text says.
update applications a
set previous_stage_id = a.stage_id,
    stage_id = ps.id
from pipeline_stages ps
where ps.listing_id = a.listing_id
  and ps.stage_type = 'interviewing'
  and a.stage_id is distinct from ps.id
  and exists (
    select 1 from interview_schedules i
    where i.application_id = a.id
      and i.status in ('pending', 'accepted', 'reschedule_requested')
  )
  and coalesce(
        (select ps2.stage_type from pipeline_stages ps2 where ps2.id = a.stage_id),
        'applied'
      ) in ('applied', 'reviewing');

-- Re-sync the denormalized status mirror for every row this migration moved.
update applications a
set status = ps.label
from pipeline_stages ps
where ps.id = a.stage_id
  and a.status is distinct from ps.label;
