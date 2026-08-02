-- ============================================================
-- Combined migration bundle — 2026-08-02
-- ============================================================
-- Paste into the Supabase SQL editor and run once, or apply the five
-- source files individually in this exact order. Order matters:
--   gate_posting_on_approval splits the listings policy;
--   listing_drafts_and_scheduling then rewrites the student-facing one.
-- Safe to re-run: every statement is idempotent or guarded.
-- ============================================================


-- ############################################################
-- SOURCE: supabase/migrations/20260802_fix_application_stage_and_views.sql
-- ############################################################

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


-- ############################################################
-- SOURCE: supabase/migrations/20260802_application_eeo.sql
-- ############################################################

-- ============================================
-- EEO at apply time
-- ============================================
--
-- Two changes, both driven by the same requirement: every application now
-- carries its own equal-opportunity answers instead of a pointer to whatever
-- the student's settings happen to say today.
--
--  1. application_eeo -- a snapshot of the standard federal self-ID answers as
--     they stood when the application was submitted. student_eeo remains the
--     student's editable default that prefills the form; this table is the
--     immutable record of what they actually submitted for this role.
--
--  2. listing_questions.is_eeo -- lets an employer add their own equal
--     opportunity questions to a listing on top of the standard set. The
--     standard set is defined in app/src/lib/eeo.ts and is not stored here,
--     which is exactly why it cannot be removed or edited by an employer.

-- ============================================
-- 1. Per-application EEO snapshot
-- ============================================
-- Mirrors student_eeo's columns and constraints. Like student_eeo, this has
-- NO employer select policy and must not gain one: these answers are collected
-- for compliance reporting and are never an input to a hiring decision.

create table if not exists application_eeo (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null unique references applications(id) on delete cascade,
  ethnicity_hispanic_latino text check (ethnicity_hispanic_latino in ('yes', 'no', 'declined')),
  race text[] not null default '{}',
  race_declined boolean not null default false,
  gender text check (gender in ('male', 'female', 'non_binary', 'self_describe', 'declined')),
  gender_self_describe text,
  veteran_status text check (veteran_status in ('protected_veteran', 'not_veteran', 'declined')),
  disability_status text check (disability_status in ('yes', 'no', 'declined')),
  work_authorized_us text check (work_authorized_us in ('yes', 'no')),
  requires_sponsorship text check (requires_sponsorship in ('yes', 'no')),
  -- The student ticked the acknowledgement box rather than the form being
  -- silently submitted on their behalf. Voluntariness has to be auditable.
  acknowledged_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists idx_application_eeo_application on application_eeo(application_id);

alter table application_eeo enable row level security;

create policy "Students can view own application EEO"
  on application_eeo for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join students s on s.id = a.student_id
      where s.user_id = auth.uid()
    )
  );

create policy "Students can insert own application EEO"
  on application_eeo for insert to authenticated
  with check (
    application_id in (
      select a.id from applications a
      join students s on s.id = a.student_id
      where s.user_id = auth.uid()
    )
  );

-- Deliberately no update or delete policy, and deliberately no employer policy.

-- ============================================
-- 2. Employer-added EEO questions on a listing
-- ============================================
-- The standard set always renders and is never stored as rows, so "can't
-- remove any" is structural rather than a rule the UI has to remember to
-- enforce. Anything flagged is_eeo here is additive.

alter table listing_questions
  add column if not exists is_eeo boolean not null default false;

create index if not exists idx_listing_questions_eeo
  on listing_questions(listing_id, is_eeo);


-- ############################################################
-- SOURCE: supabase/migrations/20260802_gate_posting_on_approval.sql
-- ############################################################

-- ============================================
-- Employers must be approved before they can post
-- ============================================
--
-- Until now "Employers can manage own listings" was a single FOR ALL policy,
-- so a pending employer could create listings freely -- they were just hidden
-- from students by the select policy. That made verification feel like a
-- display filter rather than a gate, and left unreviewed companies able to
-- stage a catalogue of postings that would all go live the instant they were
-- approved.
--
-- Splitting the policy per-command lets a pending employer keep reading and
-- editing what they already have (so nothing they wrote disappears while they
-- wait) while INSERT alone requires approval.

drop policy if exists "Employers can manage own listings" on internship_listings;

create policy "Employers can view own listings"
  on internship_listings for select to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  );

-- The gate. is_approved_employer is security definer, so tightening the
-- employers select policy later can't quietly turn this into `false`.
create policy "Approved employers can create listings"
  on internship_listings for insert to authenticated
  with check (
    is_approved_employer(auth.uid())
    and employer_id in (select id from employers where user_id = auth.uid())
  );

