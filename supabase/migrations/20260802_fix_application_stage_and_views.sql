-- ============================================
-- Fix: applicants invisible on the pipeline, and view counts stuck at zero
-- ============================================
--
-- Two separate reports with one thing in common: the write silently did
-- nothing and no layer complained.
--
--  1. New applications were inserted with stage_id = NULL. The pipeline board
--     renders each column as `apps.filter(a => a.stage_id === col.id)`, so a
--     NULL stage put the candidate in no column at all -- the employer saw an
--     applicant count of 1 above an empty board. 2026-06-24-pipeline-stages
--     backfilled stage_id once and added a trigger that seeds stages for new
--     *listings*, but nothing ever assigned a stage to a new *application*.
--
--  2. listing_views had zero rows despite real traffic. The client called
--     `upsert(..., { onConflict, ignoreDuplicates: true })` inside a
--     `.catch(() => {})` with no error check, so any failure was invisible.
--     Moving the write behind a security-definer RPC removes the whole class
--     of problem: the conflict target lives in SQL next to the index that
--     enforces it, and the function can't be silently defeated by RLS.

-- ============================================
-- 1. Applications land in their listing's "Applied" column
-- ============================================

create or replace function set_default_application_stage()
returns trigger as $$
declare
  applied_stage record;
begin
  if new.stage_id is not null then
    return new;
  end if;

  -- Prefer the locked "applied" anchor. Fall back to the lowest-positioned
  -- stage so an application still lands somewhere visible on a board whose
  -- anchor was somehow removed.
  select id, label into applied_stage
  from pipeline_stages
  where listing_id = new.listing_id
  order by (stage_type = 'applied') desc, position asc
  limit 1;

  if applied_stage.id is not null then
    new.stage_id := applied_stage.id;
    new.status := applied_stage.label;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Fires before trg_sync_application_status (triggers of the same timing run in
-- alphabetical order, and 'd' < 's'), so that trigger sees the stage we just
-- assigned. We set status here as well so correctness doesn't depend on it.
drop trigger if exists trg_default_application_stage on applications;
create trigger trg_default_application_stage
  before insert on applications
  for each row execute function set_default_application_stage();

-- Backfill anything already stranded outside a column.
update applications a
set stage_id = ps.id
from pipeline_stages ps
where ps.listing_id = a.listing_id
  and ps.stage_type = 'applied'
  and a.stage_id is null;

update applications a
set status = ps.label
from pipeline_stages ps
where ps.id = a.stage_id
  and a.status is distinct from ps.label;

-- Any listing missing its locked anchors (created before the seeding trigger,
-- or left over from a partial run) gets them now, so the trigger above always
-- has something to point at.
insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
select il.id, 'Applied', '#e0e7ff', '#3730a3', 0, 'applied', true
from internship_listings il
where not exists (
  select 1 from pipeline_stages ps
  where ps.listing_id = il.id and ps.stage_type = 'applied'
);

insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
select il.id, 'Offered', '#d1fae5', '#065f46', 1000, 'offered', true
from internship_listings il
where not exists (
  select 1 from pipeline_stages ps
  where ps.listing_id = il.id and ps.stage_type = 'offered'
);

-- ============================================
-- 2. View tracking that can't fail quietly
-- ============================================
-- One row per account per listing -- idx_listing_views_unique_viewer is what
-- enforces that, and this function names the same conflict target. Repeat
-- visits are deliberate no-ops: the number is unique viewers, which is what
-- makes the view -> applicant rate on posted-jobs meaningful.
--
-- security definer so a future tightening of the listing_views insert policy
-- can't turn view tracking back into a silent no-op.

create or replace function record_listing_view(p_listing_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    return;
  end if;

  insert into listing_views (listing_id, viewer_id)
  values (p_listing_id, auth.uid())
  on conflict (listing_id, viewer_id) do nothing;
end;
$$;

revoke all on function record_listing_view(uuid) from public;
grant execute on function record_listing_view(uuid) to authenticated;
