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

**Route protection:** `src/app/dashboard/layout.tsx` wraps all dashboard routes with client-side auth checks. It verifies the user is logged in, has a profile, and is accessing the correct dashboard for their role. Unauthorized users get redirected to `/login`, `/register`, or their correct dashboard. There is no middleware — all checks run in a `useEffect`.

**Auth flow:** Supabase Auth (email/password + Google OAuth) → email verification required (Supabase built-in, skipped for OAuth) → `/auth/callback` server route creates profile + role data from `user_metadata` → role-based redirect to dashboard. Unverified users are redirected to `/verify-email`. `.edu` email required for students. Key auth helpers are in `src/lib/supabase.ts` (`getProfile`, `createProfileAndRoleData`, `isEduEmail`).

**Database:** Supabase PostgreSQL with RLS enabled on all tables. Core tables: `profiles`, `students`, `employers`, `internship_listings`, `applications`, `messages`, `student_skills`, `student_experiences`, `student_organizations`, `student_resumes`, `listing_views`. Schema is in `supabase/schema.sql`.

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
- `/crm` — kanban board for candidate relationship management
- `/inbox` — in-platform messaging with students
- `/account` — company account page
- `/settings` — account settings

## Listing Flow

Employers create listings at `/dashboard/employer/listings/new`. Compensation uses a preset dropdown (e.g. "$15-20/hr", "Unpaid", "Stipend"). Industry is a required preset dropdown.

Students browse active listings at `/dashboard/student/internships` (filterable by industry pills) and view details at `/dashboard/student/internships/[id]`. The student dashboard shows a "Recommended for You" section based on the student's major-to-industry mapping.

All applications are in-platform: student clicks "Apply Now" → creates row in `applications` table → shows status (Applied, Under Review, Interviewing, Offered, Not Selected). Students can optionally attach a resume. There are no external application links.

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
- **Listings:** `createListing`, `updateListing`, `getActiveListings`, `getListingById`, `getRecommendedListings`, `getListingViewCounts`, `trackListingView`
- **Applications:** `applyToListing`, `applyToListingWithResume`, `getApplicationStatus`
- **Messaging:** `getConversations`, `getMessagesWith`, `sendMessage`, `markMessagesAsRead`, `getUnreadCount`
- **Constants** (`src/lib/constants.ts`): `INDUSTRIES`, `MAJORS`, `MAJOR_TO_INDUSTRIES`, `SKILLS`

## Test Accounts

| Role | Email | Password |
|------|-------|----------|
| Student | vandegn@miamioh.edu | 111111 |
| Employer | chud@htn.org | 123456 |
| University | helen@unc.edu | 111111 |

## Known Limitations & Future Work

See `docs/ROADMAP.md` for the spec alignment roadmap and deferred items. See `docs/UNIVERSITY_PORTAL_ARCHIVE.md` for documentation of the removed university portal (halted per leadership decision 2026-03-27). Key items:
- Supabase Storage bucket for image uploads needs setup (`images` bucket, public)
- Employer model is 1:1 (one account = one company); a `companies` table is planned
