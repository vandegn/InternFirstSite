-- Listing core sections become ordered, and postings gain explicit skills.
--
-- 1. section_order — the three core sections (Job Overview, Qualifications,
--    Key Responsibilities) were rendered in a fixed order with Job Overview
--    first. Employers wanted Qualifications first and the freedom to reorder,
--    so the order is now data. Storing keys rather than reshaping the columns
--    keeps every existing query working untouched.
--
-- 2. preferred_skills — matching previously inferred a listing's skills by
--    scanning its prose for names in the canonical SKILLS list, which missed
--    anything phrased differently and picked up incidental mentions. An
--    explicit list (max 10, same catalog students pick from) is authoritative
--    when present; see lib/matching.ts.

alter table internship_listings
  add column if not exists section_order text[] not null
  default array['requirements', 'description', 'key_responsibilities'];

alter table internship_listings
  add column if not exists preferred_skills text[] not null default '{}';

-- Existing listings were authored under the old fixed order, so preserve how
-- their authors saw them rather than silently reordering live postings.
update internship_listings
   set section_order = array['description', 'requirements', 'key_responsibilities'];

-- Guard against a malformed order leaving a section unrenderable. Cardinality
-- is checked rather than exact contents so the array is always the same three
-- keys in some order.
alter table internship_listings
  drop constraint if exists internship_listings_section_order_valid;

alter table internship_listings
  add constraint internship_listings_section_order_valid
  check (
    cardinality(section_order) = 3
    and section_order <@ array['description', 'requirements', 'key_responsibilities']
    and array['description', 'requirements', 'key_responsibilities'] <@ section_order
  );

alter table internship_listings
  drop constraint if exists internship_listings_preferred_skills_max;

alter table internship_listings
  add constraint internship_listings_preferred_skills_max
  check (cardinality(preferred_skills) <= 10);

comment on column internship_listings.section_order is
  'Render order of the three core sections. Keys map to the description, requirements, and key_responsibilities columns.';
comment on column internship_listings.preferred_skills is
  'Employer-selected skills (max 10) from the shared catalog. Authoritative for match scoring when non-empty.';
