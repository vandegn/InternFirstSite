-- Company icon: a small square mark shown beside the company name on job
-- posting cards. Separate from logo_url (the full-size logo) and from listing
-- banners. Employers upload it from /dashboard/employer/account; it lives in
-- the public `images` bucket under icons/<employerId>.<ext>.
--
-- Cards read icon_url through the same embedded `employers(...)` select as
-- company_name / logo_url, so changing or clearing it updates every posting
-- at once — there is nothing copied onto listings.
alter table employers
  add column if not exists icon_url text;

comment on column employers.icon_url is
  'Square company mark shown beside the company name on job cards. Full logo is logo_url.';
