-- ============================================
-- POLICY ACCEPTANCES
-- ============================================
-- Durable record of who accepted which version of the Terms & Conditions and
-- Privacy Policy (see app/src/lib/policies). The register page stamps the
-- on-screen versions into user_metadata when the user clicks I Agree; the
-- /auth/callback route writes this row (service role) after the profile is
-- created. accepted_at is the client's claim; recorded_at is server time.
-- When a document version bumps, users simply gain a second row on their next
-- acknowledgement — history is never overwritten.
--
-- Run this in the Supabase SQL Editor.

create table policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('student', 'employer')),
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null,
  recorded_at timestamptz default now() not null,
  unique (user_id, role, terms_version, privacy_version)
);

create index idx_policy_acceptances_user on policy_acceptances(user_id);

alter table policy_acceptances enable row level security;

-- Users can see their own acceptance history. No insert/update/delete
-- policies: only the service-role callback writes, and the record is
-- append-only by design.
create policy "Users read own policy acceptances"
  on policy_acceptances for select to authenticated
  using (user_id = auth.uid());
