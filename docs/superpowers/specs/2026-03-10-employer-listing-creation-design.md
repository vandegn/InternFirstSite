# Employer Listing Creation

## Overview

Allow employers to create internship listings via a form, and wire the employer dashboard to display real listings from Supabase.

## Listing Creation Form

**Route:** `/dashboard/employer/listings/new`

**Form fields** (matching `internship_listings` schema):
- Title (text, required)
- Description (textarea, required)
- Location (text)
- Remote? (checkbox)
- Compensation (text, e.g., "$16-20/hr")
- Requirements (textarea)

**Styling:** Reuses existing auth form classes (`.auth-page`, `.auth-container`, `.form-group`, `.btn-auth`).

**Submit flow:**
1. Fetch employer record from `employers` table using `auth.uid()`
2. Insert into `internship_listings` with that `employer_id`
3. On success, redirect to `/dashboard/employer`
4. On error, display error message in the form

## Dashboard Wiring

- "My Listings" section fetches real listings from `internship_listings` for the logged-in employer
- "Active Listings" stat card shows the real count
- "Post New Listing" button added to My Listings section header, links to the creation form

## Affected Files

- Create: `src/app/dashboard/employer/listings/new/page.tsx` — listing creation form
- Modify: `src/lib/supabase.ts` — add `getEmployerByUserId()` and `createListing()` helpers
- Modify: `src/app/dashboard/employer/page.tsx` — make client component, fetch real listings and stats
