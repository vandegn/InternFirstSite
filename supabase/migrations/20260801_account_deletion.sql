-- ============================================
-- Account deletion with a 6-month retention window
-- ============================================
-- "Delete account" is a soft delete. The user is locked out immediately and
-- disappears from the product, but their rows stay for six months (dispute
-- resolution, PPA billing reconciliation, and re-activation if they ask). A
-- daily pg_cron job does the irreversible purge once the window closes.
--
-- Immediate, at request time (see app/api/account/delete):
--   - profiles.deleted_at is stamped
--   - the auth user is banned, so login and refresh both fail
--   - employer listings are closed; the account stops accruing applicants
--
-- After 6 months: purge_expired_account_deletions() deletes the auth.users
-- row, and every app table cascades from there via profiles.user_id.

-- user_id is nullable with ON DELETE SET NULL, not a cascade: the purge deletes
-- the auth.users row, and this record has to outlive it as the audit trail
-- proving the deletion was requested and honoured.
create table if not exists account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete set null unique,
  role text not null,
  email text not null,
  reason text,
  requested_at timestamptz not null default now(),
  -- The retention window. Nothing is destroyed before this.
  purge_after timestamptz not null default now() + interval '6 months',
  status text not null default 'pending_purge'
    check (status in ('pending_purge', 'purged', 'cancelled')),
  purged_at timestamptz
);

create index if not exists idx_account_deletion_purge
  on account_deletion_requests(status, purge_after);

alter table account_deletion_requests enable row level security;

-- Users may read their own request (so the UI can show "scheduled for
-- permanent deletion on ..."). All writes go through the service-role API
-- route — no client-side insert/update/delete policy on purpose.
drop policy if exists "Users read own deletion request" on account_deletion_requests;
create policy "Users read own deletion request"
  on account_deletion_requests for select to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Admins read deletion requests" on account_deletion_requests;
create policy "Admins read deletion requests"
  on account_deletion_requests for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'intern_first_admin'
    )
  );

-- ----- Soft-delete marker on the profile -----
alter table profiles
  add column if not exists deleted_at timestamptz;

create index if not exists idx_profiles_deleted_at on profiles(deleted_at);

-- ----- Hide deleted accounts from the product -----
-- Deleted employers' listings must stop appearing in browse even before the
-- purge. Students' applications stay intact (that's the retention point), but
-- the account itself can no longer log in, so nothing is actionable.
create or replace function close_listings_on_account_deletion()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.deleted_at is not null and old.deleted_at is null then
    update internship_listings
       set status = 'closed', updated_at = now()
     where employer_id in (select id from employers where user_id = new.user_id)
       and status <> 'closed';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_close_listings_on_deletion on profiles;
create trigger trg_close_listings_on_deletion
  after update of deleted_at on profiles
  for each row execute function close_listings_on_account_deletion();

-- ----- The purge, once the 6 months are up -----
-- Deleting auth.users cascades to profiles, and profiles cascades to students /
-- employers / applications / messages / everything keyed on user_id.
create or replace function purge_expired_account_deletions()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r record;
begin
  for r in
    select id, user_id from account_deletion_requests
    where status = 'pending_purge'
      and purge_after <= now()
      and user_id is not null
  loop
    -- Cascades through profiles to students / employers / applications /
    -- messages / everything keyed on user_id. This row's own FK is SET NULL,
    -- so the audit record survives with status = 'purged'.
    delete from auth.users where id = r.user_id;
    update account_deletion_requests
       set status = 'purged', purged_at = now()
     where id = r.id;
  end loop;
end;
$$;

create extension if not exists pg_cron;

-- 03:00 UTC daily. cron.schedule upserts by name, so re-running is safe.
select cron.schedule(
  'purge-expired-account-deletions',
  '0 3 * * *',
  $cron$ select purge_expired_account_deletions() $cron$
);
