# Email Verification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add email verification to the registration flow so users must confirm their email before their profile/role data is created.

**Architecture:** Supabase's built-in email confirmation sends a verification link. Registration stores form data in `user_metadata`. A server-side `/auth/callback` route exchanges the token, reads metadata, creates the profile, and redirects to the dashboard.

**Tech Stack:** Next.js 16 (App Router), Supabase Auth, @supabase/ssr (new), TypeScript

**Spec:** `docs/superpowers/specs/2026-03-24-email-verification-design.md`

---

### Task 1: Install @supabase/ssr

**Files:**
- Modify: `app/package.json`

- [ ] **Step 1: Install the package**

Run from `app/`:
```bash
cd app && npm install @supabase/ssr
```

- [ ] **Step 2: Verify installation**

Run: `cd app && node -e "require('@supabase/ssr')"`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/package.json app/package-lock.json
git commit -m "feat: add @supabase/ssr for server-side auth callback"
```

---

### Task 2: Refactor createProfileAndRoleData to accept a Supabase client parameter

The current function uses the module-level browser `supabase` client. The callback route needs to pass a server-side client instead.

**Files:**
- Modify: `app/src/lib/supabase.ts` (lines 38-91)
- Modify: `app/src/app/register/page.tsx` (line 139 — caller, but this will be removed in Task 4 anyway)

- [ ] **Step 1: Add a SupabaseClient type import**

At the top of `app/src/lib/supabase.ts`, add a type import:

```typescript
import { createClient, SupabaseClient } from '@supabase/supabase-js';
```

- [ ] **Step 2: Add client parameter to createProfileAndRoleData**

Change the function signature from:
```typescript
export async function createProfileAndRoleData(
  userId: string,
  opts: {
    role: string;
    fullName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    roleData: RoleData;
  }
)
```

To:
```typescript
export async function createProfileAndRoleData(
  client: SupabaseClient,
  userId: string,
  opts: {
    role: string;
    fullName: string;
    email: string;
    phone?: string;
    avatarUrl?: string;
    roleData: RoleData;
  }
)
```

- [ ] **Step 3: Replace all `supabase.from(...)` calls inside the function with `client.from(...)`**

There are 4 occurrences inside `createProfileAndRoleData`:
- Line 55: `await supabase.from('profiles').insert(...)` → `await client.from('profiles').insert(...)`
- Line 66: `await supabase.from('students').insert(...)` → `await client.from('students').insert(...)`
- Line 75: `await supabase.from('employers').insert(...)` → `await client.from('employers').insert(...)`
- Line 84: `await supabase.from('university_admins').insert(...)` → `await client.from('university_admins').insert(...)`

- [ ] **Step 4: Verify the build compiles**

Run: `cd app && npx tsc --noEmit`

Note: The register page caller at line 139 will show a type error because it still uses the old 2-arg signature. That's expected — it gets replaced in Task 4. If you need it to compile now, temporarily update the call to `createProfileAndRoleData(supabase, userId, {...})`.

- [ ] **Step 5: Commit**

```bash
git add app/src/lib/supabase.ts
git commit -m "refactor: createProfileAndRoleData accepts a Supabase client parameter"
```

---

### Task 3: Create the /verify-email page

Style it consistently with the existing forgot-password page (`app/src/app/forgot-password/page.tsx`).

**Files:**
- Create: `app/src/app/verify-email/page.tsx`

- [ ] **Step 1: Create the verify-email page**

Create `app/src/app/verify-email/page.tsx`:

```typescript
'use client';

