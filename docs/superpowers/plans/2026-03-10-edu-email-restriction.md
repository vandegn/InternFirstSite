# .edu Email Restriction & Partner University Logos — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restrict student/university_admin registration to `.edu` emails and display partner university logos on the student dashboard.

**Architecture:** Add an `isEduEmail(email)` validator used by both auth forms and the supabase helper. Add a `getPartnerUniversity(email)` query to look up partner status. The student dashboard becomes a client component that fetches partner data on mount and passes the logo to its header.

**Tech Stack:** Next.js 16, React 19, Supabase JS, TypeScript

---

## File Structure

- **Modify:** `src/lib/supabase.ts` — add `isEduEmail()` validator and `getPartnerUniversity()` query
- **Modify:** `src/app/register/page.tsx` — add .edu validation for student/university_admin
- **Modify:** `src/app/login/page.tsx` — add .edu validation for student/university_admin
- **Modify:** `src/app/dashboard/student/page.tsx` — make client component, fetch partner university, render logo in header

---

## Chunk 1: Email Validation & Partner Query

### Task 1: Add helper functions to supabase.ts

**Files:**
- Modify: `src/lib/supabase.ts`

- [ ] **Step 1: Add `isEduEmail` validator**

Add to the end of `src/lib/supabase.ts`:

```typescript
export function isEduEmail(email: string): boolean {
  return email.trim().toLowerCase().endsWith('.edu');
}
```

- [ ] **Step 2: Add `getPartnerUniversity` query**

Add below `isEduEmail` in `src/lib/supabase.ts`:

```typescript
export async function getPartnerUniversity(email: string) {
  const domain = email.split('@')[1]?.toLowerCase();
  if (!domain) return null;

  const { data, error } = await supabase
    .from('universities')
    .select('id, name, logo_url')
    .eq('domain', domain)
    .eq('partner', true)
    .single();

  if (error || !data) return null;
  return data;
}
```

- [ ] **Step 3: Add .edu guard to `createProfileAndRoleData`**

In `createProfileAndRoleData`, add this check at the top of the function body (before the profile insert):

```typescript
if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
  throw new Error('Student and university accounts require a .edu email address.');
}
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/supabase.ts
git commit -m "feat: add .edu email validation and partner university query"
```

---

### Task 2: Add .edu validation to registration form

**Files:**
- Modify: `src/app/register/page.tsx`

- [ ] **Step 1: Import `isEduEmail`**

Update the import line in `register/page.tsx`:

```typescript
import { supabase, createProfileAndRoleData, isEduEmail, type RoleData } from '@/lib/supabase';
```

- [ ] **Step 2: Add validation before signup**

In the `handleSubmit` function, after the password match check and before `setLoading(true)`, add:

```typescript
if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
  setError('Student and university accounts require a .edu email address.');
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/register/page.tsx
git commit -m "feat: enforce .edu email on student/university registration"
```

---

### Task 3: Add .edu validation to login form

**Files:**
- Modify: `src/app/login/page.tsx`

- [ ] **Step 1: Import `isEduEmail`**

Update the import in the `LoginForm` component inside `login/page.tsx`:

```typescript
import { supabase, getProfile, DASHBOARD_ROUTES, isEduEmail } from '@/lib/supabase';
```

- [ ] **Step 2: Add validation before sign-in**

In the `handleSubmit` function, after `setLoading(true)` is called but before the `signInWithPassword` call, add:

```typescript
if ((role === 'student' || role === 'university_admin') && !isEduEmail(email)) {
  setError('Student and university accounts require a .edu email address.');
  setLoading(false);
  return;
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/login/page.tsx
git commit -m "feat: enforce .edu email on student/university login"
```

---

## Chunk 2: Partner University Logo on Student Dashboard

### Task 4: Fetch partner university and display logo in student dashboard header

**Files:**
- Modify: `src/app/dashboard/student/page.tsx`

- [ ] **Step 1: Make it a client component and add imports**

Add to the top of `dashboard/student/page.tsx`:

```typescript
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase, getPartnerUniversity } from '@/lib/supabase';
```

Remove the existing `import Link from 'next/link';` line that's already there.

- [ ] **Step 2: Add state and effect for partner university**

Inside `StudentDashboard`, before the return statement, add:

```typescript
const [partnerLogo, setPartnerLogo] = useState<string | null>(null);
const [partnerName, setPartnerName] = useState<string | null>(null);

useEffect(() => {
  async function fetchPartner() {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user?.email) return;
    const partner = await getPartnerUniversity(user.email);
    if (partner) {
      setPartnerLogo(partner.logo_url);
      setPartnerName(partner.name);
    }
  }
  fetchPartner();
}, []);
```

- [ ] **Step 3: Add partner logo to the dashboard header**

In the `dash-header-inner` div, replace the existing logo Link:

```tsx
<Link href="/home" className="logo">
  <img src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png" alt="InternFirst" />
</Link>
{partnerLogo && (
  <>
    <span className="logo-divider"></span>
    <img src={partnerLogo} alt={partnerName || 'University'} className="partner-logo" />
  </>
)}
```

- [ ] **Step 4: Add CSS for logo divider and partner logo**

Add to `globals.css` in the dashboard styles section:

```css
.logo-divider {
    display: inline-block;
    width: 1px;
    height: 28px;
    background: var(--border);
    margin: 0 16px;
    vertical-align: middle;
}

.partner-logo {
    height: 36px;
    width: auto;
    object-fit: contain;
    vertical-align: middle;
}
```

- [ ] **Step 5: Build and verify**

Run: `npm run build`
Expected: Build succeeds with no errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/dashboard/student/page.tsx src/app/globals.css
git commit -m "feat: display partner university logo on student dashboard"
```
