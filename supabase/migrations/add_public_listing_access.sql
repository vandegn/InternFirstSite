-- Allow anonymous (logged-out) visitors to browse active internship listings.
-- Required for the public /internships and /internships/[id] pages.
--
-- Active listings + the employer's public-facing fields (company_name, logo_url,
-- website) are intentionally readable without authentication. Login is only
-- required when a student wants to apply.

-- Active listings: readable by anonymous users
create policy "Active listings are publicly viewable"
  on internship_listings
  for select
  to anon
  using (status = 'active');

-- Employers: readable by anonymous users (so listing cards can show company name + logo)
create policy "Employers are publicly viewable"
  on employers
  for select
  to anon
  using (true);
