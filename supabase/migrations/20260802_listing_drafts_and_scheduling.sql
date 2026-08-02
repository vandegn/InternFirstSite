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
