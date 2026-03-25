# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

InternFirstSite is a premium internship recruitment platform connecting students, employers, and universities. Built with Next.js 16, React 19, TypeScript, Tailwind CSS 4, and Supabase.

**Core principle: Closed ecosystem.** Everything happens on the platform — job listings, applications, interviews, and hiring. There are no external job links or off-platform redirects. Students apply in-platform, employers review and manage candidates in-platform, and all communication stays within InternFirst.

## Repository Structure

The Next.js application lives inside the `app/` subdirectory (not the repo root). All npm commands must be run from `app/`.

```
InternFirstSite/
├── app/                    # Next.js application root
│   ├── src/
│   │   ├── app/           # App Router pages and layouts
│   │   ├── components/    # Shared components (Header, Footer, RoleSelector)
│   │   └── lib/           # Supabase client and helpers
│   ├── public/            # Static assets
│   ├── .env.local         # Supabase credentials
│   └── package.json
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

**Three user roles** drive the entire application: `student`, `employer`, `university_admin`. Each role has its own dashboard (`/dashboard/student`, `/dashboard/employer`, `/dashboard/university`), role-specific registration fields, and database tables.

**Route protection:** `src/app/dashboard/layout.tsx` wraps all dashboard routes with client-side auth checks. It verifies the user is logged in, has a profile, and is accessing the correct dashboard for their role. Unauthorized users get redirected to `/login`, `/register`, or their correct dashboard. There is no middleware — all checks run in a `useEffect`.

**Auth flow:** Supabase Auth (email/password + Google OAuth) → email verification required (Supabase built-in, skipped for OAuth) → `/auth/callback` server route creates profile + role data from `user_metadata` → role-based redirect to dashboard. Unverified users are redirected to `/verify-email`. `.edu` email required for students and university admins. Key auth helpers are in `src/lib/supabase.ts` (`getProfile`, `createProfileAndRoleData`, `isEduEmail`).

**Database:** Supabase PostgreSQL with RLS enabled on all tables. Core tables: `profiles`, `students`, `employers`, `university_admins`, `universities`, `internship_listings`, `applications`, `messages`. Schema is in `supabase/schema.sql`.

**Styling:** Global CSS variables in `globals.css` (primary color `#7B61FF`), Tailwind CSS utilities, and custom component classes (`.btn-*`, `.card-*`, `.stat-card`, `.dash-*`, `.listing-card`, `.avatar-dropdown`). Font: DM Sans.

**Path alias:** `@/*` maps to `./src/*` in tsconfig.

## Listing Flow

Employers create listings at `/dashboard/employer/listings/new`. Compensation uses a preset dropdown (e.g. "$15-20/hr", "Unpaid", "Stipend"). Industry is a required preset dropdown.

Students browse active listings at `/dashboard/student/internships` (filterable by industry pills) and view details at `/dashboard/student/internships/[id]`. The student dashboard shows a "Recommended for You" section based on the student's major-to-industry mapping.

All applications are in-platform: student clicks "Apply Now" → creates row in `applications` table → shows status (Applied, Under Review, Interviewing, Offered, Not Selected). There are no external application links.

## Key Conventions

- Pages use `"use client"` directive — currently client-side heavy with Supabase JS calls
- Dashboard pages are self-contained: each role's page embeds its own header, sidebar, and layout inline (not shared components). The shared components in `src/components/` (Header, Footer, RoleSelector) are only used on public/auth pages.
- Each dashboard header shows a portal label (e.g. "Student Dashboard") next to the logo and an avatar dropdown with sign-out
- Dashboard nav links are role-scoped — no cross-role navigation
- `DASHBOARD_ROUTES` in `supabase.ts` maps roles to their dashboard paths
- CSS follows a pattern of global custom properties + component-scoped class names in `globals.css`

## Supabase Helpers (src/lib/supabase.ts)

- **Auth/Profile:** `getProfile`, `createProfileAndRoleData`, `isEduEmail`, `getPartnerUniversity`, `getAllUniversities`, `uploadImage`
- **Employers:** `getEmployerByUserId`, `getEmployerListings`, `updateEmployer`
- **Students:** `getStudentByUserId`
- **Listings:** `createListing`, `getActiveListings`, `getListingById`, `getRecommendedListings`
- **Applications:** `applyToListing`, `getApplicationStatus`
- **Constants:** `INDUSTRIES`, `MAJORS`, `MAJOR_TO_INDUSTRIES` in `src/lib/constants.ts`

## Known Limitations & Future Work

See `docs/TODO.md` for a tracked list of deferred items. Key items:
- University admin email domain is not validated against the selected university's domain
- Supabase Storage bucket for image uploads needs setup (`images` bucket, public)
- Employer model is 1:1 (one account = one company); a `companies` table is planned
- University dashboard uses hardcoded placeholder data