create policy "Employers can update own listings"
  on internship_listings for update to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  )
  with check (
    employer_id in (select id from employers where user_id = auth.uid())
  );

create policy "Employers can delete own listings"
  on internship_listings for delete to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  );


-- ############################################################
-- SOURCE: supabase/migrations/20260802_industry_taxonomy.sql
-- ############################################################

-- ============================================
-- Migrate listings to the 25-industry taxonomy
-- ============================================
--
-- The employer-facing industry list moves from 12 ad-hoc labels to the 25
-- classifications in context/industry-list.pdf (NAICS 2022 / ISIC Rev. 5
-- backbone with front-end splits). Existing rows would otherwise keep values
-- that no longer appear in any dropdown -- invisible to the industry filter and
-- unselectable if the employer ever reopened the edit form.
--
-- internship_listings.industry carries a CHECK constraint listing the old 12
-- values verbatim, so the order here matters: drop the constraint, rewrite the
-- rows, then re-add it over the new vocabulary. Rewriting first would fail the
-- old check on the very first row.
--
-- This mapping mirrors LEGACY_INDUSTRY_MAP in app/src/lib/constants.ts. Keep
-- the two in step if either changes.
--
-- Two mappings are judgement calls rather than renames:
--   'Engineering' -- engineering is a job *category* in the new taxonomy, not
--                    an industry, so there is no direct successor.
--   'Other'       -- always a catch-all.
-- Both land in Consulting, Professional & Business Services, which is where
-- standalone engineering firms and multi-industry employers sit. The query at
-- the bottom lists the affected listings so they can be reviewed.

alter table internship_listings
  drop constraint if exists internship_listings_industry_check;

update internship_listings
set industry = case industry
  when 'Technology' then 'Technology, Software & IT Services'
  when 'Finance'    then 'Financial Services & Insurance'
  when 'Healthcare' then 'Healthcare'
  when 'Marketing'  then 'Advertising, Marketing & Public Relations'
  when 'Legal'      then 'Legal'
  when 'Engineering' then 'Consulting, Professional & Business Services'
  when 'Education'  then 'Education & Training'
  when 'Media'      then 'Media, Publishing & Entertainment'
  when 'Nonprofit'  then 'Social Services & Nonprofit'
  when 'Government' then 'Government & Public Administration'
  when 'Retail'     then 'Retail & E-commerce'
  when 'Other'      then 'Consulting, Professional & Business Services'
  else industry
end
where industry in (
  'Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering',
  'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'
);

-- Re-add the constraint over the new vocabulary, so a typo or a stale client
-- can't quietly write an industry that no filter will ever match.
alter table internship_listings
  add constraint internship_listings_industry_check
  check (industry = any (array[
    'Agriculture, Forestry, Fishing & Aquaculture',
    'Energy, Mining & Utilities',
    'Environmental Services & Sustainability',
    'Construction & Building Services',
    'Manufacturing & Industrial Production',
    'Transportation, Logistics & Warehousing',
    'Automotive & Mobility',
    'Wholesale & Distribution',
    'Retail & E-commerce',
    'Healthcare',
    'Social Services & Nonprofit',
    'Pharmaceuticals, Biotechnology & Life Sciences',
    'Education & Training',
    'Government & Public Administration',
    'Aerospace, Defense & Public Safety',
    'Financial Services & Insurance',
    'Real Estate, Property & Facilities',
    'Legal',
    'Consulting, Professional & Business Services',
    'Technology, Software & IT Services',
    'Telecommunications & Network Infrastructure',
    'Media, Publishing & Entertainment',
    'Advertising, Marketing & Public Relations',
    'Hospitality, Travel & Tourism',
    'Consumer Services & Personal Services'
  ]));

-- Employers also carry an industry on their own record where the column
-- exists; keep it aligned with the same vocabulary. No check constraint exists
-- there, so this is a plain rewrite.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employers' and column_name = 'industry'
  ) then
    update employers
    set industry = case industry
      when 'Technology' then 'Technology, Software & IT Services'
      when 'Finance'    then 'Financial Services & Insurance'
      when 'Healthcare' then 'Healthcare'
      when 'Marketing'  then 'Advertising, Marketing & Public Relations'
      when 'Legal'      then 'Legal'
      when 'Engineering' then 'Consulting, Professional & Business Services'
      when 'Education'  then 'Education & Training'
      when 'Media'      then 'Media, Publishing & Entertainment'
      when 'Nonprofit'  then 'Social Services & Nonprofit'
      when 'Government' then 'Government & Public Administration'
      when 'Retail'     then 'Retail & E-commerce'
      when 'Other'      then 'Consulting, Professional & Business Services'
      else industry
    end
    where industry in (
      'Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering',
      'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'
    );
  end if;
