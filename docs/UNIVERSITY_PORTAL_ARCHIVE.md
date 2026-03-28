# University Portal — Archive Documentation

Removed from production on 2026-03-27 per leadership decision to halt university portal development. This document captures what was built for potential re-implementation.

---

## Overview

The university portal was a third role (`university_admin`) alongside `student` and `employer`. University admins managed events, viewed analytics about their students, and created employer partnerships for school-affiliated job listings. Students could browse partner-specific listings and RSVP to university events.

---

## Database Tables (from `supabase/schema.sql`)

### `universities`
Central registry of partner universities.
```sql
create table universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,         -- e.g. 'unc.edu'
  partner boolean default false,
  enrollment_size integer,
  contract_start date,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### `university_admins`
Role-specific data for university admin users.
```sql
create table university_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete cascade not null unique,
  university_id uuid references universities(id) not null,
  job_title text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### `university_events`
Events created by university admins (career fairs, workshops, info sessions, networking).
```sql
create table university_events (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade not null,
  created_by uuid references university_admins(id) on delete cascade not null,
  title text not null,
  description text,
  event_type text not null check (event_type in ('career_fair', 'info_session', 'workshop', 'networking', 'other')),
  event_date date not null,
  start_time time not null,
  end_time time,
  location text,
  is_virtual boolean default false,
  virtual_link text,
  max_attendees integer,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);
```

### `event_registrations`
Student RSVP tracking for events.
```sql
create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references university_events(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  registered_at timestamptz default now() not null,
  unique(event_id, student_id)
);
```

### `university_employer_partnerships`
Linked employers to universities for school-affiliated job listings.
```sql
create table university_employer_partnerships (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now() not null,
  unique(university_id, employer_id)
);
```

### Modified tables
- `profiles.role` included `'university_admin'` in its check constraint
- `students.university_id` was a FK to `universities(id)` for affiliation

---

## Supabase Helper Functions (from `src/lib/supabase.ts`)

### Auth/Registration
- `getAllUniversities()` — fetched list for registration dropdown
- `getPartnerUniversity(email)` — matched email domain to partner university, returned id/name/logo_url
- `createProfileAndRoleData()` included a `university_admin` branch inserting into `university_admins`
- `DASHBOARD_ROUTES` included `university_admin: '/dashboard/university'`
- `RoleData` type included `universityName`, `universityId`, `jobTitle`

### University Dashboard Stats
- `getUniversityStats(universityId)` — students enrolled, total applications, offers, interviewing
- `getTopEmployersForUniversity(universityId, limit)` — top employers by application count
- `getPlacementCities(universityId)` — cities where students received offers

### Events
- `getEventById(eventId)` — event with university name/logo
- `getEventRegistrationCount(eventId)` — RSVP count
- `registerForEvent(eventId, studentId)` — student RSVP
- `unregisterFromEvent(eventId, studentId)` — cancel RSVP
- `isRegisteredForEvent(eventId, studentId)` — check registration status

### Partner Listings
- `getUniversityPartnerListings(universityId, page, pageSize, industry?)` — listings from partner employers only

---

## Pages & Routes

### University Admin Dashboard (`/dashboard/university`)
- **Home** (`page.tsx`) — KPI dashboard with stats cards (students enrolled, applications, offers, interviewing, offer rate), upcoming events list, top employers chart, placement cities bar chart, news section
- **Events** (`events/page.tsx`) — list of all events created by the university, with registration counts, past event indicators, pagination
- **Create Event** (`events/new/page.tsx`) — form for creating events (title, type, date, time, location, virtual support, max attendees, description)

### Student-facing University Features
- **School Jobs** (`/dashboard/student/school-jobs`) — split-view portal showing listings from university's employer partners, branded with university logo/name, filterable by industry/location/pay/work mode
- **Events** (`/dashboard/student/events`) — upcoming university events with RSVP status badges, pagination
- **Event Detail** (`/dashboard/student/events/[id]`) — full event info with register/unregister functionality, virtual link revealed after RSVP
- **Student Dashboard Home** — left column showed "School Events" list with links to event detail pages, Calendar component populated with university events

### Navigation
- `DashboardShell.tsx` contained `UNIVERSITY_NAV` with routes: KPI Dashboard, Posted Jobs, Calendar, Surveys, CRM, Messages, Account, Settings (many not implemented)
- `DashboardShell.tsx` showed partner university logo in the header for students and university admins
- `STUDENT_NAV` included a "School Jobs" entry
- `RoleSelector.tsx` had a third "University" radio option
- `Footer.tsx` linked to `/dashboard/university`

### Auth Flow
- `login/page.tsx` included `university_admin` in VALID_ROLES, enforced .edu email
- `register/page.tsx` showed university selector dropdown and job title field when role = `university_admin`

---

## RLS Policies

Key policies that were in place:
- University admins could manage their own `university_admins` record
- University admins could manage events at their university
- Students could view events at their affiliated university
- Students could register/cancel/view their own event registrations
- University admins could view registrations for their events
- University admins could manage partnerships for their university
- All authenticated users could view active partnerships and universities

---

## Roadmap Items (from `docs/ROADMAP.md` Phase 3)

Features that were planned but not built:
- Institutional branding (school colors, multi-user per institution)
- Posted Jobs management (approve/edit/remove affiliated postings)
- Calendar view for events
- Survey system (create, distribute, analyze)
- University CRM (student case management, advisor notes, appointments)
- University inbox (messaging)
- Account page (school profile, user management, club accounts)
- Settings (permissions, branding controls, notifications, data access)
- QR code check-in for events
- Club-hosted events with scoped visibility

---

## Re-implementation Notes

If re-implementing, key considerations:
1. The `universities` table and `students.university_id` FK were central — they connected students to their school for events, partner listings, and stats
2. Events were tightly coupled to universities — a standalone event system would need a different ownership model
3. Partner listings depended on `university_employer_partnerships` — without it, school-affiliated job filtering has no data source
4. The `.edu` email requirement for university admins was enforced at both login and registration
5. The schema included comprehensive RLS policies — any re-implementation should restore equivalent row-level security
