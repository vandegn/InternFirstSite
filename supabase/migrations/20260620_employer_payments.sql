-- ============================================
-- Employer Payment Plans (PPJ / PPA)
-- ============================================
-- Run this in the Supabase SQL Editor against an existing database.
-- The canonical definitions also live in supabase/schema.sql.
--
-- CPA (Cost-Per-Application) is the per–occupation-group benchmark (anchored to
-- a listing's industry) that drives both paid tiers. It is snapshotted onto the
-- listing as cpa_cents at posting time so billing is immune to later changes.
-- PPJ (Pay Per Job): fixed upfront fee = median(estimated range) × CPA. No cap.
-- PPA (Pay Per Application): billed cpa_cents per completed application whose
--   match_score >= 70, tallied and invoiced monthly. No cap.
--
-- NOTE: the match threshold (70) below MUST stay in sync with
--       PPA_MATCH_THRESHOLD in app/src/lib/constants.ts.

-- ── 1. internship_listings: pricing columns ──
alter table internship_listings
  add column if not exists pricing_model   text check (pricing_model in ('ppj', 'ppa')),
  add column if not exists applicant_quota  int,   -- PPJ estimate upper bound (informational, not enforced)
  add column if not exists applicant_count  int not null default 0,
  add column if not exists cpa_cents        int,   -- group CPA snapshot at posting time
  add column if not exists expires_at       timestamptz,
  add column if not exists payment_status   text not null default 'active'
                                            check (payment_status in ('pending', 'paid', 'active'));

-- applications: stub match score (0–100); PPA only bills applications >= 70.
alter table applications
  add column if not exists match_score int check (match_score between 0 and 100);

-- ── 2. employer_billing: Stripe customer per employer ──
create table if not exists employer_billing (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null unique,
  stripe_customer_id text,
  default_payment_method text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_employer_billing_employer on employer_billing(employer_id);

alter table employer_billing enable row level security;

drop policy if exists "Employers read own billing" on employer_billing;
create policy "Employers read own billing"
  on employer_billing for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

drop trigger if exists set_employer_billing_updated_at on employer_billing;
create trigger set_employer_billing_updated_at
  before update on employer_billing
  for each row execute function update_updated_at();

-- ── 3. listing_payments: record of every Stripe charge ──
create table if not exists listing_payments (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete set null,
  type text not null check (type in ('ppj_upfront', 'ppa_monthly')),
  stripe_ref text,                                  -- checkout session / invoice id
  amount_cents int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  applicant_quota int,
  duration_days int,
  billing_period date,
  created_at timestamptz default now() not null
);

create index if not exists idx_listing_payments_employer on listing_payments(employer_id, created_at desc);
create index if not exists idx_listing_payments_listing on listing_payments(listing_id);

alter table listing_payments enable row level security;

drop policy if exists "Employers read own payments" on listing_payments;
create policy "Employers read own payments"
  on listing_payments for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

-- ── 4. applicant_charges: PPA metering ledger (one row per chargeable applicant) ──
create table if not exists applicant_charges (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  application_id uuid references applications(id) on delete cascade not null unique,
  billing_period date not null,                     -- month bucket (first of month)
  amount_cents int not null,
  invoiced boolean not null default false,
  listing_payment_id uuid references listing_payments(id) on delete set null,
  created_at timestamptz default now() not null
);

create index if not exists idx_applicant_charges_employer on applicant_charges(employer_id, billing_period);
create index if not exists idx_applicant_charges_uninvoiced on applicant_charges(employer_id) where invoiced = false;

alter table applicant_charges enable row level security;

-- Employers can read their own charges; inserts come from the security-definer
-- trigger below (and the service role for invoicing), never directly from clients.
drop policy if exists "Employers read own charges" on applicant_charges;
create policy "Employers read own charges"
  on applicant_charges for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

-- ── 5. Trigger: count applicants and meter qualifying PPA applications ──
-- Students insert into `applications` directly via RLS, so metering must live
-- in a security-definer trigger that clients cannot bypass. Neither tier has an
-- applicant cap, so there is no auto-close here.
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

  -- PPA: bill the snapshotted group CPA per completed, qualifying application
  -- (match_score >= 70). Idempotent per application.
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
