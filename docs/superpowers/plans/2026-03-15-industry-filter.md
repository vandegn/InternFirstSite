# Industry Filter Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a required industry field to internship listings and let students filter by industry with pill buttons.

**Architecture:** Shared constants file defines the industry list. Supabase helpers gain an industry filter parameter. The employer creation form gets a required dropdown, and the student browse page gets pill filter buttons. All listing displays show the industry tag.

**Tech Stack:** Next.js (React 19), TypeScript, Supabase, Tailwind CSS

**Spec:** `docs/superpowers/specs/2026-03-15-industry-filter-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `supabase/schema.sql` | Modify | Add `industry` column + index to CREATE TABLE (documentation) |
| `app/src/lib/constants.ts` | Create | Shared `INDUSTRIES` array |
| `app/src/lib/supabase.ts` | Modify | Add `industry` to `createListing`, add filter param to `getActiveListings` |
| `app/src/app/dashboard/employer/listings/new/page.tsx` | Modify | Industry dropdown in creation form |
| `app/src/app/dashboard/student/internships/page.tsx` | Modify | Pill filter UI + industry tag on cards |
| `app/src/app/dashboard/student/internships/[id]/page.tsx` | Modify | Industry in detail meta info |
| `app/src/app/dashboard/employer/page.tsx` | Modify | Industry tag on employer listing cards |

---

### Task 1: Database schema + shared constants

**Files:**
- Modify: `supabase/schema.sql:80-92`
- Create: `app/src/lib/constants.ts`

- [ ] **Step 1: Run the migration in Supabase SQL Editor**

Open the Supabase Dashboard > SQL Editor > New Query and run:

```sql
ALTER TABLE internship_listings
ADD COLUMN industry text NOT NULL DEFAULT 'Other';

