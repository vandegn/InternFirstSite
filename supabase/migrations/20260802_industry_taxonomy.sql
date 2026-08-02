-- ============================================
-- Migrate listings to the 25-industry taxonomy
-- ============================================
--
-- The employer-facing industry list moves from 12 ad-hoc labels to the 25
-- classifications in context/industry-list.pdf (NAICS 2022 / ISIC Rev. 5
-- backbone with front-end splits). Existing rows would otherwise keep values
-- that no longer appear in any dropdown -- invisible to the industry filter and
-- unselectable if the employer ever reopened the edit form.
--
-- internship_listings.industry carries a CHECK constraint listing the old 12
-- values verbatim, so the order here matters: drop the constraint, rewrite the
-- rows, then re-add it over the new vocabulary. Rewriting first would fail the
-- old check on the very first row.
--
-- This mapping mirrors LEGACY_INDUSTRY_MAP in app/src/lib/constants.ts. Keep
-- the two in step if either changes.
--
-- Two mappings are judgement calls rather than renames:
--   'Engineering' -- engineering is a job *category* in the new taxonomy, not
--                    an industry, so there is no direct successor.
--   'Other'       -- always a catch-all.
-- Both land in Consulting, Professional & Business Services, which is where
-- standalone engineering firms and multi-industry employers sit. The query at
-- the bottom lists the affected listings so they can be reviewed.

alter table internship_listings
  drop constraint if exists internship_listings_industry_check;

update internship_listings
set industry = case industry
  when 'Technology' then 'Technology, Software & IT Services'
  when 'Finance'    then 'Financial Services & Insurance'
  when 'Healthcare' then 'Healthcare'
  when 'Marketing'  then 'Advertising, Marketing & Public Relations'
  when 'Legal'      then 'Legal'
  when 'Engineering' then 'Consulting, Professional & Business Services'
  when 'Education'  then 'Education & Training'
  when 'Media'      then 'Media, Publishing & Entertainment'
  when 'Nonprofit'  then 'Social Services & Nonprofit'
  when 'Government' then 'Government & Public Administration'
  when 'Retail'     then 'Retail & E-commerce'
  when 'Other'      then 'Consulting, Professional & Business Services'
  else industry
end
where industry in (
  'Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering',
  'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'
);

-- Re-add the constraint over the new vocabulary, so a typo or a stale client
-- can't quietly write an industry that no filter will ever match.
alter table internship_listings
  add constraint internship_listings_industry_check
  check (industry = any (array[
    'Agriculture, Forestry, Fishing & Aquaculture',
    'Energy, Mining & Utilities',
    'Environmental Services & Sustainability',
    'Construction & Building Services',
    'Manufacturing & Industrial Production',
    'Transportation, Logistics & Warehousing',
    'Automotive & Mobility',
    'Wholesale & Distribution',
    'Retail & E-commerce',
    'Healthcare',
    'Social Services & Nonprofit',
    'Pharmaceuticals, Biotechnology & Life Sciences',
    'Education & Training',
    'Government & Public Administration',
    'Aerospace, Defense & Public Safety',
    'Financial Services & Insurance',
    'Real Estate, Property & Facilities',
    'Legal',
    'Consulting, Professional & Business Services',
    'Technology, Software & IT Services',
    'Telecommunications & Network Infrastructure',
    'Media, Publishing & Entertainment',
    'Advertising, Marketing & Public Relations',
    'Hospitality, Travel & Tourism',
    'Consumer Services & Personal Services'
  ]));

-- Employers also carry an industry on their own record where the column
-- exists; keep it aligned with the same vocabulary. No check constraint exists
-- there, so this is a plain rewrite.
do $$
begin
  if exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'employers' and column_name = 'industry'
  ) then
    update employers
    set industry = case industry
      when 'Technology' then 'Technology, Software & IT Services'
      when 'Finance'    then 'Financial Services & Insurance'
      when 'Healthcare' then 'Healthcare'
      when 'Marketing'  then 'Advertising, Marketing & Public Relations'
      when 'Legal'      then 'Legal'
      when 'Engineering' then 'Consulting, Professional & Business Services'
      when 'Education'  then 'Education & Training'
      when 'Media'      then 'Media, Publishing & Entertainment'
      when 'Nonprofit'  then 'Social Services & Nonprofit'
      when 'Government' then 'Government & Public Administration'
      when 'Retail'     then 'Retail & E-commerce'
      when 'Other'      then 'Consulting, Professional & Business Services'
      else industry
    end
    where industry in (
      'Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering',
      'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other'
    );
  end if;
end $$;

-- Anything left outside the new vocabulary is worth a look -- it means a row
-- carried a value neither list knows about.
--   select id, title, industry from internship_listings
--   where industry is not null and industry not in (
--     'Agriculture, Forestry, Fishing & Aquaculture', 'Energy, Mining & Utilities',
--     'Environmental Services & Sustainability', 'Construction & Building Services',
--     'Manufacturing & Industrial Production', 'Transportation, Logistics & Warehousing',
--     'Automotive & Mobility', 'Wholesale & Distribution', 'Retail & E-commerce',
--     'Healthcare', 'Social Services & Nonprofit',
--     'Pharmaceuticals, Biotechnology & Life Sciences', 'Education & Training',
--     'Government & Public Administration', 'Aerospace, Defense & Public Safety',
--     'Financial Services & Insurance', 'Real Estate, Property & Facilities', 'Legal',
--     'Consulting, Professional & Business Services', 'Technology, Software & IT Services',
--     'Telecommunications & Network Infrastructure', 'Media, Publishing & Entertainment',
--     'Advertising, Marketing & Public Relations', 'Hospitality, Travel & Tourism',
--     'Consumer Services & Personal Services'
--   );
