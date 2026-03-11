# Employer Listing Creation — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow employers to create internship listings and display real listings on their dashboard.

**Architecture:** Add Supabase helper functions for employer lookup and listing CRUD. Create a new form page at `/dashboard/employer/listings/new` using existing auth form styling. Wire the employer dashboard to fetch real data on mount.

**Tech Stack:** Next.js 16, React 19, Supabase JS, TypeScript

---

## File Structure

- **Modify:** `src/lib/supabase.ts` — add `getEmployerByUserId()`, `createListing()`, `getEmployerListings()` helpers
- **Create:** `src/app/dashboard/employer/listings/new/page.tsx` — listing creation form
- **Modify:** `src/app/dashboard/employer/page.tsx` — make client component, fetch real listings and stats

---

## Chunk 1: Supabase Helpers & Listing Form

### Task 1: Add Supabase helper functions

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add `getEmployerByUserId` function**

Append to end of `src/lib/supabase.ts`:

```typescript
export async function getEmployerByUserId(userId: string) {
  const { data, error } = await supabase
    .from('employers')
    .select('*')
    .eq('user_id', userId)
    .single();
  if (error || !data) return null;
  return data;
}
```

- [ ] **Step 2: Add `createListing` function**

Append below `getEmployerByUserId`:

```typescript
export async function createListing(listing: {
  employer_id: string;
  title: string;
  description: string;
  location?: string;
  is_remote?: boolean;
  compensation?: string;
  requirements?: string;
}) {
  const { data, error } = await supabase
    .from('internship_listings')
    .insert(listing)
    .select()
    .single();
  if (error) throw error;
  return data;
}
```

- [ ] **Step 3: Add `getEmployerListings` function**

Append below `createListing`:

```typescript
export async function getEmployerListings(employerId: string) {
  const { data, error } = await supabase
    .from('internship_listings')
    .select('*')
    .eq('employer_id', employerId)
    .order('created_at', { ascending: false });
  if (error) return [];
  return data;
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add employer and listing Supabase helpers"
```

---

### Task 2: Create the listing form page

**Files:**
- Create: `src/app/dashboard/employer/listings/new/page.tsx`

- [ ] **Step 1: Create the form page**

Create `src/app/dashboard/employer/listings/new/page.tsx` with this content:

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase, getEmployerByUserId, createListing } from '@/lib/supabase';

