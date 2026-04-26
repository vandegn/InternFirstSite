# Interview Scheduling & In-Platform Video Calls — Design

**Date:** 2026-04-26
**Status:** Approved for implementation planning

## Overview

Employers can schedule interviews with student applicants. Students accept, decline, or request a reschedule. At the scheduled time, both parties join a video call hosted on the platform via Daily.co — preserving the closed-ecosystem principle (no external Zoom/Google Meet links).

## Goals

- Employer can propose a single interview time to a student from the candidate review UI.
- Student receives an in-app notification with three response actions: Accept, Decline, Request Reschedule.
- Accepted interviews appear on both parties' dashboard calendars.
- A "Join Interview" button arms during a join window; clicking it loads an in-platform meeting room rendered with the Daily.co React SDK.
- All flows stay inside InternFirst — no external links.

## Non-Goals

- Multi-slot scheduling (employer offers several times, student picks one). Deferred — model A only.
- Recurring availability windows (Calendly-style). Deferred.
- Recording / transcripts / post-meeting notes. Deferred.
- Group interviews (more than one employer + one student). Deferred.
- SMS notifications. Deferred.

## Phasing

The feature ships in three independently deployable phases:

| Phase | Scope | Outcome |
|-------|-------|---------|
| 1 | DB schema + scheduling modal + student response modal + calendar wiring | Working scheduler with in-app notifications. No video yet — accepted interviews show on calendars but no join button. |
| 2 | Daily.co integration: room provisioning, token minting, meeting page, join button | End-to-end video call. |
| 3 | Resend email notifications + reminder cron | Email touchpoints + 24h/1h reminders. |

Each phase gets its own implementation plan.

## Database Schema

New table `interview_schedules`:

```sql
create table interview_schedules (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30,
  status text not null default 'pending' check (status in
    ('pending','accepted','declined','reschedule_requested','cancelled','completed')),
  daily_room_name text,
  daily_room_url text,
  employer_notes text,
  cancelled_by text check (cancelled_by in ('employer','student')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active interview per application
create unique index interview_schedules_one_active_per_application
  on interview_schedules (application_id)
  where status not in ('declined','cancelled','completed');

create index interview_schedules_employer_idx on interview_schedules (employer_id, scheduled_at);
create index interview_schedules_student_idx on interview_schedules (student_id, scheduled_at);
```

**RLS policies:**
- Employer can `select`/`insert`/`update` rows where `employer_id` matches the employer record for `auth.uid()`.
- Student can `select` rows where `student_id` matches their student record.
- Student can `update` only `status` and `updated_at` fields, and only on rows where `student_id` matches theirs.
- Updates that change `status` are restricted by the trigger to legal transitions (see State Machine).

**Time zones:** `scheduled_at` is stored in UTC (`timestamptz`). All UI displays it in the viewer's local time zone, with the TZ name shown on confirmation surfaces (e.g. "3:00 PM EST") to avoid ambiguity.

## State Machine

```
pending ──accept (student)──→ accepted
pending ──decline (student)──→ declined
pending ──request reschedule (student)──→ reschedule_requested
pending ──cancel (either)──→ cancelled
reschedule_requested ──reschedule (employer)──→ pending
accepted ──cancel (either)──→ cancelled
accepted ──after end + grace──→ completed
```

`completed` is set server-side when a participant leaves the meeting after the start time, or by a sweep of `accepted` rows whose `scheduled_at + duration + 1h` is in the past.

## Components

### New components

- `src/components/ScheduleInterviewModal.tsx` — employer modal for proposing a time. Fields: date, time, duration (15/30/45/60 min select), notes (optional). Used in both initial-schedule and reschedule modes.
- `src/components/InterviewResponseModal.tsx` — student response modal. Three action buttons: Accept, Decline, Request Reschedule. Reschedule auto-templates a message and opens the inbox.
- `src/components/InterviewBanner.tsx` — pending-interview banner shown on student dashboard.

### New pages

- `src/app/dashboard/student/interviews/[id]/page.tsx` — meeting room (Daily iframe), Phase 2.
- `src/app/dashboard/employer/interviews/[id]/page.tsx` — meeting room (Daily iframe), Phase 2.

### New API routes

