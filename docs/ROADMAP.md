# InternFirst — Spec Alignment Roadmap

Gap analysis comparing the current codebase against the product spec (Website Overview Request.pdf).

---

## Legend

- **DONE** — Feature exists and works
- **PARTIAL** — Some implementation exists, needs work
- **MISSING** — Not started at all

---

## Phase 0: Design System Overhaul

The spec defines a completely different visual identity from what's currently built.

| Item | Current | Spec | Status |
|------|---------|------|--------|
| Primary color | `#7B61FF` (purple) | `#1A2D49` (navy) | MISSING |
| Accent color | — | `#9FC63C` (green) | MISSING |
| Light text color | — | `#DFE0E1` (light grey) | MISSING |
| Background | white / `#fafafe` | `#F8F9FC` (soft off-white) | MISSING |
| Font | DM Sans | Inter | MISSING |
| WCAG 2.1 compliance | Not audited | Required | MISSING |
| Logo branding | InternFirst logo exists | Navy/green logo with blue border | MISSING |

**Work:** Update CSS custom properties in `globals.css`, swap Google Font import, audit color contrast ratios for WCAG AA.

---

## Phase 1: Student Portal

### 1.1 Navigation (PARTIAL)

| Spec Tab | Current Route | Status |
|----------|---------------|--------|
| Home | `/dashboard/student` | DONE |
| Job Portal | `/dashboard/student/internships` | DONE |
| School-Affiliated Job Portal | — | MISSING |
| Messages | `/dashboard/student/inbox` | DONE |
| Career Resources | `/career-resources` (public, stub) | MISSING |
| Profile | `/dashboard/student/settings` (combined) | PARTIAL |
| Settings | `/dashboard/student/settings` | PARTIAL |

**Work:** Add School-Affiliated Job Portal route. Split Profile and Settings into separate pages. Build Career Resources as a dashboard page (not public).

### 1.2 Home Screen / Dashboard (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Applied Jobs Overview with ATS statuses | PARTIAL | Stats exist but no detailed pipeline view above calendar |
| Interactive Calendar | MISSING | No calendar component at all |
| Left Sidebar: School Events | PARTIAL | Events page exists separately, not on home sidebar |
| Left Sidebar: Local Employer Events | MISSING | No location-based events |
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

### 1.4 School-Affiliated Job Portal (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| School logo replaces InternFirst logo | MISSING | |
| University-specific job listings | MISSING | No university-employer affiliation in DB |
| Same UX as general portal | MISSING | |

**Work:** Needs new DB table for university-employer partnerships, new route, and branding logic.

### 1.5 Messaging (DONE)

| Feature | Status | Notes |
|---------|--------|-------|
| Conversation list (left panel) | DONE | |
| Chat window (right panel) | DONE | |
| iMessage/Teams-style interface | DONE | |
| Real-time messaging | PARTIAL | Polling every 5s, not true real-time |

### 1.6 Career Resources (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| Free: Resume guides, interview tips, articles | MISSING | Public page exists as stub |
| Free: Schedule career center appointments (affiliated) | MISSING | |
| Paid: 1:1 Resume Reviews | MISSING | |
| Paid: 1:1 Career Coaching | MISSING | |
| Paid: 1:1 Interview Prep | MISSING | |
| Booking/payment flow | MISSING | |

### 1.7 Student Profile (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Profile photo | DONE | Avatar upload exists |
| Elevator Pitch video (10-30s) | MISSING | |
| Resume upload (PDF) | DONE | |
| Skills (dropdown + custom) | MISSING | |
| Experiences (internships, projects, campus) | MISSING | |
| Academic info (major, school) | DONE | |
| Greek life / clubs / organizations | MISSING | |

### 1.8 Settings (PARTIAL)

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

## Phase 3: University / Career Center Portal

### 3.1 Navigation (PARTIAL)

| Spec Tab | Current Route | Status |
|----------|---------------|--------|
| KPI Dashboard | `/dashboard/university` | PARTIAL |
| Posted Jobs | — | MISSING |
| Calendar | — | MISSING |
| Surveys | — | MISSING |
| CRM | — | MISSING |
| Messages | — | MISSING |
| Account | — | MISSING |
| Settings | — | MISSING |

### 3.2 Institutional Branding (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| School logo in top-left | MISSING | Shows InternFirst logo |
| Platform colors adapt to school colors | MISSING | |
| Multiple users per institution | MISSING | Currently 1:1 |
| Role-based permissions | MISSING | |
| Data scoped to .edu domain | PARTIAL | Some queries filter by university_id |

### 3.3 KPI Dashboard (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Students enrolled count | DONE | |
| Total applications | DONE | |
| Offers count | DONE | |
| Interviewing count | DONE | |
| Top employers chart | DONE | Bar chart with top 3 |
| Placement cities chart | DONE | Horizontal bar chart |
| Time-to-interview rate | MISSING | |
| Acceptance rate | MISSING | |
| Avg applications per student | MISSING | |
| App-to-interview conversion | MISSING | |
| Employer engagement metrics | MISSING | |
| Industry distribution | MISSING | |
| Career fair attendance rates | MISSING | |
| RSVP-to-attendance conversion | MISSING | |
| Event engagement by type | MISSING | |
| Survey response rate | MISSING | |
| Filter by major | MISSING | |
| Filter by graduation year | MISSING | |
| Filter by college/department | MISSING | |

