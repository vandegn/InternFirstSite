# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InternFirstSite is a premium internship recruitment platform connecting students and employers. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase.

**Core principle: Closed ecosystem.** Everything happens on the platform — job listings, applications, interviews, and hiring. There are no external job links or off-platform redirects. Students apply in-platform, employers review and manage candidates in-platform, and all communication stays within InternFirst.

## Repository Structure

The Next.js application lives inside the `app/` subdirectory (not the repo root). All npm commands must be run from `app/`.

```
InternFirstSite/
├── app/                    # Next.js application root
│   ├── src/
│   │   ├── app/           # App Router pages and layouts
│   │   ├── components/    # Shared components
│   │   └── lib/           # Supabase client, helpers, and constants
│   ├── public/            # Static assets
│   ├── .env.local         # Supabase credentials
│   └── package.json
├── docs/
│   └── ROADMAP.md         # Spec alignment roadmap and deferred items
└── supabase/
    └── schema.sql         # Full database schema with RLS policies
```

## Common Commands

All commands run from `app/`:

```bash
cd app
npm run dev      # Start dev server
npm run build    # Production build
npm run start    # Production server
npm run lint     # ESLint
```

## Architecture

**Two user roles** drive the application: `student` and `employer`. Each role has its own dashboard (`/dashboard/student`, `/dashboard/employer`), role-specific registration fields, and database tables.

**Public pages:** `/about`, `/blog`, `/career-resources`, `/contact`, `/home` — marketing and informational pages outside the dashboard.

**Feedback:** the floating Feedback button on every student/employer dashboard page posts to `/api/feedback`, which writes a row to `feedback_submissions`. Admins review it at `/dashboard/admin/feedback` and mark items new → reviewed → resolved. Submitter email/name/role are snapshotted onto the row so feedback survives account deletion. RLS restricts reads to `intern_first_admin`; there is no recipient lookup and no email routing.

**Route protection:** `src/app/dashboard/layout.tsx` wraps all dashboard routes with client-side auth checks. It verifies the user is logged in, has a profile, and is accessing the correct dashboard for their role. Unauthorized users get redirected to `/login`, `/register`, or their correct dashboard. There is no middleware — all checks run in a `useEffect`.

**Auth flow:** Supabase Auth (email/password + Google OAuth) → email verification required (Supabase built-in, skipped for OAuth) → `/auth/callback` server route creates profile + role data from `user_metadata` → role-based redirect to dashboard. Unverified users are redirected to `/verify-email`. `.edu` email required for students. Key auth helpers are in `src/lib/supabase.ts` (`getProfile`, `createProfileAndRoleData`, `isEduEmail`).

**Private applicant docs:** resumes and application file-answers live in the **private** `applicant-docs` Storage bucket (`resumes/<studentId>/…`, `application-files/<studentId>/…`); `student_resumes` and `application_answers` store `storage_path`, not URLs (`file_url` is legacy). All reads go through `GET /api/files/[kind]/[id]` (`kind` = `resume` | `application-answer` | `certification`), which authorizes by selecting the row with the caller's RLS-scoped session and 302-redirects to a 60-second service-role signed URL — so a link is just `/api/files/resume/${id}`. There is intentionally no storage SELECT policy on the bucket. Logos, banners, and avatars stay in the public `images` bucket. See `docs/private-applicant-docs-plan.md`.

**Database:** Supabase PostgreSQL with RLS enabled on all tables. Core tables: `profiles`, `students`, `employers`, `internship_listings`, `applications`, `messages`, `student_skills`, `student_experiences`, `student_organizations`, `student_resumes`, `student_certifications`, `listing_views`, `saved_listings`, `career_survey_responses`. Schema is in `supabase/schema.sql`.

**Student profile split:** `student_experiences` is professional only (`internship`, `work`, `project`). Everything campus-side — Greek life, clubs, campus involvement — lives in `student_organizations`, which has an `is_current` flag so members don't have to invent an end date. Work experience is edited on `/dashboard/student/profile`, never in settings.

**Certifications:** `student_certifications` holds one row per uploaded credential — the PDF plus the certification number an employer verifies against the issuer (Six Sigma belts, OSHA, CPR). Multiple per student, uploaded from the Certifications card on `/dashboard/student/profile` and shown to approved employers on `/dashboard/employer/students/[id]`. The file is a private applicant doc like a resume: `applicant-docs/certifications/<studentId>/…`, stored as `storage_path`, read only via `/api/files/certification/${id}`. PDF-only is enforced in `uploadCertification`, not just by the file input's `accept`.

**School selection:** students pick their institution from the Department of Education's approved list, bundled as `src/data/us-schools.json` and searched through `/api/schools` (same server-side-dataset pattern as `/api/locations`). `components/SchoolPicker.tsx` only ever commits a row from that list — typed text that wasn't selected is discarded on blur — and writes `students.school_id` / `school_name` / `school_state`. Required at student registration; editable afterwards from the profile hero. Not related to `students.university_id`, a dead FK from the removed university portal.

