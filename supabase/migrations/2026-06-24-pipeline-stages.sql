-- ============================================
-- PIPELINE STAGES (customizable CRM columns)
-- ============================================
-- Each internship_listing has its own ordered list of pipeline stages
-- (kanban columns). Employers can add, rename, recolor, reorder, and
-- delete stages per listing. applications.stage_id points at the row
-- the candidate currently sits in; the student-facing status label is
-- read from the stage.
--
-- stage_type buckets a custom stage into a canonical category so that
-- employer dashboard stats (interviewing / offered counts) keep working
-- even when employers rename or add columns.
--
-- Run this in the Supabase SQL Editor.

-- ----- pipeline_stages table -----
-- Every listing gets two LOCKED anchor stages — "Applied" at position 0
-- and "Offered" at the end. Employers add/rename/recolor/reorder/delete
-- the stages BETWEEN them. The locked flag is enforced in the UI; the DB
-- keeps the column so the seed and any future server-side checks know.
create table if not exists pipeline_stages (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  label text not null,
  color_bg text not null default '#e0e7ff',
  color_text text not null default '#3730a3',
  position int not null default 0,
  stage_type text not null default 'reviewing'
    check (stage_type in ('applied', 'reviewing', 'interviewing', 'offered', 'rejected')),
  locked boolean not null default false,
  created_at timestamptz default now() not null
);

-- Re-run safety: if an earlier version of this migration already created
-- the table without the locked column, add it.
alter table pipeline_stages add column if not exists locked boolean not null default false;

create index if not exists idx_pipeline_stages_listing
  on pipeline_stages(listing_id, position);

alter table pipeline_stages enable row level security;

-- Employers manage stages for their own listings.
drop policy if exists "Employers manage stages on own listings" on pipeline_stages;
create policy "Employers manage stages on own listings"
  on pipeline_stages for all to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  )
  with check (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- Students can read stages for listings they've applied to (so the
-- /applications page can show the current label and color).
drop policy if exists "Students read stages for own applications" on pipeline_stages;
create policy "Students read stages for own applications"
  on pipeline_stages for select to authenticated
  using (
    listing_id in (
      select a.listing_id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

-- ----- applications.stage_id -----
alter table applications
  add column if not exists stage_id uuid references pipeline_stages(id) on delete set null;

create index if not exists idx_applications_stage on applications(stage_id);

-- Drop the legacy 5-value CHECK so the denormalized status column can
-- mirror custom stage labels.
alter table applications drop constraint if exists applications_status_check;

-- ----- seed locked anchors for every existing listing -----
-- "Applied" is the always-first column (position 0).
-- "Offered" sits at the end at position 1000 so newly added columns can
-- slot in between without colliding. If an earlier run already inserted
-- stages with these stage_types, we just promote them to anchor status
-- (lock them, snap them to the boundary positions) without overwriting
-- the employer's chosen label/color.
do $$
declare
  l record;
  applied_id uuid;
  offered_id uuid;
begin
  for l in select id from internship_listings loop
    select id into applied_id from pipeline_stages
      where listing_id = l.id and stage_type = 'applied' limit 1;
    if applied_id is null then
      insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
      values (l.id, 'Applied', '#e0e7ff', '#3730a3', 0, 'applied', true);
    else
      update pipeline_stages set position = 0, locked = true where id = applied_id;
    end if;

    select id into offered_id from pipeline_stages
      where listing_id = l.id and stage_type = 'offered' limit 1;
    if offered_id is null then
      insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
      values (l.id, 'Offered', '#d1fae5', '#065f46', 1000, 'offered', true);
    else
      update pipeline_stages set position = 1000, locked = true where id = offered_id;
    end if;
  end loop;
end $$;

-- Backfill applications.stage_id from the legacy status text. Anything
-- that wasn't "offered" lands in the Applied anchor; the employer can
-- then build out custom middle columns and move candidates as needed.
update applications a
set stage_id = ps.id
from pipeline_stages ps
where ps.listing_id = a.listing_id
  and a.stage_id is null
  and (
    (a.status = 'offered' and ps.stage_type = 'offered')
    or (a.status <> 'offered' and ps.stage_type = 'applied')
  );

-- Mirror the stage label into applications.status for any older
-- consumers that still read the text field.
update applications a
set status = ps.label
from pipeline_stages ps
where ps.id = a.stage_id
  and a.status <> ps.label;

-- ----- trigger: seed locked anchors on new listings -----
create or replace function seed_pipeline_stages_for_listing()
returns trigger as $$
begin
  insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
  values
    (new.id, 'Applied', '#e0e7ff', '#3730a3', 0,    'applied', true),
    (new.id, 'Offered', '#d1fae5', '#065f46', 1000, 'offered', true);
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_seed_pipeline_stages on internship_listings;
create trigger trg_seed_pipeline_stages
  after insert on internship_listings
  for each row execute function seed_pipeline_stages_for_listing();

-- ----- trigger: keep applications.status in sync with stage label -----
create or replace function sync_application_status_from_stage()
returns trigger as $$
begin
  if new.stage_id is not null then
    select label into new.status from pipeline_stages where id = new.stage_id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_application_status on applications;
create trigger trg_sync_application_status
  before insert or update of stage_id on applications
  for each row execute function sync_application_status_from_stage();

-- When a stage is renamed, update the mirrored status on every
-- application currently in that stage.
create or replace function sync_status_on_stage_rename()
returns trigger as $$
begin
  if new.label is distinct from old.label then
    update applications set status = new.label where stage_id = new.id;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_sync_status_on_stage_rename on pipeline_stages;
create trigger trg_sync_status_on_stage_rename
  after update of label on pipeline_stages
  for each row execute function sync_status_on_stage_rename();
