# Email Verification in Registration Flow

**Date:** 2026-03-24
**Status:** Approved

## Overview

Add email verification to the InternFirst registration workflow using Supabase's built-in email confirmation feature. Users must verify their email before their profile and role-specific data are created. Registration form data is stored in Supabase Auth `user_metadata` during the interim.

## Current Flow

1. User fills registration form (role, fields, avatar/logo)
2. `supabase.auth.signUp()` creates auth user
3. Immediately auto-signs in with `supabase.auth.signInWithPassword()`
4. Uploads avatar/logo to Supabase Storage
5. `createProfileAndRoleData()` populates `profiles` + role-specific table
6. Redirects to role-specific dashboard

## New Flow

### Registration (Modified)

1. User fills registration form (same UI as today)
2. All role-specific text fields are packed into `user_metadata` using camelCase keys to match the existing `createProfileAndRoleData()` parameter names
3. Avatar/logo upload is **deferred** — not included in registration. Users upload from their dashboard/profile settings after verification.
4. `signUp()` must include `options.emailRedirectTo` set to `${window.location.origin}/auth/callback` so the confirmation email links to the callback route
5. `signUp()` triggers Supabase to send a confirmation email automatically (requires "Confirm email" enabled in Supabase Auth settings)
6. Auto-sign-in (`signInWithPassword`), profile creation, and dashboard redirect are **removed**
7. User is redirected to `/verify-email` page

Example `signUp()` call:
```typescript
supabase.auth.signUp({
  email,
  password,
  options: {
    emailRedirectTo: `${window.location.origin}/auth/callback`,
    data: { role, fullName, phone, major, graduationYear, ... }
  }
})
```

### Verify Email Page (New)

- Route: `/verify-email`
- Shows: "Check your inbox" message with the user's email address displayed
- Includes: "Resend verification email" button using `supabase.auth.resend({ type: 'signup', email })`
- Email is passed via URL query parameter (e.g., `/verify-email?email=user@example.com`)
- Add a cooldown timer (60s) on the resend button to match Supabase's rate limit
- Styled consistently with existing auth pages (login, register, forgot-password)

### Auth Callback (New)

- Route: `/auth/callback` (Next.js Route Handler — server-side)
- Supabase email confirmation link redirects here with an authorization code
- Flow:
  1. Extract auth `code` from URL search parameters
  2. Create a server-side Supabase client using `createServerClient` from `@supabase/ssr`
  3. Exchange code for session via `supabase.auth.exchangeCodeForSession(code)`
  4. Read `user_metadata` from the authenticated user
  5. **Check if profile already exists** (idempotency — handles double-click / link replay)
  6. If no profile exists, call `createProfileAndRoleData()` with the server client and metadata
  7. Redirect to the role-appropriate dashboard based on the role in metadata

### Login Page (Minor Modification)

- When an unverified user attempts to log in, Supabase returns the error message `"Email not confirmed"`
- Detect this specific error string and show: "Please verify your email first" with a link to `/verify-email?email=<their-email>`
- Note: This is a string comparison that could change with Supabase version updates

### Google OAuth (Out of Scope)

- Google OAuth users skip email verification entirely — Google has already verified the email
- Note: Google OAuth currently has no profile creation step (pre-existing issue). Fixing this is a separate task.

## Files to Create/Modify

| File | Action | Description |
|------|--------|-------------|
| `src/app/register/page.tsx` | Modify | Remove auto-sign-in + profile creation. Store form data in `user_metadata` with `emailRedirectTo`. Redirect to `/verify-email`. |
| `src/app/verify-email/page.tsx` | Create | "Check your email" page with resend button and cooldown timer |
| `src/app/auth/callback/route.ts` | Create | Server-side route handler for email confirmation redirect. Exchanges token, checks for existing profile, creates profile/role data, redirects to dashboard. |
| `src/lib/supabase.ts` | Modify | Refactor `createProfileAndRoleData()` to accept a Supabase client instance as a parameter (instead of using the module-level browser client). Add server-side client creation helper. |
| `src/app/login/page.tsx` | Modify | Detect `"Email not confirmed"` error and show verification prompt |
| `CLAUDE.md` | Modify | Update auth flow description to reflect email verification step |

## Supabase Dashboard Configuration

1. **Enable "Confirm email"** in Auth > Settings > Email Auth
2. **Set Site URL** to the app's base URL
3. **Add redirect URL** for `/auth/callback` to the allowed redirect URLs list
4. The confirmation email will be sent via the already-configured Resend SMTP provider

## user_metadata Schema

Uses camelCase to match existing `createProfileAndRoleData()` parameter names:

```json
{
  "role": "student | employer | university_admin",
  "fullName": "string",
  "phone": "string (optional)",
  "major": "string (student only)",
  "graduationYear": "string (student only)",
  "companyName": "string (employer only)",
  "website": "string (employer only)",
  "description": "string (employer only)",
  "jobTitle": "string (university_admin only)",
  "universityId": "string (university_admin only)"
}
```

## Avatar/Logo Handling

Avatar and logo uploads are deferred to post-verification. Rationale:
- `user_metadata` has size limits that make base64 image storage impractical
- Keeps the verification flow simple and fast
- Users can upload from their dashboard profile settings after first login

## Server-Side Client Architecture

The current `createProfileAndRoleData()` uses the module-level browser Supabase client. The callback route needs a server-side client (from `@supabase/ssr`) that has access to cookies for session management. To handle this:

- **Refactor `createProfileAndRoleData()`** to accept a Supabase client instance as its first parameter
- The callback route passes the server-side client
- Any existing client-side callers (if re-introduced later) pass the browser client
- The server-side client after `exchangeCodeForSession()` will have the user's session, so RLS INSERT policies for the authenticated user will apply. The existing RLS policies allow users to insert their own profile and role-specific records.

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Verifies on different device/browser | Works — metadata is on the Supabase user object |
| Tries to log in before verifying | Detect `"Email not confirmed"` error, show "Please verify your email first" + resend link |
| Verification link expires | Resend button on `/verify-email` page |
| Google OAuth user | Skips verification entirely (profile creation is a separate pre-existing issue) |
| User signs up but never verifies | Unverified auth user exists in Supabase but no profile/role data is created. No impact on the application. |
| Callback route called without valid code | Redirect to `/login` with error message |
| User clicks verification link twice | Check if profile already exists before creating. If it does, skip creation and redirect to dashboard. |
| Verified but profile creation fails | User has session but no profile. Dashboard layout redirects to `/register`. Recovery: the callback route should handle errors gracefully and show a "something went wrong, please try again" page or retry. |
| Resend button spam | 60-second cooldown timer on the button. Catch Supabase rate-limit errors and show user-friendly message. |

## Dependencies

- `@supabase/ssr` — **must be installed** (new dependency for server-side Supabase client in the callback route handler)