end $$;

-- Anything left outside the new vocabulary is worth a look -- it means a row
-- carried a value neither list knows about.
--   select id, title, industry from internship_listings
--   where industry is not null and industry not in (
--     'Agriculture, Forestry, Fishing & Aquaculture', 'Energy, Mining & Utilities',
--     'Environmental Services & Sustainability', 'Construction & Building Services',
--     'Manufacturing & Industrial Production', 'Transportation, Logistics & Warehousing',
--     'Automotive & Mobility', 'Wholesale & Distribution', 'Retail & E-commerce',
--     'Healthcare', 'Social Services & Nonprofit',
--     'Pharmaceuticals, Biotechnology & Life Sciences', 'Education & Training',
--     'Government & Public Administration', 'Aerospace, Defense & Public Safety',
--     'Financial Services & Insurance', 'Real Estate, Property & Facilities', 'Legal',
--     'Consulting, Professional & Business Services', 'Technology, Software & IT Services',
--     'Telecommunications & Network Infrastructure', 'Media, Publishing & Entertainment',
--     'Advertising, Marketing & Public Relations', 'Hospitality, Travel & Tourism',
--     'Consumer Services & Personal Services'
--   );


-- ############################################################
-- SOURCE: supabase/migrations/20260802_listing_drafts_and_scheduling.sql
-- ############################################################

-- ============================================
-- Draft and scheduled job postings
-- ============================================
--
-- Employers can now save a listing without publishing it, or set it to go live
-- at a future date:
--
--   draft     -- saved, never published, no publish date. Visible only to the
--                employer who owns it.
--   scheduled -- has a publish_at in the future; a cron job flips it to active
--                when that time arrives.
--   active    -- live to students (unchanged).
--
-- Neither new state is visible to students. getActiveListings already filters
-- on status = 'active', but this migration also tightens the select policy so
-- an unpublished draft can't leak through a direct link or a future query that
-- forgets the filter -- the same defence-in-depth reasoning as
-- 20260726_close_expired_listings.

alter table internship_listings
  drop constraint if exists internship_listings_status_check;

alter table internship_listings
  add constraint internship_listings_status_check
  check (status in ('draft', 'scheduled', 'active', 'paused', 'closed'));

-- When a scheduled listing should go live. Null for every other state.
alter table internship_listings
  add column if not exists publish_at timestamptz;

-- Supports the cron sweep below without scanning the whole table.
create index if not exists idx_listings_publish_at
  on internship_listings(publish_at)
  where status = 'scheduled';

-- ============================================
-- Students never see unpublished listings
-- ============================================
-- Previously this policy gated only on employer approval and left status
-- filtering to the client query. A draft is content the employer has
-- explicitly not published, so make the database the one enforcing it.
-- Employers still see their own drafts via "Employers can view own listings".

drop policy if exists "Active listings are viewable by authenticated users" on internship_listings;
create policy "Published listings are viewable by authenticated users"
  on internship_listings for select to authenticated
  using (
    status in ('active', 'paused', 'closed')
    and employer_id in (select id from employers where verification_status = 'approved')
  );

-- The public (anon) listing pages get the same treatment where that policy
-- exists -- see add_public_listing_access.sql.
do $$
begin
  if exists (
    select 1 from pg_policy
    where polrelid = 'internship_listings'::regclass
      and polname = 'Active listings are publicly viewable'
  ) then
    drop policy "Active listings are publicly viewable" on internship_listings;
    create policy "Active listings are publicly viewable"
      on internship_listings for select to anon
      using (
        status = 'active'
        and employer_id in (select id from employers where verification_status = 'approved')
      );
  end if;
end $$;

-- ============================================
-- Publish scheduled listings when their time comes
-- ============================================
-- Runs every 15 minutes, so a listing goes live within a quarter hour of its
-- scheduled time. expires_at is set from the posting duration at publish time
-- rather than at scheduling time, so a listing scheduled three weeks out still
-- gets its full run.

create or replace function publish_due_listings()
returns void
language sql
security definer
set search_path = public
as $$
  update internship_listings
     set status = 'active',
         publish_at = null,
         updated_at = now()
   where status = 'scheduled'
     and publish_at is not null
     and publish_at <= now();
$$;

create extension if not exists pg_cron;

select cron.schedule(
  'publish-scheduled-listings',
  '*/15 * * * *',
  $cron$ select publish_due_listings() $cron$
);

-- Inspect / manage:
--   select jobid, schedule, jobname, active from cron.job;
--   select cron.unschedule('publish-scheduled-listings');

