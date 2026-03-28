# InternFirst — Spec Alignment Roadmap

Gap analysis comparing the current codebase against the product spec (Website Overview Request.pdf).

---

## Legend

- **DONE** — Feature exists and works
- **PARTIAL** — Some implementation exists, needs work
- **MISSING** — Not started at all

---

## Phase 0: Design System Overhaul

| Item | Current | Spec | Status |
|------|---------|------|--------|
| Primary color | `#1A2D49` (navy) | `#1A2D49` (navy) | DONE |
| Accent color | `#9FC63C` (green) | `#9FC63C` (green) | DONE |
| Light text color | `#6d7584` | `#DFE0E1` (light grey) | DONE (darkened for WCAG AA) |
| Background | `#F8F9FC` (soft off-white) | `#F8F9FC` (soft off-white) | DONE |
| Font | Inter | Inter | DONE |
| WCAG 2.1 compliance | Audited, key pairs pass AA | Required | DONE |
| Logo branding | Navy border logo | Navy/green logo with blue border | PARTIAL |

**Notes:** `--text-light` was darkened from spec's `#DFE0E1` to `#6d7584` to meet WCAG AA contrast. Auth buttons use dark text on green (not white) for accessibility. Old purple (`#7B61FF`) references fully removed.

---

## Phase 1: Student Portal

### 1.1 Navigation (PARTIAL)

| Spec Tab | Current Route | Status |
|----------|---------------|--------|
| Home | `/dashboard/student` | DONE |
| Job Portal | `/dashboard/student/internships` | DONE |
| Messages | `/dashboard/student/inbox` | DONE |
| Career Resources | `/career-resources` (public, stub) | MISSING |
| Profile | `/dashboard/student/settings` (combined) | PARTIAL |
| Settings | `/dashboard/student/settings` | PARTIAL |

**Work:** Split Profile and Settings into separate pages. Build Career Resources as a dashboard page (not public).

### 1.2 Home Screen / Dashboard (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Applied Jobs Overview with ATS statuses | PARTIAL | Stats exist but no detailed pipeline view above calendar |
| Interactive Calendar | MISSING | No calendar component at all |
| Right Sidebar: Industry News Feed | MISSING | No news integration |
| Survey Banner | MISSING | No survey system at all |
| RSVP functionality | MISSING | Event registration exists in DB but no RSVP UI/statuses |
| Color-coded event types | MISSING | |
| Application deadline auto-add to calendar | MISSING | |

### 1.3 Job Portal (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| LinkedIn-style split view (list left, detail right) | MISSING | Currently separate list and detail pages |
| Scrollable job listings | DONE | Paginated list works |
| Search bar (keyword) | MISSING | Input exists, no logic |
| Filter: Location | MISSING | |
| Filter: Industry | DONE | Industry pill filter works |
| Filter: Paid vs unpaid | MISSING | |
| Filter: Internship length | MISSING | |
| Filter: Remote/hybrid/in-person | MISSING | |
| In-platform apply | DONE | Works with resume selection |

### 1.4 Messaging (DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| Conversation list (left panel) | DONE | |
| Chat window (right panel) | DONE | |
| iMessage/Teams-style interface | DONE | |
| Real-time messaging | PARTIAL | Polling every 5s, not true real-time |

### 1.5 Career Resources (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| Free: Resume guides, interview tips, articles | MISSING | Public page exists as stub |
| Paid: 1:1 Resume Reviews | MISSING | |
| Paid: 1:1 Career Coaching | MISSING | |
| Paid: 1:1 Interview Prep | MISSING | |
| Booking/payment flow | MISSING | |

### 1.6 Student Profile (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Profile photo | DONE | Avatar upload exists |
| Elevator Pitch video (10-30s) | MISSING | |
| Resume upload (PDF) | DONE | |
| Skills (dropdown + custom) | MISSING | |
| Experiences (internships, projects, campus) | MISSING | |
| Academic info (major, school) | DONE | |
| Greek life / clubs / organizations | MISSING | |

### 1.7 Settings (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Account details | DONE | |
| Email notifications | MISSING | |
| Messaging preferences | MISSING | |
| Privacy controls | MISSING | |
| Password & security | MISSING | |
| Subscription management | MISSING | |

---

## Phase 2: Employer Portal

### 2.1 Navigation (PARTIAL)

| Spec Tab | Current Route | Status |
|----------|---------------|--------|
| Home | `/dashboard/employer` | DONE |
| Post a Job | `/dashboard/employer/listings/new` | DONE |
| Posted Jobs | — (listings shown on home) | PARTIAL |
| CRM | — | MISSING |
| Messages | `/dashboard/employer/inbox` | DONE |
| Account | — | MISSING |
| Settings | `/dashboard/employer/settings` | PARTIAL |

### 2.2 Signup & Verification (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Email + password signup | DONE | |
| Multiple users per company | MISSING | Currently 1:1 employer-user |
| Email verification | MISSING | Not enforced |
| Federal EIN input | PARTIAL | `business_id` field exists in DB, no verification flow |
| Company verification workflow | MISSING | `verified` flag exists but no UI/process |
| Pending/Verified status display | MISSING | |
| Restrict posting during verification | MISSING | |

### 2.3 Home Dashboard (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Calendar view (primary focus) | MISSING | No calendar component |
| Individual interviews on calendar | MISSING | No interview scheduling |
| Shared company events | MISSING | Events are hardcoded placeholders |
| Calendar sync with scheduling | MISSING | |
| Job posting timelines | MISSING | |

