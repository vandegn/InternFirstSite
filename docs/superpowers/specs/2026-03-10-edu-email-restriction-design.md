# .edu Email Restriction & Partner University Logos

## Overview

Restrict student and university_admin registration/login to `.edu` email domains. When a student's email domain matches a paying partner university, display that university's logo alongside the InternFirst logo in the header.

## Email Validation

- Student and university_admin roles require `.edu` email addresses
- Employer role is unaffected (any email)
- Client-side validation on registration and login forms provides instant feedback
- Server-side validation in `createProfileAndRoleData` as a safety net
- Error message: "Student and university accounts require a .edu email address"

## Partner University Matching

- After authentication, extract the user's email domain (e.g., `unc.edu`)
- Query `universities` table: `WHERE domain = <extracted_domain> AND partner = true`
- If matched, store the university's `logo_url` and `name` for the dashboard session
- If no match (valid `.edu` but not a partner), student gets full access without partner branding

## Logo Placement

- Header component: partner logo appears to the right of the InternFirst logo
- Separated by a subtle vertical divider
- Partner logo sized smaller than InternFirst logo (co-branded feel)
- Only rendered when a partner university match exists for the logged-in user

## Data Flow

1. User registers/logs in with `.edu` email
2. Post-auth: fetch profile, extract email domain, query `universities` table
3. Store partner university info (logo_url, name) via helper in `supabase.ts`
4. Header conditionally renders partner logo

## Affected Files

- `src/app/login/page.tsx` — add .edu validation for student/university roles
- `src/app/register/page.tsx` — add .edu validation for student/university roles
- `src/lib/supabase.ts` — add `getPartnerUniversity(email)` helper, add .edu check in `createProfileAndRoleData`
- `src/components/Header.tsx` — conditionally render partner logo
- `src/app/dashboard/student/page.tsx` — fetch and pass partner university data
- `supabase/schema.sql` — no changes needed (universities table already has domain, logo_url, partner columns)
