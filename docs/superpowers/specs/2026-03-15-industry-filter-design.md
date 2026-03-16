# Industry Filter for Internship Listings

## Overview

Add a required industry field to internship listings so students can filter jobs by industry when browsing. Employers select an industry from a preset list when creating a listing. Students see pill/chip filter buttons on the browse page.

## Preset Industries

`Technology`, `Finance`, `Healthcare`, `Marketing`, `Legal`, `Engineering`, `Education`, `Media`, `Nonprofit`, `Government`, `Retail`, `Other`

Define a shared `INDUSTRIES` constant array in `app/src/lib/constants.ts` and import it wherever the list is needed (employer form, student pills). The database CHECK constraint is maintained separately in SQL.

## Database Changes

Add a required `industry` column to `internship_listings`. Run this in the Supabase SQL Editor as a migration:

```sql
ALTER TABLE internship_listings
ADD COLUMN industry text NOT NULL DEFAULT 'Other';

ALTER TABLE internship_listings
ADD CONSTRAINT internship_listings_industry_check
CHECK (industry IN ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'));

CREATE INDEX idx_listings_industry ON internship_listings(industry);
```

The `DEFAULT 'Other'` handles any existing rows. Also update `supabase/schema.sql` to include the column in the CREATE TABLE statement for documentation/future reference.

## Listing Creation Form

**File:** `app/src/app/dashboard/employer/listings/new/page.tsx`

- Add `industry` state variable (default empty string)
- Add a required `<select>` dropdown in the form grid, next to the compensation dropdown
- Label: "Industry"
- Placeholder option: "Select industry..."
- Import industries from shared constant
- Pass `industry` to `createListing`

## Supabase Helpers

**File:** `app/src/lib/supabase.ts`

- `createListing`: Add `industry` to the accepted fields
- `getActiveListings`: Add optional `industry?: string` parameter. When provided (non-empty), chain `.eq('industry', industry)` to the query. Empty string means no filter.

## Student Browse Page

**File:** `app/src/app/dashboard/student/internships/page.tsx`

- Add `selectedIndustry` state (default `''` meaning "All" / no filter)
- Render a horizontal row of pill/chip buttons above the listing grid
- Pill list: `All`, then each industry from the shared constant
- Active pill gets highlighted styling (primary color background, white text)
- Inactive pills get subtle styling (light background, dark text)
- Clicking a pill sets `selectedIndustry` and resets `currentPage` to 1
- Pass `selectedIndustry` to `getActiveListings`
- `selectedIndustry` MUST be in the `useEffect` dependency array (required for filtering to work when already on page 1)

## Listing Cards & Detail Page

- **Browse cards** (`app/src/app/dashboard/student/internships/page.tsx`): Show industry as an additional tag in `listing-tags`
- **Detail page** (`app/src/app/dashboard/student/internships/[id]/page.tsx`): Show industry in the meta info section alongside location/remote/compensation
- **Employer dashboard** (`app/src/app/dashboard/employer/page.tsx`): Show industry tag on listing cards

## Type Updates

Add `industry: string` to the local `Listing` type definitions in each affected page (three separate type definitions exist across the browse page, detail page, and employer dashboard).

## Files Modified

1. `supabase/schema.sql` — add `industry` column to CREATE TABLE, add index
2. `app/src/lib/constants.ts` — new file, shared `INDUSTRIES` array
3. `app/src/lib/supabase.ts` — update `createListing` and `getActiveListings`
4. `app/src/app/dashboard/employer/listings/new/page.tsx` — add industry dropdown
5. `app/src/app/dashboard/student/internships/page.tsx` — add pill filter UI, show industry tag
6. `app/src/app/dashboard/student/internships/[id]/page.tsx` — show industry in detail
7. `app/src/app/dashboard/employer/page.tsx` — show industry tag on listing cards
