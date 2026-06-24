-- =============================================================
-- Seed: 100 fake applicants for the Solstice "Communications Intern"
-- listing (fc000000-0000-4000-c000-000000000163).
--
-- All fake students use IDs prefixed fd... so they can be cleaned up
-- with one DELETE later. They land in the Applied stage with staggered
-- applied_at timestamps (most recent first = applicant #100; oldest
-- first = applicant #1, so the kanban's FCFS sort shows #1 at top).
--
-- Prereqs:
--  1. seed_fake_jobs.sql has been run (creates Solstice + the listing)
--  2. 2026-06-24-pipeline-stages.sql has been run (creates the Applied
--     anchor stage on every listing)
--
-- Run in Supabase SQL Editor.
-- All fake student auth users use password: testpass1
-- =============================================================
create extension if not exists pgcrypto;

do $$
declare
  target_listing constant uuid := 'fc000000-0000-4000-c000-000000000163';
  applied_stage_id uuid;
  i int;
  uid uuid;
  first_name text;
  last_name text;
  full_name text;
  email text;
  major text;
  first_names text[] := ARRAY[
    'Alex','Jordan','Sam','Casey','Riley','Morgan','Avery','Quinn','Drew','Skylar',
    'Reese','Rowan','Hayden','Emerson','Finley','Cameron','Bailey','Harper','Sage','Parker',
    'Phoenix','Charlie','Logan','Dakota','Ellis','Hollis','Marlowe','Kendall','Blake','Tatum'
  ];
  last_names text[] := ARRAY[
    'Smith','Johnson','Brown','Garcia','Martinez','Lee','Patel','Kim','Nguyen','Anderson',
    'Walker','Hall','Allen','Young','King','Wright','Lopez','Hill','Scott','Green',
    'Adams','Baker','Gonzalez','Nelson','Carter','Mitchell','Perez','Roberts','Turner','Phillips'
  ];
  majors text[] := ARRAY[
    'Communications','Marketing','English','Journalism','Public Relations',
    'Media Studies','Business','Sociology','Political Science','Advertising'
  ];
begin
  -- Find the Applied anchor stage for this listing.
  select id into applied_stage_id
    from pipeline_stages
    where listing_id = target_listing and stage_type = 'applied'
    limit 1;

  if applied_stage_id is null then
    raise exception 'Applied stage not found for listing % — run the pipeline-stages migration first', target_listing;
  end if;

  for i in 1..100 loop
    uid := ('fd000000-0000-4000-d000-' || lpad(i::text, 12, '0'))::uuid;
    first_name := first_names[((i - 1) % array_length(first_names, 1)) + 1];
    last_name  := last_names[((i - 1) % array_length(last_names, 1)) + 1];
    full_name  := first_name || ' ' || last_name;
    email      := lower(first_name) || '.' || lower(last_name) || i::text || '@test.edu';
    major      := majors[((i - 1) % array_length(majors, 1)) + 1];

    -- auth.users (skip if already inserted on a re-run)
    insert into auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at,
      raw_user_meta_data, role, aud, created_at, updated_at,
      confirmation_token, recovery_token, email_change, email_change_token_new,
      email_change_token_current, phone_change, phone_change_token, reauthentication_token
    )
    values (
      uid, '00000000-0000-0000-0000-000000000000', email,
      crypt('testpass1', gen_salt('bf')), now(),
      jsonb_build_object('full_name', full_name, 'role', 'student'),
      'authenticated', 'authenticated', now(), now(),
      '', '', '', '', '', '', '', ''
    )
    on conflict (id) do nothing;

    -- auth.identities
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id,
      last_sign_in_at, created_at, updated_at
    )
    values (
      uid, uid,
      jsonb_build_object('sub', uid::text, 'email', email),
      'email', uid::text, now(), now(), now()
    )
    on conflict (id) do nothing;

    -- profiles
    insert into profiles (user_id, email, full_name, role, avatar_url, created_at, updated_at)
    values (uid, email, full_name, 'student', null, now(), now())
    on conflict (user_id) do nothing;

    -- students  (uses uid as both id and user_id for easy cleanup)
    insert into students (id, user_id, major, graduation_year, bio, created_at, updated_at)
    values (
      uid, uid, major, 2026 + (i % 3),
      'Test applicant ' || i || '. Excited about communications and storytelling.',
      now(), now()
    )
    on conflict (id) do nothing;

    -- application — staggered timestamps so applicant #1 is the oldest.
    -- 1 minute spacing × 100 keeps everything inside the last ~2 hours
    -- without polluting "Just now".
    insert into applications (student_id, listing_id, stage_id, applied_at, updated_at)
    values (
      uid, target_listing, applied_stage_id,
      now() - ((100 - i) || ' minutes')::interval, now()
    )
    on conflict (student_id, listing_id) do nothing;
  end loop;
end $$;

-- =============================================================
-- CLEANUP (run this to remove the 100 fake applicants)
-- =============================================================
-- delete from auth.users where id::text like 'fd000000-0000-4000-d000-%';
-- (applications/students/profiles cascade via the ON DELETE CASCADE on user_id)