- `src/app/api/interviews/create/route.ts` — employer creates an interview. Inserts row, calls `/api/daily/create-room` in Phase 2.
- `src/app/api/interviews/[id]/respond/route.ts` — student responds (accept/decline/reschedule).
- `src/app/api/interviews/[id]/cancel/route.ts` — either party cancels.
- `src/app/api/interviews/[id]/reschedule/route.ts` — employer proposes a new time.
- `src/app/api/daily/create-room/route.ts` — server-only Daily room provisioning. Phase 2.
- `src/app/api/daily/token/route.ts` — server-mints a meeting token, validating participant + join window. Phase 2.
- `src/app/api/interviews/send-reminders/route.ts` — Vercel Cron handler, 24h/1h reminder dispatch. Phase 3.

### Modified files

- `app/src/lib/supabase.ts` — add helpers: `createInterview`, `getEmployerInterviews`, `getStudentInterviews`, `respondToInterview`, `cancelInterview`, `rescheduleInterview`, `getInterviewById`.
- `app/src/app/dashboard/employer/posted-jobs/page.tsx` — add "Schedule Interview" button on each candidate row.
- `app/src/app/dashboard/employer/crm/page.tsx` — add "Schedule Interview" action when moving a candidate into the Interview column.
- `app/src/app/dashboard/student/page.tsx` — add interview events (status `accepted`) to calendar; render `InterviewBanner` for pending interviews.
- `app/src/app/dashboard/employer/page.tsx` — add interview events to calendar.
- `supabase/schema.sql` — add table, indexes, RLS policies, trigger.

## Data Flow

### Schedule (employer)

1. Employer in `posted-jobs` clicks **Schedule Interview** on a candidate row.
2. `ScheduleInterviewModal` opens. Employer picks date, time, duration, optional notes.
3. On submit, client calls `POST /api/interviews/create` with `application_id`, `scheduled_at`, `duration_minutes`, `employer_notes`.
4. Server validates the employer owns the application's listing, then:
   - **Phase 1:** inserts `interview_schedules` row with `status='pending'`. Updates `applications.status` to `'interviewing'`.
   - **Phase 2:** also calls Daily REST API to provision a room (`privacy: 'private'`, `exp = scheduled_at + duration + 1h`, `enable_prejoin_ui: true`, `enable_chat: true`); stores `daily_room_name` and `daily_room_url` on the row. If Daily fails, the whole operation rolls back.
5. Modal closes; row in posted-jobs shows "Interview Pending".

### Student response

1. Student loads dashboard. `InterviewBanner` renders for any rows in `pending` state.
2. Click **Respond** → `InterviewResponseModal` opens with the proposed time.
3. **Accept** → `POST /api/interviews/[id]/respond` with `action: 'accept'`. Server sets `status='accepted'`. Both calendars now show the event. Phase 3: confirmation email to employer.
4. **Decline** → `POST .../respond` with `action: 'decline'`. Server sets `status='declined'`, reverts `applications.status` to `'reviewed'`. Phase 3: notification email to employer.
5. **Request Reschedule** → `POST .../respond` with `action: 'reschedule'` and a `message` field. Server sets `status='reschedule_requested'`, inserts a new row in `messages` from student → employer with the templated body. Phase 3: notification email.

### Reschedule (employer follow-up)

1. Employer sees the inbox message and the row's `reschedule_requested` status.
2. From posted-jobs (or the message thread), employer clicks **Reschedule** → `ScheduleInterviewModal` opens in reschedule mode, prefilled with current `scheduled_at`.
3. On submit, `POST /api/interviews/[id]/reschedule`. Server updates `scheduled_at` and `duration_minutes`, sets `status='pending'`. Phase 2: also updates the Daily room's `exp` field.

### Cancel

Either party clicks **Cancel** on the interview card.
- `POST /api/interviews/[id]/cancel`. Server sets `status='cancelled'`, records `cancelled_by` and `cancelled_at`. In-app: the calendar event and pending banner clear on the other party's next dashboard load. Phase 2: deletes the Daily room. Phase 3: email notification to the other party.
- Cancellation is allowed up until `scheduled_at`. After the meeting window passes, accepted interviews move to `completed` (see Completion below) rather than being cancellable.

### Completion

An accepted interview moves to `status='completed'` when:
- **Phase 2 onward:** a participant fires Daily's `left-meeting` callback after `scheduled_at`, or
- A nightly sweep of `accepted` rows whose `scheduled_at + duration + 1h` is in the past flips them to `completed`. The sweep runs as part of the Phase 3 cron route alongside reminder dispatch. In Phase 1 (no video, no cron), accepted interviews simply remain `accepted` after their time passes — this is acceptable because no behavior depends on `completed` until Phase 2.

