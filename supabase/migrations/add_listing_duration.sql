-- Add duration column to internship_listings for the "Internship length" filter.
alter table internship_listings add column if not exists duration text;
