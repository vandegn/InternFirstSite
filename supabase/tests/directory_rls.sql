-- Run ONLY against an empty disposable PostgreSQL database:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/directory_rls.sql
-- Minimal fixture shaped like the live schema (Supabase roles, auth.uid(),
-- default grants, the old allow-all policies), then the real migration.
create role anon;
create role authenticated;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true),'')::uuid $$;
grant usage on schema auth to anon, authenticated;
grant usage on schema public to anon, authenticated;

create table profiles(user_id uuid primary key, role text not null, full_name text, email text, phone text);
create table students(id uuid primary key, user_id uuid references profiles(user_id), major text);
create table employers(id uuid primary key, user_id uuid references profiles(user_id), company_name text, verification_status text default 'pending', email_domain text, icon_url text, logo_url text, description text, website text, verified boolean, created_at timestamptz default now());
create table employer_members(id uuid primary key default gen_random_uuid(), employer_id uuid references employers(id), user_id uuid references profiles(user_id), status text default 'active');
create table internship_listings(id uuid primary key, employer_id uuid references employers(id));
create table applications(id uuid primary key default gen_random_uuid(), student_id uuid references students(id), listing_id uuid references internship_listings(id), detached_at timestamptz);
create table messages(id uuid primary key default gen_random_uuid(), sender_id uuid references profiles(user_id), receiver_id uuid references profiles(user_id));
create function is_intern_first_admin(uid uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where user_id=uid and role='intern_first_admin') $$;
create function acting_employer_ids(uid uuid) returns setof uuid language sql stable security definer as $$ select employer_id from employer_members where user_id=uid and status='active' $$;
grant select on all tables in schema public to anon, authenticated;
alter table profiles enable row level security;
alter table students enable row level security;
alter table employers enable row level security;
alter table employer_members enable row level security;
alter table internship_listings enable row level security;
alter table applications enable row level security;
alter table messages enable row level security;
-- The policies being replaced, as they stood.
create policy "Profiles are viewable by authenticated users" on profiles for select to authenticated using (true);
create policy "Students are viewable by authenticated users" on students for select to authenticated using (true);
create policy "Employers are viewable by authenticated users" on employers for select to authenticated using (true);
create policy "Employers are publicly viewable" on employers for select to anon using (true);
create policy "Admins can view all employers" on employers for select to authenticated using (is_intern_first_admin(auth.uid()));
create policy "Members can view own company" on employers for select to authenticated using (auth.uid() = user_id or id in (select acting_employer_ids(auth.uid())));

\ir ../migrations/20261023_tighten_directory_rls.sql

-- ---- fixture ----
-- admin
insert into profiles values ('00000000-0000-4000-8000-00000000000a','intern_first_admin','Admin','admin@x','1');
-- students A, B
insert into profiles values ('00000000-0000-4000-8000-0000000000a1','student','Student A','a@edu','111');
insert into profiles values ('00000000-0000-4000-8000-0000000000b1','student','Student B','b@edu','222');
insert into students values ('00000000-0000-4000-8000-00000000aa01','00000000-0000-4000-8000-0000000000a1','CS');
insert into students values ('00000000-0000-4000-8000-00000000bb01','00000000-0000-4000-8000-0000000000b1','Art');
-- employer E1 (approved): owner O1, teammate T1 ; employer E2 (approved): owner O2 ; employer P (pending): owner OP
insert into profiles values ('00000000-0000-4000-8000-0000000000e1','employer','Owner One','o1@co','0');
insert into profiles values ('00000000-0000-4000-8000-0000000000e2','employer','Teammate One','t1@co','0');
insert into profiles values ('00000000-0000-4000-8000-0000000000e3','employer','Owner Two','o2@co','0');
insert into profiles values ('00000000-0000-4000-8000-0000000000e4','employer','Owner Pending','op@co','0');
insert into employers (id,user_id,company_name,verification_status,email_domain) values
  ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000e1','E1','approved','co.com'),
  ('00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8000-0000000000e3','E2','approved','two.com'),
  ('00000000-0000-4000-8000-0000000000f3','00000000-0000-4000-8000-0000000000e4','P','pending','p.com');
insert into employer_members (employer_id,user_id,status) values
  ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000e1','active'),
  ('00000000-0000-4000-8000-0000000000f1','00000000-0000-4000-8000-0000000000e2','active'),
  ('00000000-0000-4000-8000-0000000000f2','00000000-0000-4000-8000-0000000000e3','active'),
  ('00000000-0000-4000-8000-0000000000f3','00000000-0000-4000-8000-0000000000e4','active');
