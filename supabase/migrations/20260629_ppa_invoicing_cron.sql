-- ============================================
-- PPA monthly invoicing — Supabase pg_cron schedule
-- ============================================
-- Schedules a monthly job that POSTs to the app's /api/billing/invoice-ppa
-- endpoint, which bills all *closed* PPA billing periods (everything before the
-- current month). The endpoint authenticates the call with the x-cron-secret
-- header (must match CRON_SECRET in the app's environment).
--
-- pg_cron + pg_net run inside the database and call out over HTTP, so the target
-- URL must be the PUBLICLY reachable deployed app (not http://localhost:3000).
-- Secrets/URL are read from Supabase Vault so they aren't hardcoded here.

-- 1. Extensions (no-ops if already enabled)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- 2. Store the app URL + cron secret in Vault. RUN THESE ONCE, replacing the
--    values, then delete/skip them on re-runs (create_secret errors on dupes):
--
--    select vault.create_secret('https://app.intern-first.com', 'invoicing_app_url');
--    select vault.create_secret('<your CRON_SECRET>',           'invoicing_cron_secret');
--
--    To rotate later: select vault.update_secret(
--      (select id from vault.secrets where name = 'invoicing_app_url'),
--      'https://new-url.com');

-- 3. Schedule: 08:00 UTC on the 1st of every month. pg_cron schedules in UTC and
--    cron.schedule upserts by job name, so this is safe to re-run.
select cron.schedule(
  'ppa-monthly-invoicing',
  '0 8 1 * *',
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'invoicing_app_url')
           || '/api/billing/invoice-ppa',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'invoicing_cron_secret')
    ),
    body := '{}'::jsonb   -- empty body → closed periods only (default)
  );
  $cron$
);

-- Inspect / manage:
--   select jobid, schedule, jobname, active from cron.job;
--   select * from cron.job_run_details order by start_time desc limit 10;
--   select cron.unschedule('ppa-monthly-invoicing');   -- to remove
