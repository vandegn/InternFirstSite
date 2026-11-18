# Career Events

An auto-updating calendar of career events for students: their own campus's events, events across their school's state, and online events open to everyone. Students can favorite events and get notified.

## How it works

- **Sources.** An admin registers iCal (`.ics` / `webcal://`) feeds on `/dashboard/admin/events`. Each feed is tagged to **one school** (campus events, from the same Department of Education list as `students.school_id`) or to a **state, optionally with a city** (local events). Most campus calendar platforms publish iCal: Localist, Presence, CampusGroups, Engage, 25Live, and Google/Outlook calendars.
- **Sync.** `POST /api/career-events/sync` fetches every active feed (15s timeout, 5 MB cap). It parses the feed with the small reader in `lib/career-events.ts` and upserts events by `(source_id, external_id)`, so re-running is idempotent. Each feed is handled on its own: a feed that fails records `last_error` on its source and the others still sync. Only events from the last 24h through the next 180 days are imported. If a source has **keywords** set, only events that mention one of them are imported, which lets you narrow a general campus feed to career events.
- **Relevance** (`eventScopeFor`):
  - *campus*: the event's `school_id` equals the student's.
  - *local*: the event has no school, and its `state` matches the student's `school_state`.
  - *online*: the event has neither a school nor a state.
  - Campus events from other schools are hidden, even when they're in the same state.
- **Categories.** Each event's category is guessed from its title, description and categories (career fair, info session, workshop, networking, employer event). If nothing matches, the source's default category is used.
- **Major events.** Admins toggle `is_major`. Career fairs from feeds start out major (a DB trigger runs on insert only). The sync never overwrites `is_major`, so an admin's choice survives re-syncs.
- **Notifications.** They're written during the same sync run, using the service role:
  - *Favorite reminder*: a favorited event that starts within the next 24h. With an hourly cron, it arrives about 24h ahead.
  - *New major event*: an upcoming major event that was flagged major in the last 72h. It goes to every student it's relevant to, at most 5 per student per run.
  - Each notification claims a row in `career_event_notifications` (primary key: user, event, kind) before the bell notification is inserted. That means a notification is never sent twice, even if two runs overlap.
  - Students can turn off either kind on the Career Events page (`career_event_preferences`). The settings page's notification toggles aren't saved anywhere yet, so they aren't used here.

Code layout follows the interview-availability seam:

| File | Role |
|---|---|
| `lib/career-events.ts` | Pure logic: iCal parsing, normalization, relevance, notification planning |
| `lib/career-events-service.ts` | Sync and notification flow against a `CareerEventsRepo` seam, plus the HTTP feed fetcher |
| `lib/career-events-repo.ts` | Supabase (service-role) repo |
| `lib/career-events-client.ts` | Browser helpers (RLS-scoped) for the student and admin pages |
| `app/api/career-events/sync/route.ts` | Cron or admin entry point |
| `app/dashboard/student/events/page.tsx` | Student list, calendar and favorites |
| `app/dashboard/admin/events/page.tsx` | Admin sources and events |

Tests: `lib/career-events.test.ts` and `lib/career-events-flow.test.ts`.

## Setup

1. Apply `supabase/migrations/20261009_career_events.sql`. It adds the tables and RLS, and adds `career_event` to `notifications_type_check`.
2. Make sure the app environment has `CRON_SECRET` and `SUPABASE_SERVICE_ROLE_KEY`. Without the service role key, the sync returns 503.
3. Schedule the hourly sync by applying `supabase/migrations/20261009_career_events_cron.sql` (pg_cron + pg_net). It reuses the Vault secrets `invoicing_app_url` and `invoicing_cron_secret` from the PPA invoicing cron, so create them first if they don't exist.
   - Alternative: a Vercel cron that calls `GET /api/career-events/sync`. The route accepts `Authorization: Bearer $CRON_SECRET`. Vercel Hobby only allows daily crons, so reminders would be less precise.
4. Add sources on `/dashboard/admin/events` and press **Sync now**.

## Adding a source

Look for "Subscribe", "iCal", "Export" or "Add to calendar" on the career center's events page. Localist feeds usually look like `https://calendar.<school>.edu/calendar.ics`, and they also have filtered versions such as `/api/2/events?...&format=ics` or per-department `.ics` links. Prefer the career center's own feed. Otherwise, use the general campus feed with keywords such as `career, internship, employer, recruit, resume`. `localhost` and private-network URLs are rejected.

## Add to calendar

Each event card has an **Add to calendar** menu. **Google Calendar** opens Google's new-event page with the title, time, place and links filled in. **Apple / Outlook** downloads a one-event `.ics` file. Both are built in the browser from the event row (`lib/event-calendar-export.ts`, UI in `components/AddToCalendar.tsx`), and nothing is stored. Timed events with no end are shown as an hour long. All-day events use the event's local date, with an exclusive end. "Event details" and "Join online" are underlined links with an open-in-new-tab icon.

