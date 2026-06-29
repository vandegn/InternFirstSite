-- ============================================
-- Employer Payment Plans — CPA revision (incremental)
-- ============================================
-- Apply this if you already ran the original 20260620_employer_payments.sql
-- (which created employer_billing / listing_payments / applicant_charges and the
-- pricing_model / payment_status columns) BEFORE the CPA model was finalized.
-- Adds the cpa_cents snapshot + match_score, and replaces the trigger with the
-- final no-cap, match-gated version. Safe to run more than once.

-- group CPA snapshot taken at posting time (drives PPA per-application billing)
alter table internship_listings
  add column if not exists cpa_cents int;

-- stub match score (0–100); PPA only bills completed applications scoring >= 70
alter table applications
  add column if not exists match_score int check (match_score between 0 and 100);

-- Count applicants and meter qualifying PPA applications. No cap → no auto-close.
-- NOTE: the match threshold (70) must stay in sync with PPA_MATCH_THRESHOLD in
--       app/src/lib/constants.ts.
create or replace function handle_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model       text;
  v_cpa         int;
  v_employer_id uuid;
begin
  select pricing_model, cpa_cents, employer_id
    into v_model, v_cpa, v_employer_id
  from internship_listings
  where id = new.listing_id;

  update internship_listings
    set applicant_count = applicant_count + 1
  where id = new.listing_id;

  if v_model = 'ppa' and coalesce(new.match_score, 0) >= 70 then
    insert into applicant_charges (listing_id, employer_id, application_id, billing_period, amount_cents)
    values (new.listing_id, v_employer_id, new.id, date_trunc('month', now())::date, coalesce(v_cpa, 1609))
    on conflict (application_id) do nothing;
  end if;

  return new;
end;
$$;

drop trigger if exists on_application_created on applications;
create trigger on_application_created
  after insert on applications
  for each row execute function handle_new_application();

-- Refresh PostgREST's schema cache so the new columns are visible immediately.
notify pgrst, 'reload schema';
