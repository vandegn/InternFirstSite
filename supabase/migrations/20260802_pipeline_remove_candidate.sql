-- ============================================
-- Pipeline: remove a candidate from the board
-- ============================================
-- The employer pipeline gains a trash drop-zone: drag a card onto it and the
-- application is deleted outright. Three things have to be true first.
--
-- 1. BILLING MUST SURVIVE THE DELETE. applicant_charges.application_id was
--    `not null` with `on delete cascade`, so deleting an application also
--    erased its PPA charge — including uninvoiced ones. That turns the trash
--    can into a "clear my bill" button. Make the column nullable and switch
--    the FK to `on delete set null` so the ledger row outlives the applicant
--    it was metered from. The unique constraint still holds: Postgres allows
--    many NULLs in a unique index, and handle_new_application's
--    `on conflict (application_id)` only ever sees non-null values.
--
-- 2. EMPLOYERS NEED A DELETE POLICY. applications had select/insert/update
--    policies but no delete policy at all, so every client-side delete was a
--    silent zero-row no-op under RLS. That also means the existing
--    "Delete candidates too" path in deleteStage() (src/lib/supabase.ts) has
--    never actually deleted anything — this fixes that too.
--
-- 3. THE APPLICANT COUNTER MUST COME BACK DOWN. handle_new_application()
--    increments internship_listings.applicant_count on insert and nothing
--    ever decremented it, so a deleted candidate would leave the listing
--    permanently overcounted.
--
-- Run this in the Supabase SQL Editor.

-- ----- 1. PPA charges outlive their application -----
alter table applicant_charges
  alter column application_id drop not null;

alter table applicant_charges
  drop constraint applicant_charges_application_id_fkey;

alter table applicant_charges
  add constraint applicant_charges_application_id_fkey
  foreign key (application_id) references applications(id) on delete set null;

-- ----- 2. Employers can delete applications to their own listings -----
-- Same shape as the existing update policy: gated on approval, scoped to
-- listings the caller owns. Students deliberately get no delete policy —
-- withdrawing an application is a separate product decision.
drop policy if exists "Employers can delete applications to their listings" on applications;
create policy "Employers can delete applications to their listings"
  on applications for delete to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ----- 3. Decrement applicant_count on delete -----
-- greatest(...,0) so a counter that has drifted below zero (or a listing that
-- was seeded with applications) can never go negative.
create or replace function handle_deleted_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update internship_listings
     set applicant_count = greatest(coalesce(applicant_count, 0) - 1, 0)
   where id = old.listing_id;
  return old;
end;
$$;

drop trigger if exists on_application_deleted on applications;
create trigger on_application_deleted
  after delete on applications
  for each row execute function handle_deleted_application();
