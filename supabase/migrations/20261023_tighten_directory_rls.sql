-- Who may read profiles, students and employers.
--
-- Before: every signed-in account could select every row of profiles (name,
-- email, phone), students (school, major, bio) and employers, and anonymous
-- visitors could read employers in full, verification signals included. The
-- browser talks to Supabase directly with the public key, so those three
-- policies were the only thing between a freshly verified account and the
-- whole student directory.
--
-- After:
--   profiles  - your own row; admins; anyone you have a message thread with;
--               applicants to your company's postings (employer side); people
--               working at a company you applied to (student side); your own
--               teammates.
--   students  - your own row; admins; employers with an attached application
--               from that student; message counterparts.
--   employers - approved companies (what every listing card needs), your own
--               company, companies you applied to, admins. Anonymous visitors
--               see approved companies only, and only the public columns
--               (column-level grant), never the verification signals.
--
-- The rules live in security-definer helpers so a policy never recurses into
-- another table's policies, and so every policy reads the same rule.
--
-- Apply after 20260803_employer_team.sql, 20261009_listing_archive_end_hiring.sql
-- (applications.detached_at) and 20261023_company_icon.sql (employers.icon_url).

-- Every company a user acts for: active team membership, plus the account that
-- registered the company (covers rows the team backfill hasn't reached).
create or replace function employer_ids_of_user(uid uuid)
returns setof uuid
language sql stable security definer set search_path = public as $$
  select employer_id from employer_members where user_id = uid and status = 'active'
  union
  select id from employers where user_id = uid;
$$;

create or replace function can_view_profile(target_user_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    auth.uid() = target_user_id
    or is_intern_first_admin(auth.uid())
    -- A message thread, either direction.
    or exists (
      select 1 from messages m
      where (m.sender_id = auth.uid() and m.receiver_id = target_user_id)
         or (m.sender_id = target_user_id and m.receiver_id = auth.uid())
    )
    -- Employer side: the target applied to one of my company's postings.
    or exists (
      select 1
      from applications a
      join students s on s.id = a.student_id
      join internship_listings il on il.id = a.listing_id
      where s.user_id = target_user_id
        and a.detached_at is null
        and il.employer_id in (select employer_ids_of_user(auth.uid()))
    )
    -- Student side: the target works at a company I applied to.
    or exists (
      select 1
      from applications a
      join students s on s.id = a.student_id
      join internship_listings il on il.id = a.listing_id
      where s.user_id = auth.uid()
        and il.employer_id in (select employer_ids_of_user(target_user_id))
    )
    -- Teammates at the same company.
    or exists (
      select 1
      from employer_members me
      join employer_members them on them.employer_id = me.employer_id
      where me.user_id = auth.uid() and me.status = 'active'
        and them.user_id = target_user_id
    )
  );
$$;

create or replace function can_view_student(target_student_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    exists (select 1 from students s where s.id = target_student_id and s.user_id = auth.uid())
    or is_intern_first_admin(auth.uid())
    -- An attached application to one of my company's postings.
    or exists (
      select 1
      from applications a
      join internship_listings il on il.id = a.listing_id
      where a.student_id = target_student_id
        and a.detached_at is null
        and il.employer_id in (select employer_ids_of_user(auth.uid()))
    )
    -- A message thread with the student.
    or exists (
      select 1
      from students s
      join messages m on (m.sender_id = s.user_id and m.receiver_id = auth.uid())
                      or (m.receiver_id = s.user_id and m.sender_id = auth.uid())
      where s.id = target_student_id
    )
  );
$$;

create or replace function can_view_employer(target_employer_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
      select 1 from employers e
      where e.id = target_employer_id and e.verification_status = 'approved'
    )
    or (auth.uid() is not null and (
      is_intern_first_admin(auth.uid())
      or target_employer_id in (select employer_ids_of_user(auth.uid()))
      -- A company I applied to keeps its name on my application even if its
      -- approval is later withdrawn.
      or exists (
        select 1
        from applications a
        join students s on s.id = a.student_id
        join internship_listings il on il.id = a.listing_id
        where s.user_id = auth.uid() and il.employer_id = target_employer_id
      )
    ));
$$;

revoke all on function employer_ids_of_user(uuid) from public;
revoke all on function can_view_profile(uuid) from public;
revoke all on function can_view_student(uuid) from public;
revoke all on function can_view_employer(uuid) from public;
grant execute on function employer_ids_of_user(uuid) to authenticated;
grant execute on function can_view_profile(uuid) to authenticated;
grant execute on function can_view_student(uuid) to authenticated;
grant execute on function can_view_employer(uuid) to anon, authenticated;

-- profiles
drop policy if exists "Profiles are viewable by authenticated users" on profiles;
create policy "Profiles are viewable by owner, admins and counterparts"
  on profiles for select to authenticated
  using (can_view_profile(user_id));

-- students
drop policy if exists "Students are viewable by authenticated users" on students;
create policy "Students are viewable by owner, admins and counterparts"
  on students for select to authenticated
  using (can_view_student(id));

-- employers, signed in
drop policy if exists "Employers are viewable by authenticated users" on employers;
create policy "Employers are viewable when approved or related"
  on employers for select to authenticated
  using (can_view_employer(id));

-- employers, logged out: approved companies, public columns only. Listing
-- cards embed employers(company_name, logo_url, icon_url, website) and the
-- sitemap reads verification_status; nothing public needs the rest.
drop policy if exists "Employers are publicly viewable" on employers;
create policy "Approved employers are publicly viewable"
  on employers for select to anon
  using (verification_status = 'approved');

revoke select on employers from anon;
grant select (id, company_name, description, logo_url, icon_url, website,
              verification_status, verified, created_at)
  on employers to anon;