### 3.4 Posted Jobs Management (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| View school-affiliated job postings | MISSING | |
| Approve/edit/remove postings | MISSING | |
| External integration (e.g., ePACK) | MISSING | |
| Visibility controls | MISSING | |

### 3.5 Calendar / Events (PARTIAL)

| Feature | Status | Notes |
|---------|--------|-------|
| Create events | DONE | Form exists |
| Event types (career fair, info session, etc.) | DONE | Enum in DB |
| View upcoming events | DONE | List view |
| Calendar view | MISSING | No calendar component |
| Club-hosted events (scoped visibility) | MISSING | |
| RSVP tracking (totals, by major, by year) | MISSING | Registration count only |
| QR code check-in | MISSING | |
| Club permissions (own events only) | MISSING | |

### 3.6 Surveys (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| Create surveys (title, description, questions) | MISSING | No DB tables |
| Question types (MC, short answer, rating) | MISSING | |
| Required/optional toggle | MISSING | |
| Target audience filters | MISSING | |
| Schedule (immediate, future, expiration) | MISSING | |
| Response tracking & analytics | MISSING | |
| CSV export | MISSING | |
| Anonymous/identifiable toggle | MISSING | |

### 3.7 University CRM (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| Student case management (search, profile view) | MISSING | |
| Appointment management (calendar, notes) | MISSING | |
| Advisor notes & follow-up tracking | MISSING | |
| Task assignment (review resume, send leads) | MISSING | |
| Status system (open/in progress/completed) | MISSING | |
| Workflow tracking (seeking/placed/at-risk) | MISSING | |
| Integration with KPI dashboard | MISSING | |

### 3.8 Messages (MISSING for university)

No inbox route exists for university admins.

### 3.9 Account (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| School public profile | MISSING | |
| User & role management | MISSING | |
| Club accounts | MISSING | No clubs concept in DB |

### 3.10 Settings (MISSING)

| Feature | Status | Notes |
|---------|--------|-------|
| User permissions and roles | MISSING | |
| Branding controls | MISSING | |
| Notification preferences | MISSING | |
| Data access rules | MISSING | |
| Integration settings | MISSING | |

---

## Phase 4: Cross-Cutting Features

### 4.1 Job Ranking Algorithm (MISSING)

The spec defines a ranking formula:
```
RS = (R × 0.45) + (log(1+E) × 0.15) + (Q × 0.10) + (log(1+(M/n)) × 0.25) + (F × 0.05)
PPJ boost: +0.085
```
Requires: relevance scoring, engagement tracking, quality scoring (25-field checklist), payment tracking, freshness calculation.

### 4.2 Job Quality Score (MISSING)

25-field checklist (each = 0.2 points, max 5.0). Requires expanding the listing creation form significantly.

### 4.3 Payment System (MISSING)

Pay Per Post, Budget (PPC/PPA), and Organic tiers. No payment integration exists.

### 4.4 Interview Scheduling (MISSING)

No calendar or scheduling system for any role.

### 4.5 Real-time Messaging (PARTIAL)

Currently polling every 5 seconds. Spec implies real-time. Could use Supabase Realtime.

### 4.6 Multi-User per Organization (MISSING)

Both employer and university currently support 1 user per org. Spec requires team management.

---

## Suggested Implementation Order

### Priority 1 — Foundation (do first)
1. **Design system overhaul** (colors, font, WCAG)
2. **Fix navigation** for all three roles to match spec tabs
3. **Search functionality** — wire up search inputs
4. **Additional job filters** (location, paid/unpaid, remote, length)
5. **Split-view job portal** (LinkedIn-style)
6. **Application deadline** field on listings

### Priority 2 — Core Student Experience
7. **Interactive calendar** component (reusable across all roles)
8. **Student home redesign** (3-column layout with calendar center)
9. **RSVP system** for events
10. **Student profile page** (separate from settings, recruiter-facing)
11. **Skills and experiences** on student profile

### Priority 3 — Core Employer Experience
12. **Posted Jobs page** with analytics (views, clicks)
13. **View/impression tracking** on listings
14. **Employer CRM** — Kanban board for candidate pipeline
15. **Employer home calendar**
16. **Company verification workflow** (EIN)

### Priority 4 — University Experience
17. **University inbox** (messaging)
18. **KPI dashboard** — add missing metrics and filters
19. **Surveys system** (DB tables + UI)
20. **University CRM** — student case management
21. **School-affiliated job portal**
22. **Institutional branding** (school logo, colors)

### Priority 5 — Advanced Features
23. **Multi-user per organization** (companies table, team management)
24. **Career Resources** page (free + paid content)
25. **Job ranking algorithm**
26. **Payment system** (posting tiers)
27. **Interview scheduling** with calendar integration
28. **Real-time messaging** (Supabase Realtime)
29. **Elevator pitch video** upload
30. **Club accounts** for universities

---

## Database Tables Needed

New tables required by the spec that don't exist yet:

- `companies` — Multi-user employer orgs
- `company_users` — Link users to companies with roles
- `surveys` — Survey definitions
- `survey_questions` — Questions per survey
- `survey_responses` — Student responses
- `appointments` — Career center appointments
- `advisor_notes` — CRM notes per student
- `tasks` — CRM task board (employer + university)
- `listing_views` — View/click tracking
- `university_employer_partnerships` — School-affiliated jobs
- `clubs` — University club orgs
- `club_memberships` — Student club enrollment
- `interview_schedules` — Interview coordination
- `payment_transactions` — Job posting payments
