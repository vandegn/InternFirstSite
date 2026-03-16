# Industry Filter for Internship Listings

## Overview

Add a required industry field to internship listings so students can filter jobs by industry when browsing. Employers select an industry from a preset list when creating a listing. Students see pill/chip filter buttons on the browse page.

## Preset Industries

`Technology`, `Finance`, `Healthcare`, `Marketing`, `Legal`, `Engineering`, `Education`, `Media`, `Nonprofit`, `Government`, `Retail`, `Other`

## Database Changes

Add a required `industry` column to `internship_listings`:

```sql
ALTER TABLE internship_listings
ADD COLUMN industry text NOT NULL DEFAULT 'Other'
CHECK (industry IN ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'));
```

The `DEFAULT 'Other'` handles any existing rows. Update `supabase/schema.sql` to include the column in the CREATE TABLE statement for future reference.

## Listing Creation Form

**File:** `src/app/dashboard/employer/listings/new/page.tsx`

- Add `industry` state variable (default empty string)
- Add a required `<select>` dropdown in the form grid, next to the compensation dropdown
- Label: "Industry"
- Placeholder option: "Select industry..."
- Pass `industry` to `createListing`

## Supabase Helpers

**File:** `src/lib/supabase.ts`

- `createListing`: Add `industry` to the accepted fields
- `getActiveListings`: Add optional `industry?: string` parameter. When provided, chain `.eq('industry', industry)` to the query

## Student Browse Page

**File:** `src/app/dashboard/student/internships/page.tsx`

- Add `selectedIndustry` state (default `''` meaning "All")
- Render a horizontal row of pill/chip buttons above the listing grid
- Pill list: `All`, then each industry from the preset list
- Active pill gets highlighted styling (primary color background, white text)
- Inactive pills get subtle styling (light background, dark text)
- Clicking a pill sets `selectedIndustry` and resets `currentPage` to 1
- Pass `selectedIndustry` to `getActiveListings`
- Add `selectedIndustry` to the `useEffect` dependency array

## Listing Cards & Detail Page

- **Browse cards** (`internships/page.tsx`): Show industry as an additional tag in `listing-tags`
- **Detail page** (`internships/[id]/page.tsx`): Show industry in the meta info section alongside location/remote/compensation
- **Employer dashboard** (`employer/page.tsx`): Show industry tag on listing cards

## Type Updates

Add `industry: string` to all `Listing` type definitions across the affected pages.

## Files Modified

1. `supabase/schema.sql` — add `industry` column to CREATE TABLE
2. `src/lib/supabase.ts` — update `createListing` and `getActiveListings`
3. `src/app/dashboard/employer/listings/new/page.tsx` — add industry dropdown
4. `src/app/dashboard/student/internships/page.tsx` — add pill filter UI
5. `src/app/dashboard/student/internships/[id]/page.tsx` — show industry in detail
6. `src/app/dashboard/employer/page.tsx` — show industry tag on listing cards