export default function NewListingPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [isRemote, setIsRemote] = useState(false);
  const [compensation, setCompensation] = useState('');
  const [requirements, setRequirements] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('You must be logged in.');

      const employer = await getEmployerByUserId(user.id);
      if (!employer) throw new Error('Employer profile not found.');

      await createListing({
        employer_id: employer.id,
        title,
        description,
        location: location || undefined,
        is_remote: isRemote,
        compensation: compensation || undefined,
        requirements: requirements || undefined,
      });

      router.push('/dashboard/employer');
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-container" style={{ maxWidth: 680 }}>
        <div className="auth-logo">
          <Link href="/dashboard/employer">
            <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
          </Link>
        </div>
        <h1>Post New Listing</h1>
        <p className="auth-subtitle">Create an internship listing to find great candidates.</p>

        {error && <div className="auth-error" style={{ display: 'block' }}>{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <div className="form-group">
              <label htmlFor="title">Job Title</label>
              <input
                type="text"
                id="title"
                placeholder="e.g. Software Engineer Intern"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="compensation">Compensation</label>
              <input
                type="text"
                id="compensation"
                placeholder="e.g. $16-20/hr"
                value={compensation}
                onChange={(e) => setCompensation(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label htmlFor="location">Location</label>
              <input
                type="text"
                id="location"
                placeholder="e.g. Raleigh, NC"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
            <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: 12, paddingTop: 28 }}>
              <input
                type="checkbox"
                id="isRemote"
                checked={isRemote}
                onChange={(e) => setIsRemote(e.target.checked)}
                style={{ width: 'auto' }}
              />
              <label htmlFor="isRemote" style={{ margin: 0 }}>Remote position</label>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              placeholder="Describe the role, responsibilities, and what the intern will learn..."
              required
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <div className="form-group">
            <label htmlFor="requirements">Requirements</label>
            <textarea
              id="requirements"
              placeholder="List skills, qualifications, or experience needed..."
              rows={4}
              value={requirements}
              onChange={(e) => setRequirements(e.target.value)}
              style={{ width: '100%', resize: 'vertical' }}
            />
          </div>

          <button type="submit" className="btn-auth" disabled={loading}>
            {loading ? 'Posting...' : 'Post Listing'}
          </button>
        </form>

        <p className="auth-footer">
          <Link href="/dashboard/employer">← Back to Dashboard</Link>
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify build**

Run: `cd app && npm run build`
Expected: Build succeeds, `/dashboard/employer/listings/new` appears in route list.

- [ ] **Step 3: Commit**

```bash
git add src/app/dashboard/employer/listings/new/page.tsx
git commit -m "feat: add employer listing creation form"
```

---

## Chunk 2: Wire Employer Dashboard to Real Data

### Task 3: Make employer dashboard dynamic

**Files:**
- Modify: `src/app/dashboard/employer/page.tsx`

- [ ] **Step 1: Add client directive, imports, and state**

Replace the top of `src/app/dashboard/employer/page.tsx` (the import and function declaration) with:

```tsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getEmployerByUserId, getEmployerListings } from '@/lib/supabase';

type Listing = {
  id: string;
  title: string;
  location: string | null;
  is_remote: boolean;
  compensation: string | null;
  status: string;
  created_at: string;
};

export default function EmployerDashboard() {
  const [listings, setListings] = useState<Listing[]>([]);
  const [companyName, setCompanyName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const employer = await getEmployerByUserId(user.id);
      if (!employer) return;

      setCompanyName(employer.company_name);
      const data = await getEmployerListings(employer.id);
      setListings(data);
      setLoading(false);
    }
    fetchData();
  }, []);
```

- [ ] **Step 2: Add "Post New Listing" button to My Listings section**

Replace the My Listings section title:

```tsx
<h3 className="dash-section-title">My Listings</h3>
```

with:

```tsx
<div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
  <h3 className="dash-section-title">My Listings</h3>
  <Link href="/dashboard/employer/listings/new" className="btn-primary" style={{ fontSize: '0.85rem', padding: '8px 16px' }}>
    + Post New Listing
  </Link>
</div>
```

- [ ] **Step 3: Replace hardcoded listing cards with dynamic data**

Replace the two hardcoded `listing-card` divs inside the My Listings `listing-grid` with:

```tsx
{listings.length === 0 && !loading ? (
  <p style={{ color: 'var(--text-secondary)', padding: '20px 0' }}>
    No listings yet. Post your first internship!
  </p>
) : (
  listings.map((listing) => (
    <div className="listing-card" key={listing.id}>
      <div className="listing-header">
        <div className="listing-logo" style={{ width: 40, height: 40, borderRadius: 8, background: 'var(--primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, color: 'var(--primary)' }}>
          {companyName.charAt(0)}
        </div>
      </div>
      <h4>{listing.title}</h4>
      <p className="listing-company">{companyName}</p>
      <p className="listing-location">{listing.location || 'Not specified'}</p>
      <div className="listing-tags">
        <span>{listing.status === 'active' ? 'Active' : 'Closed'}</span>
        {listing.is_remote && <span>Remote</span>}
      </div>
      <div className="listing-footer">
        <span className="listing-salary">{listing.compensation || 'TBD'}</span>
        <span className="listing-time">{new Date(listing.created_at).toLocaleDateString()}</span>
      </div>
    </div>
  ))
)}
```

- [ ] **Step 4: Update Active Listings stat to use real count**

Replace the hardcoded `0` in the Active Listings stat card:

```tsx
<div className="stat-value">0</div>
```

(the first one, under "Active Listings") with:

```tsx
<div className="stat-value">{listings.filter(l => l.status === 'active').length}</div>
```

- [ ] **Step 5: Update the header logo link**

Change `<Link href="/" className="logo">` to `<Link href="/home" className="logo">` in the dashboard header.

- [ ] **Step 6: Verify build**

Run: `cd app && npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 7: Commit**

```bash
git add src/app/dashboard/employer/page.tsx
git commit -m "feat: wire employer dashboard to real Supabase listings"
```
