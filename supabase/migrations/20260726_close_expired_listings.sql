-- ============================================
-- Expired-listing cleanup: stop PPA charges on expired/inactive listings
-- ============================================
-- Listings past their application_deadline stay status='active' in the DB even
-- though students can no longer find them in browse (getActiveListings filters
-- them out). A student with a direct link could still apply, and
-- handle_new_application would bill PPA employers for an applicant to a dead
-- listing. Three fixes, defense in depth:
--   1. handle_new_application only charges when the listing is active and not
--      past deadline (airtight regardless of cron timing).
--   2. A daily pg_cron job flips expired active listings to 'closed'.
--   3. One-time backfill closes listings that have already expired.

-- 1. Charge guard: only bill PPA for applications to live listings.
create or replace function handle_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model       text;
  v_cpa         int;
  v_employer_id uuid;
  v_status      text;
  v_deadline    date;
begin
  select pricing_model, cpa_cents, employer_id, status, application_deadline
    into v_model, v_cpa, v_employer_id, v_status, v_deadline
  from internship_listings
  where id = new.listing_id;

  update internship_listings
    set applicant_count = applicant_count + 1
  where id = new.listing_id;

  if v_model = 'ppa'
     and v_status = 'active'
     and (v_deadline is null or v_deadline >= current_date)
     and coalesce(new.match_score, 0) >= 70 then
    insert into applicant_charges (listing_id, employer_id, application_id, billing_period, amount_cents)
    values (new.listing_id, v_employer_id, new.id, date_trunc('month', now())::date, coalesce(v_cpa, 1609))
    on conflict (application_id) do nothing;
  end if;

  return new;
end;
$$;

-- 2. Daily auto-close. pg_cron runs SQL inside the database, so no HTTP/secrets
--    needed. 06:00 UTC daily; cron.schedule upserts by name, safe to re-run.
create extension if not exists pg_cron;

select cron.schedule(
  'close-expired-listings',
  '0 6 * * *',
  $cron$
  update internship_listings
     set status = 'closed', updated_at = now()
   where status = 'active'
     and application_deadline is not null
     and application_deadline < current_date
  $cron$
);

-- 3. Backfill: close anything already expired.
update internship_listings
   set status = 'closed', updated_at = now()
 where status = 'active'
   and application_deadline is not null
   and application_deadline < current_date;

-- Inspect / manage:
--   select jobid, schedule, jobname, active from cron.job;
--   select cron.unschedule('close-expired-listings');   -- to remove
