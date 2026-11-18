-- ============================================
-- CAREER EVENTS — feed finder adds feeds itself
-- ============================================
-- The finder no longer waits for an admin to approve a feed. It adds useful
-- feeds as event sources straight away (career-only filter for whole-campus
-- feeds, skips feeds that would import nothing, one feed per site), and
-- feed_candidates becomes the log of every feed it found: 'approved' = added,
-- 'dismissed' = skipped, with the reason in `note`. A logged feed is never
-- re-added, so removing a source on the admin page sticks.
--
-- Requires 20261117_feed_discovery.sql.

alter table feed_candidates add column if not exists note text;

-- Suggestions from before this change were never acted on. Forget them and
-- their schools' checks so the next run finds and adds them.
delete from feed_discovery_checks
  where school_id in (select school_id from feed_candidates where status = 'new');
delete from feed_candidates where status = 'new';

comment on table feed_candidates is
  'Every iCal feed found by /api/career-events/discover: approved = added as an event source, dismissed = skipped (reason in note). Logged feeds are never re-added.';
