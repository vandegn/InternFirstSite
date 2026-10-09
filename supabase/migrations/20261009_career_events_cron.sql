-- ============================================
-- Career events — hourly sync via pg_cron + pg_net
-- ============================================
-- Same pattern as 20260629_ppa_invoicing_cron.sql: the database calls the
-- deployed app's /api/career-events/sync endpoint, authenticated with the
-- x-cron-secret header (must equal CRON_SECRET in the app's environment).
-- Hourly so the "starts in ~24h" favorite reminder lands close to 24h out.
--
-- Prerequisite: 20261009_career_events.sql is applied, and the Vault secrets
-- below exist. The URL must be the PUBLIC deployed app, not localhost.

create extension if not exists pg_cron;
create extension if not exists pg_net;

-- RUN ONCE (skip if they already exist — the invoicing cron may have created
-- them; this job reuses the same two secrets):
--
--   select vault.create_secret('https://www.intern-first.com', 'invoicing_app_url');
--   select vault.create_secret('<your CRON_SECRET>',            'invoicing_cron_secret');

select cron.schedule(
  'career-events-sync',
  '7 * * * *',   -- minute 7 of every hour, UTC
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'invoicing_app_url')
           || '/api/career-events/sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'invoicing_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 60000
  );
  $cron$
);

-- Inspect / manage:
--   select jobid, schedule, jobname, active from cron.job;
--   select * from net._http_response order by created desc limit 10;
--   select cron.unschedule('career-events-sync');
