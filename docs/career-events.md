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

## Known limitations

- **No scraping, no paid APIs.** Coverage depends entirely on which feeds an admin registers.
- **Location means state.** `us-schools.json` has no city or coordinates, so "nearby" means the same state. The `latitude`/`longitude` columns exist but aren't used yet.
- **RRULE is not expanded.** Only the first occurrence of a recurring series is imported. Localist and most campus platforms emit one VEVENT per occurrence, so this rarely matters. `RECURRENCE-ID` overrides are kept as separate rows.
- **Time zones.** `VTIMEZONE` blocks are ignored. Times are resolved from the IANA or Windows `TZID` through `Intl`, or the source's default zone for floating times.
- **Sync overwrites edits.** Admin edits to a synced event's details (title, time, category and so on) are replaced on the next sync. Only `is_major` sticks. Events removed from a feed are not deleted, but they age out of view.
- **Notifications go to the in-app bell only.** No email yet.
- **Redirects aren't re-checked.** The fetcher follows redirects without checking the redirect target against the private-network rule. Only admins can register URLs.

## Future options

- Paid or regional event APIs (Eventbrite, PredictHQ, Ticketmaster Discovery, Meetup) for local events, mapped into the same `career_events` shape with their own `origin`.
- School city/coordinates (IPEDS has them) for radius-based "near me" instead of state.
- Handshake or career-center partnerships for authenticated feeds.
- Email digests of upcoming favorited and major events through Resend.
- Students submitting events for admin approval.