## Feed finder (adds feeds automatically)

`/api/career-events/discover` looks for public iCal feeds at the schools our students attend and **adds the useful ones as event sources on its own**. Each new source is tagged to its school, so only that school's students ever see its events. The route then pulls the new feeds' events right away. Notifications for them go out on the next hourly sync.

- **Which schools.** Each school's domain comes from its students' `.edu` emails (`kenan-flagler.unc.edu` → `unc.edu`, picking the most common one). Each run checks up to 5 schools: never-checked ones first, then ones last checked more than 30 days ago. A daily pg_cron job runs it. `feed_discovery_checks` records every check. Schools where nothing was found are listed on the admin page so they can be added by hand. **Check a school** runs the finder for any school and domain.
- **Where it looks.** Guessed addresses: Engage `<slug>.campuslabs.com/engage/events.ics`, Localist `calendar.<domain>/calendar.ics` and `events.<domain>/calendar.ics`, LiveWhale `/live/ical/events`, and The Events Calendar `careers.<domain>/events/?ical=1`. It also scans `events.`, `calendar.`, `www.<domain>/events/` and the career-center events pages for `.ics`/`webcal` links and platform fingerprints: a Localist page, a Trumba embed's `webName`, 25Live Publisher and Engage links.
- **What gets added (`planAutoAdd`).** A feed must parse as iCal and have upcoming events. Counts come from `eventsFromFeed`, the function the sync itself uses. If fewer than half a feed's events are career-related, it is added with the `CAREER_KEYWORDS` filter. A feed that would import nothing is skipped. Each site gets one feed, the one that imports the most, because Localist serves the same calendar at several addresses. A site that already has a source is skipped. The same feed at two addresses is counted once.
- **Duplicates across feeds.** A school's Engage and campus calendar often both list the career fair. `relevantEventsForStudent` shows the same title at the same start time once.
- **The log.** `feed_candidates` records every feed found: `approved` means added (with `source_id`), `dismissed` means skipped, and `note` says why. A logged feed is never added again, so removing or pausing a source on the admin page sticks. Skipped feeds have an **Add anyway** button under Feed finder.
- **Safety.** Redirects are followed by hand, and each hop is re-checked against `normalizeFeedUrl`. Requests have an 8-second timeout and a 5 MB cap, run at most 4 at a time per school, and send a `InternFirst-FeedFinder/1.0` user agent.
- **Code.** Pure rules: `lib/feed-discovery.ts`. Flow: `feed-discovery-service.ts`, against the `FeedDiscoveryRepo` seam. Database layer (service role, creates sources): `-repo.ts`. Browser helpers: `-client.ts`. UI: `app/dashboard/admin/events/FeedSuggestions.tsx`. Auth is shared with the sync through `lib/cron-or-admin-auth.ts`.
- **Setup.** Apply `migrations/20261117_feed_discovery.sql`, then `20261117_feed_discovery_auto_add.sql`. The daily run is `20261117_feed_discovery_cron.sql`. All three are applied in production as of 2026-11-17.

## Known limitations

- **No scraping, no paid APIs.** Coverage depends on the feeds the finder can locate at standard addresses, plus any an admin registers by hand.
- **Location means state.** `us-schools.json` has no city or coordinates, so "nearby" means the same state. The `latitude`/`longitude` columns exist but aren't used yet.
- **RRULE is not expanded.** Only the first occurrence of a recurring series is imported. Localist and most campus platforms emit one VEVENT per occurrence, so this rarely matters. `RECURRENCE-ID` overrides are kept as separate rows.
- **Time zones.** `VTIMEZONE` blocks are ignored. Times are resolved from the IANA or Windows `TZID` through `Intl`, or the source's default zone for floating times.
- **Sync overwrites edits.** Admin edits to a synced event's details (title, time, category and so on) are replaced on the next sync. Only `is_major` sticks. Events removed from a feed are not deleted, but they age out of view.
- **Notifications go to the in-app bell only.** No email yet.
- **Redirects aren't re-checked by the sync.** The sync fetcher follows redirects without checking the target against the private-network rule. Only admins can register URLs. The feed finder's fetcher does re-check every hop.

## Future options

- Paid or regional event APIs (Eventbrite, PredictHQ, Ticketmaster Discovery, Meetup) for local events, mapped into the same `career_events` shape with their own `origin`.
- School city/coordinates (IPEDS has them) for radius-based "near me" instead of state.
- Handshake or career-center partnerships for authenticated feeds.
- Email digests of upcoming favorited and major events through Resend.
- Students submitting events for admin approval.
