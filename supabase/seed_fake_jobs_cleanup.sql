-- Removes all fake-jobs seed data. Run in Supabase SQL Editor.
-- Deleting the auth.users rows cascades to profiles, employers, and listings.
delete from auth.users where id::text like 'fa000000-%';