ALTER TABLE internship_listings
ADD CONSTRAINT internship_listings_industry_check
CHECK (industry IN ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'));

CREATE INDEX idx_listings_industry ON internship_listings(industry);
```

- [ ] **Step 2: Update schema.sql for documentation**

In `supabase/schema.sql`, add `industry` and `external_apply_url` to the `internship_listings` CREATE TABLE (after the `requirements` line, before `status`). Note: `external_apply_url` is already used in code but was missing from the schema documentation.

```sql
  external_apply_url text,
  industry text not null default 'Other' check (industry in ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other')),
```

Add the index in the INDEXES section:

```sql
create index idx_listings_industry on internship_listings(industry);
```

- [ ] **Step 3: Create shared constants file**

Create `app/src/lib/constants.ts`:

```typescript
export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'Marketing',
  'Legal',
  'Engineering',
  'Education',
  'Media',
  'Nonprofit',
  'Government',
  'Retail',
  'Other',
] as const;

export type Industry = (typeof INDUSTRIES)[number];
```

- [ ] **Step 4: Commit**

```bash
git add supabase/schema.sql app/src/lib/constants.ts
git commit -m "feat: add industry column to schema and shared constants"
```

---

### Task 2: Supabase helpers

**Files:**
- Modify: `app/src/lib/supabase.ts:157-200`

- [ ] **Step 1: Add `industry` to `createListing` parameter type**

In `app/src/lib/supabase.ts`, find the `createListing` function (line 157). Add `industry: string;` to the parameter object type, after `requirements`:

```typescript
export async function createListing(listing: {
  employer_id: string;
  title: string;
  description: string;
  location?: string;
  is_remote?: boolean;
  compensation?: string;
  requirements?: string;
  industry: string;
  external_apply_url?: string;
}) {
```

No other changes needed to `createListing` — it already passes the whole `listing` object to `.insert()`.

- [ ] **Step 2: Add `industry` filter to `getActiveListings`**

Find `getActiveListings` (line 189). Add an optional `industry` parameter and conditionally filter:

```typescript
export async function getActiveListings(page = 1, pageSize = 10, industry?: string) {
  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;
  let query = supabase
    .from('internship_listings')
    .select('*, employers(company_name, logo_url)', { count: 'exact' })
    .eq('status', 'active');

  if (industry) {
    query = query.eq('industry', industry);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) return { data: [], totalCount: 0 };
  return { data: data ?? [], totalCount: count ?? 0 };
}
```

- [ ] **Step 3: Commit**

```bash
git add app/src/lib/supabase.ts
git commit -m "feat: add industry to createListing and getActiveListings helpers"
```

---

### Task 3: Employer listing creation form

**Files:**
- Modify: `app/src/app/dashboard/employer/listings/new/page.tsx`

- [ ] **Step 1: Add industry import and state**

At the top of `app/src/app/dashboard/employer/listings/new/page.tsx`, add the import:

```typescript
import { INDUSTRIES } from '@/lib/constants';
```

Inside the component, add state alongside the other form states (after line 17):

```typescript
const [industry, setIndustry] = useState('');
```

- [ ] **Step 2: Add industry dropdown to the form**

In the `<div className="form-grid">` section, add a new form group **inside** the grid, between the compensation group (ends line 95) and the location group (starts line 96):

```tsx
<div className="form-group">
  <label htmlFor="industry">Industry</label>
  <select
    id="industry"
    value={industry}
    onChange={(e) => setIndustry(e.target.value)}
    required
    style={{ width: '100%' }}
  >
    <option value="">Select industry...</option>
    {INDUSTRIES.map((ind) => (
      <option key={ind} value={ind}>{ind}</option>
    ))}
  </select>
</div>
```

- [ ] **Step 3: Pass industry to createListing**

In the `handleSubmit` function, add `industry` to the `createListing` call (around line 32):

```typescript
await createListing({
  employer_id: employer.id,
  title,
  description,
  location: location || undefined,
  is_remote: isRemote,
  compensation: compensation || undefined,
  requirements: requirements || undefined,
  industry,
  external_apply_url: externalApplyUrl || undefined,
});
```

- [ ] **Step 4: Verify the form renders**

Run: `cd app && npm run dev`

Navigate to `/dashboard/employer/listings/new` and confirm the industry dropdown appears in the form grid, is required, and shows all 12 industry options.

- [ ] **Step 5: Commit**

```bash
git add app/src/app/dashboard/employer/listings/new/page.tsx
git commit -m "feat: add industry dropdown to listing creation form"
```

---

### Task 4: Student browse page — pill filter + industry tag

**Files:**
- Modify: `app/src/app/dashboard/student/internships/page.tsx`

- [ ] **Step 1: Add imports, state, and type update**

Add the import at the top:

```typescript
import { INDUSTRIES } from '@/lib/constants';
```

Add `industry: string;` to the local `Listing` type (after `requirements`):

```typescript
type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  requirements: string | null;
  industry: string;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
  };
};
```

Add state inside the component:

```typescript
const [selectedIndustry, setSelectedIndustry] = useState('');
```

- [ ] **Step 2: Update the useEffect to pass industry filter**

Update the `fetchListings` call and dependency array:

```typescript
useEffect(() => {
  async function fetchListings() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const result = await getActiveListings(currentPage, PAGE_SIZE, selectedIndustry || undefined);
    setListings(result.data as Listing[]);
    setTotalCount(result.totalCount);
    setLoading(false);
  }
  fetchListings();
}, [currentPage, selectedIndustry]);
```

- [ ] **Step 3: Add pill filter handler**

Add this handler inside the component:

```typescript
function handleIndustryFilter(industry: string) {
  setSelectedIndustry(industry);
  setCurrentPage(1);
}
```

- [ ] **Step 4: Add pill filter UI**

Add the pill row between the header `<div>` (line 57-62) and the loading check (line 64). Place it right after the closing `</div>` of the header:

```tsx
<div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
  <button
    onClick={() => handleIndustryFilter('')}
    style={{
      padding: '6px 16px',
      borderRadius: '20px',
      border: 'none',
      cursor: 'pointer',
      fontSize: '0.85rem',
      fontWeight: 500,
      background: selectedIndustry === '' ? 'var(--primary)' : 'var(--primary-light)',
      color: selectedIndustry === '' ? '#fff' : 'var(--primary)',
      transition: 'var(--transition)',
    }}
  >
    All
  </button>
  {INDUSTRIES.map((ind) => (
    <button
      key={ind}
      onClick={() => handleIndustryFilter(ind)}
      style={{
        padding: '6px 16px',
        borderRadius: '20px',
        border: 'none',
        cursor: 'pointer',
        fontSize: '0.85rem',
        fontWeight: 500,
        background: selectedIndustry === ind ? 'var(--primary)' : 'var(--primary-light)',
        color: selectedIndustry === ind ? '#fff' : 'var(--primary)',
        transition: 'var(--transition)',
      }}
    >
      {ind}
    </button>
  ))}