### 2.4 Post a Job (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Pay Per Post option | MISSING | No payment integration |
| Budget Posting (PPC/PPA) | MISSING | |
| Organic (Free) option | PARTIAL | Current posting is free by default |
| Occupation group field | MISSING | |
| Industry field | DONE | |
| Job title | DONE | |
| Location / remote | DONE | |
| Job description | DONE | |
| Required/preferred skills | PARTIAL | Single "requirements" text field |
| Application deadline | MISSING | Not in current form or DB |
| Posting type selection | MISSING | |

### 2.5 Posted Jobs / Analytics (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| Split view: job list + details | MISSING | Listings shown on home page only |
| Job status (Active, Paused, Closed) | PARTIAL | active/closed exists, no "paused" |
| Posting type label | MISSING | |
| Total views | MISSING | No view tracking |
| Click-through rate | MISSING | |
| Apply clicks | MISSING | |
| Completed applications count | PARTIAL | Can be derived |
| Candidate pipeline (ranked) | MISSING | No ranking algorithm |
| Quick actions (profile, message, interview) | PARTIAL | Can message, no interview scheduling |

### 2.6 Employer CRM (MISSING)

This is a major missing feature set.

| Feature | Status | Notes |
|---------|--------|-------|
| Kanban board (drag-and-drop) | MISSING | |
| Columns: New → Hired/Rejected | MISSING | |
| Assign candidate owner | MISSING | |
| Internal notes (not visible to applicants) | MISSING | |
| Task board per job posting | MISSING | |
| Task assignment + due dates | MISSING | |
| Interview delegation | MISSING | |
| Interview scheduling + calendar | MISSING | |
| Interview feedback | MISSING | |
| Bulk messaging | MISSING | |
| Talent pool tagging | MISSING | |
| Outreach tracking (sent/responses/conversion) | MISSING | |
| @mention team members | MISSING | |

### 2.7 Account Page (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| Recruiter profile (name, title, contact) | MISSING | |
| Profile visibility to students | MISSING | |
| Company profile (name, logo, description, industry, locations) | PARTIAL | Exists in settings |
| User management (add/remove employees) | MISSING | |

### 2.8 Settings (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| User roles & permissions | MISSING | |
| Password & security | MISSING | |
| Notification preferences | MISSING | |
| Billing & payment methods | MISSING | |
| Verification status | MISSING | |
| Posting defaults | MISSING | |

---

> **Note:** Phase 3 (University / Career Center Portal) was removed on 2026-03-27 per leadership decision. See `docs/UNIVERSITY_PORTAL_ARCHIVE.md` for what was built.

---

## Phase 3: Cross-Cutting Features

### 3.1 Job Ranking Algorithm (MISSING)

The spec defines a ranking formula:
```
RS = (R × 0.45) + (log(1+E) × 0.15) + (Q × 0.10) + (log(1+(M/n)) × 0.25) + (F × 0.05)
PPJ boost: +0.085
```
Requires: relevance scoring, engagement tracking, quality scoring (25-field checklist), payment tracking, freshness calculation.

### 3.2 Job Quality Score (MISSING)

25-field checklist (each = 0.2 points, max 5.0). Requires expanding the listing creation form significantly.

### 3.3 Payment System (MISSING)

Pay Per Post, Budget (PPC/PPA), and Organic tiers. No payment integration exists.

### 3.4 Interview Scheduling (MISSING)

No calendar or scheduling system for any role.

### 3.5 Real-time Messaging (PARTIAL)

Currently polling every 5 seconds. Spec implies real-time. Could use Supabase Realtime.

### 3.6 Multi-User per Organization (MISSING)

Employer currently supports 1 user per org. Spec requires team management.

---

## Suggested Implementation Order

### Priority 1 — Foundation (do first)
1. **Design system overhaul** (colors, font, WCAG)
2. **Fix navigation** for both roles to match spec tabs
3. **Search functionality** — wire up search inputs
4. **Additional job filters** (location, paid/unpaid, remote, length)
5. **Split-view job portal** (LinkedIn-style)
6. **Application deadline** field on listings

### Priority 2 — Core Student Experience
7. **Interactive calendar** component (reusable across roles)
8. **Student home redesign** (calendar + applications layout)
9. **Student profile page** (separate from settings, recruiter-facing)
10. **Skills and experiences** on student profile

### Priority 3 — Core Employer Experience
11. **Posted Jobs page** with analytics (views, clicks)
12. **View/impression tracking** on listings
13. **Employer CRM** — Kanban board for candidate pipeline
14. **Employer home calendar**
15. **Company verification workflow** (EIN)

### Priority 4 — Advanced Features
16. **Multi-user per organization** (companies table, team management)
17. **Career Resources** page (free + paid content)
18. **Job ranking algorithm**
19. **Payment system** (posting tiers)
20. **Interview scheduling** with calendar integration
21. **Real-time messaging** (Supabase Realtime)
22. **Elevator pitch video** upload

---

## Database Tables Needed

New tables required by the spec that don't exist yet:

- `companies` — Multi-user employer orgs
- `company_users` — Link users to companies with roles
- `tasks` — CRM task board (employer)
- `interview_schedules` — Interview coordination
- `payment_transactions` — Job posting payments