import { Suspense, useState, useEffect } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [error, setError] = useState('');
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function handleResend() {
    if (cooldown > 0 || !email) return;
    setResending(true);
    setError('');
    setResent(false);

    const { error: resendError } = await supabase.auth.resend({
      type: 'signup',
      email,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (resendError) {
      setError(resendError.message);
    } else {
      setResent(true);
      setCooldown(60);
    }
    setResending(false);
  }

  return (
    <div className="auth-page">
      <div className="auth-container narrow">
        <div className="auth-logo">
          <Link href="/">
            <img
              src="https://internfirst-demo.com/wp-content/uploads/2026/02/Top-Rated-2.png"
              alt="InternFirst"
            />
          </Link>
        </div>

        <h1>Check your email</h1>
        <p className="auth-subtitle">
          We&apos;ve sent a verification link to{' '}
          {email ? <strong>{email}</strong> : 'your email address'}.
          Click the link in the email to activate your account.
        </p>
        <p className="auth-subtitle" style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
          Don&apos;t see it? Check your spam folder.
        </p>

        {error && (
          <div className="auth-error" style={{ display: 'block' }}>{error}</div>
        )}

        {resent && !error && (
          <div style={{
            background: 'var(--primary-light)',
            color: 'var(--primary)',
            padding: '12px 16px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '0.9rem',
            fontWeight: 500,
            marginBottom: '16px',
          }}>
            Verification email resent!
          </div>
        )}

        {email && (
          <button
            type="button"
            className="btn-auth"
            onClick={handleResend}
            disabled={resending || cooldown > 0}
            style={{ marginTop: '8px' }}
          >
            {resending
              ? 'Sending...'
              : cooldown > 0
                ? `Resend in ${cooldown}s`
                : 'Resend Verification Email'}
          </button>
        )}

        <p className="auth-footer">
          Already verified? <Link href="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense>
      <VerifyEmailContent />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the page renders**

Run: `cd app && npm run dev`
Navigate to `http://localhost:3000/verify-email?email=test@example.edu`
Expected: "Check your email" page with the email displayed and a resend button.

- [ ] **Step 3: Commit**

```bash
git add app/src/app/verify-email/page.tsx
git commit -m "feat: add verify-email page with resend button and cooldown"
```

---

### Task 4: Modify the register page

Remove auto-sign-in, image upload, and profile creation. Store form data in `user_metadata`. Redirect to `/verify-email`.

**Files:**
- Modify: `app/src/app/register/page.tsx` (lines 100-152 — the `handleSubmit` function)

- [ ] **Step 1: Replace the handleSubmit try block**

In `app/src/app/register/page.tsx`, replace the entire `try { ... } catch` block (lines 100-152) with:

```typescript
    try {
      // Build user_metadata with role-specific fields
      const metadata: Record<string, string> = { role, fullName, phone };

      if (role === 'student') {
        metadata.major = major;
        metadata.graduationYear = graduationYear;
      } else if (role === 'employer') {
        metadata.companyName = companyName;
        metadata.website = website;
        metadata.companyDescription = companyDescription;
      } else if (role === 'university_admin') {
        metadata.universityId = universityId;
        metadata.jobTitle = jobTitle;
      }

      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
          data: metadata,
        },
      });

      if (authError) throw authError;

      // Redirect to verify-email page
      router.push(`/verify-email?email=${encodeURIComponent(email)}`);
    } catch (err: any) {
      setError(err.message);
      setLoading(false);
    }
```

- [ ] **Step 2: Clean up unused imports and state**

Remove these from the imports and state declarations since image upload is deferred:
- Remove `uploadImage` from the import on line 7 (keep all other imports from `@/lib/supabase`)
- Remove `createProfileAndRoleData` from the import on line 7
- Remove `type RoleData` from the import on line 7
- Remove `DASHBOARD_ROUTES` from the import on line 7
- Remove `imageFile` / `setImageFile` state (line 27)
- Remove `imagePreview` / `setImagePreview` state (line 28)
- Remove `fileInputRef` (line 29)
- Remove `handleImageChange` function (lines 63-72)

The updated import line should be:
```typescript
import { supabase, isEduEmail, getAllUniversities } from '@/lib/supabase';
```

- [ ] **Step 3: Remove image upload UI sections**

Remove the image upload sections from the JSX for all three roles:
- **Student:** Remove the "Profile Picture (optional)" `form-group` div (lines 268-281)
- **Employer:** Remove the "Company Logo (optional)" `form-group` div (lines 300-313)
- **University Admin:** Remove the "University Logo (optional)" `form-group` div (lines 338-351)

- [ ] **Step 4: Verify the build compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 5: Manual test**

Run: `cd app && npm run dev`
1. Go to `/register`, fill out the form, submit
2. Should redirect to `/verify-email?email=...`
3. Should NOT auto-sign-in or create profile data

- [ ] **Step 6: Commit**

```bash
git add app/src/app/register/page.tsx
git commit -m "feat: register stores metadata and redirects to verify-email instead of auto-login"
```

---

### Task 5: Create the /auth/callback route handler

This is the server-side route that handles the email verification redirect from Supabase.

**Files:**
- Create: `app/src/app/auth/callback/route.ts`

- [ ] **Step 1: Create the callback route**

Create `app/src/app/auth/callback/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createProfileAndRoleData, DASHBOARD_ROUTES } from '@/lib/supabase';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  // Collect cookies with their full options so we can forward them to the redirect
  const cookiesToForward: { name: string; value: string; options?: any }[] = [];

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          cookiesToForward.push(cookie);
        }
      },
    },
  });

  // Exchange the code for a session
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);

  if (exchangeError) {
    return NextResponse.redirect(`${origin}/login?error=verification_failed`);
  }

  // Get the authenticated user and their metadata
  const { data: { user }, error: userError } = await supabase.auth.getUser();

  if (userError || !user) {
    return NextResponse.redirect(`${origin}/login?error=no_user`);
  }

  const metadata = user.user_metadata;
  const role = metadata?.role as string;

  if (!role) {
    // No metadata — might be a Google OAuth user or something unexpected
    return NextResponse.redirect(`${origin}/login`);
  }

  // Idempotency check: skip profile creation if it already exists
  const { data: existingProfile } = await supabase
    .from('profiles')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (!existingProfile) {
    // Build roleData from metadata
    const roleData: Record<string, string | undefined> = {};

    if (role === 'student') {
      roleData.major = metadata.major;
      roleData.graduationYear = metadata.graduationYear;
    } else if (role === 'employer') {
      roleData.companyName = metadata.companyName;
      roleData.website = metadata.website;
      roleData.companyDescription = metadata.companyDescription;
    } else if (role === 'university_admin') {
      roleData.universityId = metadata.universityId;
      roleData.jobTitle = metadata.jobTitle;
    }

    try {
      await createProfileAndRoleData(supabase, user.id, {
        role,
        fullName: metadata.fullName || '',
        email: user.email || '',
        phone: metadata.phone,
        roleData,
      });
    } catch (err) {
      console.error('Profile creation failed:', err);
      return NextResponse.redirect(`${origin}/login?error=profile_creation_failed`);
    }
  }

  // Redirect to the role-appropriate dashboard, forwarding session cookies with full options
  const dashboardPath = DASHBOARD_ROUTES[role] || '/dashboard/student';
  const redirectResponse = NextResponse.redirect(new URL(dashboardPath, origin));
  for (const { name, value, options } of cookiesToForward) {
    redirectResponse.cookies.set(name, value, options);
  }

  return redirectResponse;
}
```

- [ ] **Step 2: Verify the build compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add app/src/app/auth/callback/route.ts
git commit -m "feat: add auth callback route for email verification + profile creation"
```

---

### Task 6: Modify the login page to handle unverified users and error query params

**Files:**
- Modify: `app/src/app/login/page.tsx`

- [ ] **Step 1: Add error query parameter display**

The `/auth/callback` route redirects to `/login?error=...` on failure. Add error mapping at the top of the `LoginForm` component, after the existing state declarations (around line 22):

```typescript
  // Map callback error codes to user-friendly messages
  const ERROR_MESSAGES: Record<string, string> = {
    missing_code: 'Verification link was invalid. Please try again.',
    verification_failed: 'Email verification failed. Please try again or request a new link.',
    no_user: 'Something went wrong during verification. Please try again.',
    profile_creation_failed: 'Account verified but profile setup failed. Please try logging in — if the issue persists, contact support.',
  };

  const errorParam = searchParams.get('error');
  const callbackError = errorParam ? ERROR_MESSAGES[errorParam] || '' : '';
```

Then in the JSX, add a display for this error right after the `RoleSelector` and before the existing `{error && ...}` block:

```typescript
        {callbackError && <div className="auth-error" style={{ display: 'block' }}>{callbackError}</div>}
```

- [ ] **Step 2: Add unverified user detection**

In the `handleSubmit` function, replace the error handling block (lines 40-44):

```typescript
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
```

With:

```typescript
    if (authError) {
      // Supabase returns this message when email is not confirmed
      if (authError.message === 'Email not confirmed') {
        router.push(`/verify-email?email=${encodeURIComponent(email)}`);
        return;
      }
      setError(authError.message);
      setLoading(false);
      return;
    }
```

- [ ] **Step 3: Verify the build compiles**

Run: `cd app && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add app/src/app/login/page.tsx
git commit -m "feat: handle unverified users and callback error display on login page"
```

---

### Task 7: Enable email confirmation in Supabase Dashboard

This is a manual configuration step, not code.

- [ ] **Step 1: Enable email confirmations**

1. Go to the Supabase Dashboard → Authentication → Settings → Email Auth
2. Enable **"Confirm email"** toggle
3. Save

- [ ] **Step 2: Configure redirect URLs**

1. Go to Authentication → URL Configuration
2. Ensure **Site URL** is set to your app's base URL (e.g., `http://localhost:3000` for dev)
3. Add `http://localhost:3000/auth/callback` to **Redirect URLs** (and your production URL when you deploy)

- [ ] **Step 3: Test the full flow end-to-end**

1. Go to `/register`, fill out a student form with a valid `.edu` email
2. Submit — should redirect to `/verify-email?email=...`
3. Check email inbox — should receive a verification email from Supabase (via Resend SMTP)
4. Click the verification link — should land on `/auth/callback`, which creates the profile and redirects to `/dashboard/student`
5. Verify the dashboard loads correctly with user data
6. Test: log out and try logging in again — should work normally
7. Test: register a new account but DON'T verify, try logging in — should redirect to `/verify-email`

---

### Task 8: Update CLAUDE.md

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the auth flow description**

In `CLAUDE.md`, update the **Auth flow** line in the Architecture section from:

```
**Auth flow:** Supabase Auth (email/password + Google OAuth) → `profiles` table stores role → role-based redirect to dashboard.
```

To:

```
**Auth flow:** Supabase Auth (email/password + Google OAuth) → email verification required (Supabase built-in, skipped for OAuth) → `/auth/callback` server route creates profile + role data from `user_metadata` → role-based redirect to dashboard. Unverified users are redirected to `/verify-email`.
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "docs: update CLAUDE.md with email verification auth flow"
```
