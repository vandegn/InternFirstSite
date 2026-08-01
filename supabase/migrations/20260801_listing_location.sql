-- ============================================
-- STRUCTURED LISTING LOCATION
-- ============================================
-- Employers now pick a location from a US city autocomplete (see
-- app/src/app/api/locations/route.ts) instead of free-typing it. The picked
-- city is stored in structured form here.
--
-- The existing `location` text column is KEPT and stays populated with the
-- canonical "Raleigh, NC" display string. Listing cards, the detail pages, and
-- the student location filter (an ilike over `location` in getActiveListings)
-- all read that column and are unchanged by this migration.
--
-- Rows created before the picker keep their free-text `location` with null
-- city/state — the edit form flags those and asks the employer to re-pick.
--
-- Run this in the Supabase SQL Editor.

alter table internship_listings
  add column if not exists city text,
  add column if not exists state text check (state is null or state ~ '^[A-Z]{2}$'),
  add column if not exists lat double precision,
  add column if not exists lng double precision;

-- Supports filtering/grouping by city or state.
create index if not exists idx_listings_city_state
  on internship_listings(state, city);

-- Supports the "internships near me" radius query this unlocks. A plain btree
-- on (lat, lng) is enough for a bounding-box prefilter; no PostGIS needed.
create index if not exists idx_listings_latlng
  on internship_listings(lat, lng)
  where lat is not null;
