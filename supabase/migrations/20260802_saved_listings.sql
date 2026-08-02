-- Saved (bookmarked) listings.
--
-- Applying was previously the only way to mark interest in a posting, which
-- pushed students into applying just to keep track of a role. Saving is
-- private: employers never see it, and it does not create an application or
-- count toward a listing's applicant quota.

create table if not exists saved_listings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  saved_at timestamptz not null default now(),
  unique (student_id, listing_id)
);

create index if not exists idx_saved_listings_student on saved_listings(student_id);
create index if not exists idx_saved_listings_listing on saved_listings(listing_id);

alter table saved_listings enable row level security;

-- Deliberately no employer policy. A saved listing is a private bookmark, and
-- exposing it would leak intent before a student chooses to apply.
create policy "Students can view own saved listings"
  on saved_listings for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can save listings"
  on saved_listings for insert to authenticated
  with check (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can unsave listings"
  on saved_listings for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));
