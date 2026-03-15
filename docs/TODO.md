# Future Work / TODO

Items discussed but deferred for later implementation.

## Auth & Registration
- [ ] Validate university admin email domain matches the selected university's `domain` field in the database
- [ ] Supabase Storage bucket setup for profile picture / logo uploads (currently broken — `images` bucket not found)

## Companies & Employers
- [ ] Create a separate `companies` table so multiple employer accounts can belong to the same company with shared branding/info (currently one employer = one company)
- [ ] Employer settings page for editing company info (partially built at `/dashboard/employer/settings`)

## University Dashboard
- [ ] Pull real data into university dashboard (currently all placeholder/hardcoded stats, charts, events)
- [ ] Scope university dashboard data by `university_id` so all admins for the same university see the same data

## General
- [ ] Email confirmation flow (currently disabled to allow auto-login after registration)
