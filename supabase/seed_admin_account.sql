-- =============================================================
-- InternFirst — Admin (CEO) Account
-- Run this ONCE in Supabase SQL Editor (Dashboard > SQL Editor).
--
-- Creates a single account with the 'intern_first_admin' role. When this
-- account logs in it lands on /dashboard/admin and sees the "View Waitlist"
-- tab in the sidebar. No other role can see that tab, and RLS only lets this
-- role read the waitlist table.
--
--  >>> BEFORE RUNNING: change the email and password below. <<<
-- =============================================================

-- ---- EDIT THESE TWO VALUES ----
--   email:    ceo@intern-first.com
--   password: ChangeMe!2026
-- (To change the password later, just re-run the auth.users UPDATE at the
--  bottom of this file with a new crypt('newpassword', gen_salt('bf')).)

-- NOTE: every token/change column below MUST be '' (empty string), NOT NULL.
-- GoTrue (Supabase Auth) scans these into Go string fields; a NULL makes login
-- fail with "Database error querying schema". A user created via the Supabase
-- Dashboard (Authentication > Add user) sets these automatically — this raw
-- insert has to do it by hand.
INSERT INTO auth.users (
  id, instance_id, email, encrypted_password, email_confirmed_at,
  raw_user_meta_data, role, aud, created_at, updated_at,
  confirmation_token, recovery_token,
  email_change, email_change_token_new, email_change_token_current,
  phone_change, phone_change_token, reauthentication_token
)
VALUES (
  'dddddddd-0000-4000-d000-000000000001',
  '00000000-0000-0000-0000-000000000000',
  'ceo@intern-first.com',
  crypt('ChangeMe!2026', gen_salt('bf')),
  now(),
  '{"full_name": "InternFirst Admin", "role": "intern_first_admin"}'::jsonb,
  'authenticated',
  'authenticated',
  now(),
  now(),
  '', '',
  '', '', '',
  '', '', ''
);

-- Identity record so email/password sign-in works.
INSERT INTO auth.identities (
  id, user_id, identity_data, provider, provider_id,
  last_sign_in_at, created_at, updated_at
)
VALUES (
  'dddddddd-0000-4000-d000-000000000001',
  'dddddddd-0000-4000-d000-000000000001',
  '{"sub": "dddddddd-0000-4000-d000-000000000001", "email": "ceo@intern-first.com"}'::jsonb,
  'email',
  'dddddddd-0000-4000-d000-000000000001',
  now(), now(), now()
);

-- Profile row carrying the elevated role. This is what the RLS policy and the
-- dashboard route guard check.
INSERT INTO profiles (user_id, role, full_name, email)
VALUES (
  'dddddddd-0000-4000-d000-000000000001',
  'intern_first_admin',
  'InternFirst Admin',
  'ceo@intern-first.com'
);

-- ---- To reset the password later, run just this: ----
-- UPDATE auth.users
-- SET encrypted_password = crypt('YourNewPassword', gen_salt('bf'))
-- WHERE email = 'ceo@intern-first.com';