**Listing sections:** the three core sections (Job Overview, Qualifications, Key Responsibilities) are all required, and their render order is stored in `internship_listings.section_order` (Qualifications first by default). `components/ListingCoreSections.tsx` owns both the editor and the read-only renderer — use `ListingCoreSectionsView` anywhere a listing is displayed so the employer preview can't drift from the real page.

**Employer team (multi-user employer accounts):** `employer_members` links users to a company with a role bundle from the six-role library (`master_admin`, `recruiting_lead`, `recruiter`, `hiring_manager`, `interviewer`, `approver`). The user who registers the company becomes its Master Admin (backfill + `trg_seed_master_admin`); one employer and one role per user. Master Admins invite teammates from `/dashboard/employer/team` (invites expire after 7 days, can be resent/revoked; accepted at `/join/[token]`, where the accepting login's email must match the invited email), change roles, and (de)activate members — a company must always keep one active Master Admin. Employer-side RLS resolves "my company" through `acting_employer_ids()` (active membership), not `employers.user_id`; `is_approved_employer` is membership-based too. Deactivation therefore cuts DB access immediately. Role capabilities (`ROLE_CAPABILITIES`) are enforced at the application layer, not per-role RLS. `lib/employer-team.ts` is the pure domain module (mirrors the interview-availability pattern: service seam in `-service.ts`, service-role Supabase repo in `-repo.ts`, routes under `/api/employer/team`). Every team action lands in the insert-only `employer_team_events` audit table. Billing tables stay keyed to the original account owner.

**Interview scheduling — availability handshake:** before an `interview_schedules` row exists, the employer and student negotiate a time in three steps. The employer clicks **Request Times** on a pipeline card and picks a date window; a message carrying an availability picker lands in the student's inbox; the student marks the day/time frames that work; the employer is notified and returns to the pipeline to pick one final time, which writes the real `interview_schedules` row. State lives in `interview_availability_requests.status` and is explicit at every step: `requested → awaiting_student → awaiting_employer → scheduled`, with `no_availability` (student says nothing in the window works) and `cancelled` (employer withdraws to re-request) as terminal off-ramps. A partial unique index allows only one live request per application, so re-requesting means cancelling first.

`lib/interview-availability.ts` is the pure domain module — state machine, window/slot/time validation, calendar helpers — and is imported by the API routes *and* both UIs so the rules can't drift. `lib/interview-availability-service.ts` holds the server flow against a narrow `AvailabilityRepo` seam (Supabase implementation in `-repo.ts`), which is what makes the flow testable end to end without a database. Routes live under `/api/interviews/availability`. Components: `RequestTimesModal` (step 1), `AvailabilityRequestCard` (step 2, rendered inline by `Inbox` whenever `messages.availability_request_id` is set), `SelectInterviewTimeModal` (step 3). The employer's final picker is generated from the student's own frames via `enumerateStartTimes`, so an out-of-bounds pick isn't reachable through the UI.

**Tests:** Vitest + Testing Library, run with `npm test` from `app/`. Currently covers the interview availability handshake: `lib/interview-availability.test.ts` (domain rules), `lib/interview-availability-flow.test.ts` (all three steps end to end through an in-memory repo), `components/interview-scheduling-ui.test.tsx` (button clicks through each step). **Gotcha:** `globals.css` must be saved as UTF-8 **without a BOM**. A BOM makes Turbopack fail every build and dev page render with `Parsing CSS source code failed`, pointing at line 2 of Tailwind's expanded output — which reads like a Tailwind bug but isn't. Check with `head -c 3 app/src/app/globals.css | xxd` if that error reappears.

**Styling:** Global CSS variables in `globals.css` (primary color `#7B61FF`), Tailwind CSS utilities, and custom component classes (`.btn-*`, `.card-*`, `.stat-card`, `.dash-*`, `.listing-card`, `.avatar-dropdown`). Font: DM Sans.

**Path alias:** `@/*` maps to `./src/*` in tsconfig.

## Dashboard Routes

**Student** (`/dashboard/student`):
- `/internships` — browse and filter active listings; `/internships/[id]` — listing detail + apply
- `/applications` — track application statuses
- `/profile` — manage profile, skills, experiences, organizations
- `/inbox` — in-platform messaging with employers
- `/resources` — career resources hub (resume guide, interview tips, career articles)
- `/settings` — account settings

**Employer** (`/dashboard/employer`):
- `/listings/new` — create a new listing; `/listings/[id]/edit` — edit existing
- `/posted-jobs` — split-view of all posted listings
- `/applications` — review and manage candidate applications
- `/pipeline` — kanban board with per-listing customizable columns for moving candidates through hiring stages. Columns are added from `PIPELINE_STAGE_PRESETS` in `constants.ts` (a preset dropdown, not free text) so every board speaks the same recruitment flow and each column carries a truthful `stage_type`; add a row there to offer a new stage. Accepts `?listing=&application=` to open one candidate's card — that's where the "new applicant" notification points.
- `/inbox` — in-platform messaging with students
- `/team` — team roster; Master Admins invite teammates, assign roles, (de)activate members
- `/account` — company account page
- `/settings` — account settings

## Listing Flow

Employers create listings at `/dashboard/employer/listings/new`. Compensation uses a preset dropdown (e.g. "$15-20/hr", "Unpaid", "Stipend"). Industry is a required preset dropdown.

Students browse active listings at `/dashboard/student/internships` (filterable by industry pills) and view details at `/dashboard/student/internships/[id]`. The student dashboard shows a "Recommended for You" section based on the student's major-to-industry mapping.

All applications are in-platform: student clicks "Apply Now" → creates row in `applications` table → shows status (Applied, Under Review, Interviewing, Offered, Not Selected). Students can optionally attach a resume. There are no external application links.

## Career Goals Survey

The student dashboard shows a banner prompting students to complete a 5-step career goals survey (industries, work environment, duration, skills, career goals). Answers are stored in `career_survey_responses` (one row per student, upserted on retake). The banner hides when `completed_at` exists. Students can retake the survey from the "Career Preferences" section on the settings page, which pre-fills the modal with existing answers.

"Recommended for You" on the student dashboard is driven by the survey's `industries` column — not by `MAJOR_TO_INDUSTRIES`, and not hardcoded. Survey labels use a broader vocabulary than listing industries ("Finance & Banking" vs. "Finance"), so they must be translated through `surveyIndustriesToListingIndustries` in `constants.ts` before being compared to a listing. `MAJOR_TO_INDUSTRIES` remains a secondary signal inside `lib/matching.ts`. See `docs/superpowers/specs/2026-03-28-career-survey-storage-design.md` for full design.

Work environment and internship length are **ranked multi-selects** (`work_environments`, `preferred_durations` — ordered arrays, strongest first). The legacy scalar columns are kept in sync with element 1 by a DB trigger. Match scoring discounts each successive pick by 15% (floored at 0.4), so breadth doesn't inflate a score.

**Important:** This is the platform-owned career goals survey. It is separate from the university survey builder (a future feature where universities create custom surveys with targeting, scheduling, and analytics). The two systems are intentionally decoupled.

## Key Conventions

- Pages use `"use client"` directive — currently client-side heavy with Supabase JS calls
- Shared components in `src/components/`: `Header`, `Footer`, `RoleSelector` (public/auth pages), `DashboardShell` (dashboard layout wrapper), `Calendar`, `Inbox`, `Pagination`
- Each dashboard header shows a portal label (e.g. "Student Dashboard") next to the logo and an avatar dropdown with sign-out
- Dashboard nav links are role-scoped — no cross-role navigation
- `DASHBOARD_ROUTES` in `supabase.ts` maps roles to their dashboard paths
- CSS follows a pattern of global custom properties + component-scoped class names in `globals.css`

## Supabase Helpers (src/lib/supabase.ts)

- **Auth/Profile:** `getProfile`, `createProfileAndRoleData`, `isEduEmail`, `uploadImage`, `updateProfile`
- **Employers:** `getEmployerByUserId`, `getEmployerListings`, `getEmployerListingsWithStats`, `updateEmployer`, `getEmployerApplications`, `updateApplicationStatus`, `getEmployerStats`, `getEmployerUserIdByListingId`
- **Students:** `getStudentByUserId`, `updateStudent`, `getStudentApplications`, `getStudentStats`
- **Skills/Experiences/Orgs:** `getStudentSkills`, `addStudentSkill`, `removeStudentSkill`, `getStudentExperiences`, `addStudentExperience`, `updateStudentExperience`, `deleteStudentExperience`, `getStudentOrganizations`, `addStudentOrganization`, `updateStudentOrganization`, `deleteStudentOrganization`
- **Resumes:** `uploadResume`, `getStudentResumes`, `deleteResume`
- **Certifications:** `uploadCertification`, `getStudentCertifications`, `deleteCertification`
- **Listings:** `createListing`, `updateListing`, `getActiveListings`, `getListingById`, `getRecommendedListings`, `getListingViewCounts`, `trackListingView`
- **Applications:** `applyToListing`, `applyToListingWithResume`, `getApplicationStatus`
- **Saved listings (bookmarks):** `getSavedListingIds`, `saveListing`, `unsaveListing` — private to the student; saving never creates an application
- **Career Survey:** `getCareerSurvey`, `upsertCareerSurvey`
- **Messaging:** `getConversations`, `getMessagesWith`, `sendMessage`, `markMessagesAsRead`, `getUnreadCount`
- **Constants** (`src/lib/constants.ts`): `INDUSTRIES`, `MAJORS`, `MAJOR_TO_INDUSTRIES`, `SKILLS`, `PIPELINE_STAGE_PRESETS`

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | chud@htn.edu | 111111 |
| Employer | chud@htn.org | 123456 |
| University | helen@unc.edu | 111111 |

## Known Limitations & Future Work

See `docs/ROADMAP.md` for the spec alignment roadmap and deferred items. See `docs/UNIVERSITY_PORTAL_ARCHIVE.md` for documentation of the removed university portal (halted per leadership decision 2026-03-27). Key items:
- Supabase Storage bucket for image uploads needs setup (`images` bucket, public)
- Employer accounts are multi-user via `employer_members` (one user = one company, one role); custom roles, permission bundles, access scopes, and per-role RLS are future work — see the employer-team section above