</div>
```

- [ ] **Step 5: Add industry tag to listing cards**

Inside the `listing-tags` div in the listing card (around line 96-99), add the industry tag:

```tsx
<div className="listing-tags">
  <span>{listing.industry}</span>
  {listing.is_remote && <span>Remote</span>}
  {listing.location && !listing.is_remote && <span>On-site</span>}
</div>
```

- [ ] **Step 6: Verify in browser**

Run: `cd app && npm run dev`

Navigate to `/dashboard/student/internships`. Confirm:
- Pill buttons render in a row above the listing grid
- "All" is highlighted by default
- Clicking a pill filters the listings
- Industry tag appears on each listing card
- Pagination resets when changing filter

- [ ] **Step 7: Commit**

```bash
git add app/src/app/dashboard/student/internships/page.tsx
git commit -m "feat: add industry pill filter and tags to student browse page"
```

---

### Task 5: Listing detail page — show industry

**Files:**
- Modify: `app/src/app/dashboard/student/internships/[id]/page.tsx`

- [ ] **Step 1: Add industry to Listing type**

Add `industry: string;` to the local `Listing` type (after `external_apply_url`):

```typescript
type Listing = {
  id: string;
  title: string;
  description: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  requirements: string | null;
  external_apply_url: string | null;
  industry: string;
  created_at: string;
  employers: {
    company_name: string;
    logo_url: string | null;
    website: string | null;
  };
};
```

- [ ] **Step 2: Add industry to meta info section**

In the meta info `<div>` (around line 119-142), add an industry badge after the compensation block:

```tsx
<div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg>
  {listing.industry}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/student/internships/\[id\]/page.tsx
git commit -m "feat: show industry on listing detail page"
```

---

### Task 6: Employer dashboard — industry tag on listing cards

**Files:**
- Modify: `app/src/app/dashboard/employer/page.tsx`

- [ ] **Step 1: Add industry to Listing type**

Add `industry: string;` to the local `Listing` type (after `status`):

```typescript
type Listing = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  status: string;
  industry: string;
  created_at: string;
};
```

- [ ] **Step 2: Add industry tag to listing cards**

In the `listing-tags` div (around line 237-240), add the industry tag:

```tsx
<div className="listing-tags">
  <span>{listing.industry}</span>
  <span>{listing.status === 'active' ? 'Active' : 'Closed'}</span>
  {listing.is_remote && <span>Remote</span>}
</div>
```

- [ ] **Step 3: Commit**

```bash
git add app/src/app/dashboard/employer/page.tsx
git commit -m "feat: show industry tag on employer dashboard listing cards"
```

---

### Task 7: Build verification

- [ ] **Step 1: Run the build**

```bash
cd app && npm run build
```

Expected: Build completes with no errors.

- [ ] **Step 2: Run lint**

```bash
cd app && npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Manual smoke test**

1. Create a new listing as employer — verify industry dropdown is required and submits correctly
2. Browse internships as student — verify pills filter correctly, industry tags show
3. Click into a listing detail — verify industry appears in meta info
4. Check employer dashboard — verify industry tag on listing cards