insert into internship_listings values ('00000000-0000-4000-8000-0000000000d1','00000000-0000-4000-8000-0000000000f1');
insert into internship_listings values ('00000000-0000-4000-8000-0000000000d2','00000000-0000-4000-8000-0000000000f2');
-- A applied to E1's listing. B applied to E2's listing but that application is detached.
insert into applications (student_id,listing_id) values ('00000000-0000-4000-8000-00000000aa01','00000000-0000-4000-8000-0000000000d1');
insert into applications (student_id,listing_id,detached_at) values ('00000000-0000-4000-8000-00000000bb01','00000000-0000-4000-8000-0000000000d2', now());
-- B has a message thread with Owner Two.
insert into messages (sender_id,receiver_id) values ('00000000-0000-4000-8000-0000000000e3','00000000-0000-4000-8000-0000000000b1');

create function visible_profiles() returns setof text language sql stable as $$ select full_name from profiles order by 1 $$;
create function visible_students() returns setof text language sql stable as $$ select major from students order by 1 $$;
create function visible_employers() returns setof text language sql stable as $$ select company_name from employers order by 1 $$;
grant execute on function visible_profiles(), visible_students(), visible_employers() to anon, authenticated;

-- ---- Student A ----
set role authenticated;
select set_config('test.user_id','00000000-0000-4000-8000-0000000000a1',false);
do $$ begin
  assert (select array_agg(x) from visible_profiles() x) = array['Owner One','Student A','Teammate One'],
    format('student A profiles: %s', (select array_agg(x) from visible_profiles() x));
  assert (select array_agg(x) from visible_students() x) = array['CS'],
    format('student A students: %s', (select array_agg(x) from visible_students() x));
  assert (select array_agg(x) from visible_employers() x) = array['E1','E2'],
    format('student A employers: %s', (select array_agg(x) from visible_employers() x));
end $$;

-- ---- Student B: no live application, but a message thread with Owner Two ----
select set_config('test.user_id','00000000-0000-4000-8000-0000000000b1',false);
do $$ begin
  assert (select array_agg(x) from visible_profiles() x) = array['Owner Two','Student B'],
    format('student B profiles: %s', (select array_agg(x) from visible_profiles() x));
  assert (select array_agg(x) from visible_students() x) = array['Art'],
    format('student B students: %s', (select array_agg(x) from visible_students() x));
end $$;

-- ---- Teammate at E1: sees applicant A, teammate, own company; not B ----
select set_config('test.user_id','00000000-0000-4000-8000-0000000000e2',false);
do $$ begin
  assert (select array_agg(x) from visible_profiles() x) = array['Owner One','Student A','Teammate One'],
    format('teammate profiles: %s', (select array_agg(x) from visible_profiles() x));
  assert (select array_agg(x) from visible_students() x) = array['CS'],
    format('teammate students: %s', (select array_agg(x) from visible_students() x));
end $$;

-- ---- Owner Two: B's application is detached, so only the message thread shows B ----
select set_config('test.user_id','00000000-0000-4000-8000-0000000000e3',false);
do $$ begin
  assert (select array_agg(x) from visible_profiles() x) = array['Owner Two','Student B'],
    format('owner two profiles: %s', (select array_agg(x) from visible_profiles() x));
  assert (select array_agg(x) from visible_students() x) = array['Art'],
    format('owner two students: %s', (select array_agg(x) from visible_students() x));
end $$;

-- ---- Pending employer: nobody's data, own company visible ----
select set_config('test.user_id','00000000-0000-4000-8000-0000000000e4',false);
do $$ begin
  assert (select array_agg(x) from visible_profiles() x) = array['Owner Pending'],
    format('pending profiles: %s', (select array_agg(x) from visible_profiles() x));
  assert (select count(*) from visible_students()) = 0, 'pending employer sees students';
  assert (select array_agg(x) from visible_employers() x) = array['E1','E2','P'],
    format('pending employers: %s', (select array_agg(x) from visible_employers() x));
end $$;

-- ---- Admin ----
select set_config('test.user_id','00000000-0000-4000-8000-00000000000a',false);
do $$ begin
  assert (select count(*) from visible_profiles()) = 7, 'admin sees all profiles';
  assert (select count(*) from visible_students()) = 2, 'admin sees all students';
  assert (select count(*) from visible_employers()) = 3, 'admin sees all employers';
end $$;

-- ---- Anonymous ----
reset role;
set role anon;
select set_config('test.user_id','',false);
do $$
declare denied boolean := false;
begin
  assert (select array_agg(x) from visible_employers() x) = array['E1','E2'],
    format('anon employers: %s', (select array_agg(x) from visible_employers() x));
  begin
    perform email_domain from employers;
  exception when insufficient_privilege then denied := true;
  end;
  assert denied, 'anon could read employers.email_domain';
  assert (select count(*) from (select company_name, logo_url, icon_url, website, verification_status from employers) q) = 2, 'anon public columns';
end $$;
reset role;
select 'directory_rls: all assertions passed' as result;
