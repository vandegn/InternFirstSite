-- ============================================
-- Career events feed finder — daily run via pg_cron + pg_net
-- ============================================
-- Same pattern (and the same two Vault secrets) as
-- 20261009_career_events_cron.sql. Each run checks a handful of schools:
-- ones never checked first (so a new school is looked at within a day of its
-- first student signing up), then ones last checked more than 30 days ago.
--
-- Prerequisite: 20261117_feed_discovery.sql is applied.

create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'career-events-feed-discovery',
  '23 9 * * *',   -- 09:23 UTC daily
  $cron$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'invoicing_app_url')
           || '/api/career-events/discover',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'invoicing_cron_secret')
    ),
    body := '{}'::jsonb,
    timeout_milliseconds := 120000
  );
  $cron$
);

-- Inspect / manage:
--   select jobid, schedule, jobname, active from cron.job;
--   select cron.unschedule('career-events-feed-discovery');