### Join the call (Phase 2)

1. Either party clicks **Join Interview** on the dashboard / calendar event / posted-jobs row.
2. Button is armed from `scheduled_at - 10 min` to `scheduled_at + duration + 30 min`. Outside the window, the button is disabled with helper text ("Joinable at 2:50 PM EST" or "This interview has ended").
3. Click navigates to `/dashboard/{role}/interviews/[id]`.
4. Page mounts, fetches the row, then `POST /api/daily/token` to mint a meeting token. Server validates: requesting user is `employer.user_id` or `student.user_id` on the row, and current time is inside the join window. Mints a Daily token with `room_name`, `user_name` from the participant's profile, `is_owner: true` for the employer, `exp` set to `scheduled_at + duration + 30 min`.
5. Page renders `<DailyProvider>` and Daily's prebuilt call frame. On `left-meeting` callback, server marks `status='completed'` if `now > scheduled_at`, then redirects back to the dashboard.

## Notifications

**In-app (Phase 1):**
- Pending-interview banner on student dashboard with **Respond** CTA.
- Calendar entries for `accepted` interviews on both dashboards (existing `CalendarEvent` pattern, `type: 'interview'`).
- Status badge on candidate rows in posted-jobs.

**Email (Phase 3, via Resend):**
- To student on schedule: "{Company} would like to interview you on {date/time}".
- To employer on accept / decline / reschedule request.
- To both on cancel.
- 24h and 1h reminders to both parties for `accepted` interviews. Dispatched by `/api/interviews/send-reminders`, run by Vercel Cron every 15 min, idempotent via a `reminder_24h_sent_at` / `reminder_1h_sent_at` column added in Phase 3.

## Error Handling

- **Daily room creation fails on schedule (Phase 2):** transactional rollback; client shows "Couldn't reserve a meeting room — please try again."
- **Token mint outside join window:** API returns 400 with `code: 'outside_window'`, page shows the actual meeting time and a "Back to dashboard" link.
- **Non-participant tries to fetch a token:** API returns 403, page shows "Not authorized."
- **Interview cancelled while a user is on the meeting page:** Daily room is deleted server-side, Daily client emits an error. Page handles by redirecting back with a toast.
- **Concurrent accept after employer cancels:** state-machine trigger rejects the transition; client shows "This interview was cancelled."

## Testing Plan

Manual, since the project has no automated test suite.

**Phase 1:**
- Employer schedules from posted-jobs → student dashboard shows pending banner.
- Student accepts → calendar event appears on both dashboards; employer's posted-jobs row updates to "Interview Scheduled".
- Student declines → application status reverts to "Under Review"; row hides.
- Student requests reschedule → inbox message appears for employer; employer reschedules → student sees pending again.
- Cancel from each side → notifies the other; row clears.
- RLS: query `interview_schedules` as an unrelated student → empty result. Try to update someone else's row → rejected.

**Phase 2:**
- Two browser sessions (employer + student) join the meeting room → both see each other's video → leave → status moves to `completed`.
- Try joining 30 min before window opens → blocked with helper text.
- Try joining 2h after end → blocked with "ended" message.
- Try fetching `/api/daily/token` for an interview the requester is not on → 403.
- Cancel during the meeting → both clients get kicked.

**Phase 3:**
- Verify each transactional email fires exactly once.
- Set system clock to 23h before a meeting → cron run fires the 24h reminder, marks `reminder_24h_sent_at`. Re-run cron → no duplicate email.

## Open Items for Implementation Plan

- Confirm Daily.co plan tier and free-tier limits (10k participant-minutes/month).
- Confirm Vercel Cron is acceptable for reminders (Phase 3); if not, defer reminders or move to a different scheduler.
- Decide whether the employer's interview entry point in CRM is "drag candidate to Interview column" or a button. Either works; the modal is the same.

## Environment Variables

Added in Phase 2:
- `DAILY_API_KEY` — server-only.
- `DAILY_DOMAIN` — e.g. `internfirst.daily.co`.

## Dependencies Added

Phase 2:
- `@daily-co/daily-js`
- `@daily-co/daily-react`
