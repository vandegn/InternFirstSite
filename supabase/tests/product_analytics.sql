-- Run ONLY against an empty disposable PostgreSQL database:
-- psql "$TEST_DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/product_analytics.sql
-- Minimal existing-schema fixture, followed by the real migration.
create role anon;
create role authenticated;
create role service_role;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.user_id', true),'')::uuid $$;
grant usage on schema auth to authenticated;
create table auth.users(id uuid primary key, raw_user_meta_data jsonb);
create table profiles(user_id uuid primary key, role text, created_at timestamptz default now());
create function is_intern_first_admin(uid uuid) returns boolean language sql stable security definer as $$ select exists(select 1 from profiles where user_id=uid and role='intern_first_admin') $$;
create table students(id uuid primary key, user_id uuid);
create table internship_listings(id uuid primary key, status text, created_at timestamptz default now());
create table applications(id uuid primary key, student_id uuid, listing_id uuid, applied_at timestamptz default now());
create table listing_views(viewed_at timestamptz default now());
create table waitlist(role text, created_at timestamptz default now());
\ir ../migrations/20260916_product_analytics.sql

select set_config('test.user_id','aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',false);
insert into profiles values('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','intern_first_admin',now());
insert into auth.users values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','{"analyticsFlowId":"cccccccc-cccc-4ccc-8ccc-cccccccccccc"}');
select record_product_event(gen_random_uuid(),'registration_started','student','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-cccc-4ccc-8ccc-cccccccccccc:student','/register',null,null);
insert into profiles values('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','student',now());
insert into students values('dddddddd-dddd-4ddd-8ddd-dddddddddddd','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');
-- Publish BEFORE the asynchronous start arrives; correlation must still work.
insert into internship_listings(id,status,analytics_flow_id) values('eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','draft','ffffffff-ffff-4fff-8fff-ffffffffffff');
do $$ begin if exists(select 1 from product_events where name='job_published') then raise exception 'Draft counted as published'; end if; end $$;
update internship_listings set status='active';
update internship_listings set status='paused';
update internship_listings set status='active';
select record_product_event(gen_random_uuid(),'job_posting_started','employer','cccccccc-cccc-4ccc-8ccc-cccccccccccc','ffffffff-ffff-4fff-8fff-ffffffffffff','/dashboard/employer/listings/new',null,null);
select record_product_event(gen_random_uuid(),'application_started','student','cccccccc-cccc-4ccc-8ccc-cccccccccccc','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb:eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee','/dashboard/student/internships/eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',null,'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee');
insert into applications values(gen_random_uuid(),'dddddddd-dddd-4ddd-8ddd-dddddddddddd','eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee',now());
-- Duplicate requests, listing deletion, UTC ranges and role filtering.
select record_product_event(gen_random_uuid(),'registration_started','student','cccccccc-cccc-4ccc-8ccc-cccccccccccc','cccccccc-cccc-4ccc-8ccc-cccccccccccc:student','/register',null,null);
delete from internship_listings;
do $$ declare report jsonb; f jsonb; begin
 if (select count(*) from product_events where name='registration_started') <> 1 then raise exception 'Duplicate starts'; end if;
 if (select count(*) from product_events where name='job_published') <> 1 then raise exception 'Repeated publication'; end if;
 report := admin_product_analytics(now()-interval '1 day', now()+interval '1 day','all');
 for f in select * from jsonb_array_elements(report->'funnels') loop
  if (f->>'started')::int <> 1 or (f->>'completed')::int <> 1 then raise exception 'Incorrect cohort: %', f; end if;
 end loop;
 if jsonb_array_length(report->'funnels') <> 3 then raise exception 'Missing funnels'; end if;
 report := admin_product_analytics(now()-interval '1 day', now()+interval '1 day','student');
 if exists(select 1 from jsonb_array_elements(report->'events') e where e->>'role' <> 'student') then raise exception 'Role filter failed'; end if;
 report := admin_product_analytics(now()-interval '3 days', now()-interval '2 days','all');
 if jsonb_array_length(report->'events') <> 0 then raise exception 'Date filter failed'; end if;
end $$;
-- Database authorization independently of the HTTP endpoint.
set role authenticated;
select set_config('test.user_id','bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',false);
do $$ begin
 if (select count(*) from product_events) <> 0 then raise exception 'Non-admin can read events'; end if;
 begin
  perform admin_product_analytics(now()-interval '1 day', now()+interval '1 day','all');
  raise exception 'Non-admin can read report';
 exception when insufficient_privilege then null; end;
 begin
  perform record_product_event(gen_random_uuid(),'cta_clicked','student',gen_random_uuid(),'forged','/','register',null);
  raise exception 'Non-service can write events';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
-- Rate limit is atomic within a browser session.
do $$ declare s uuid := gen_random_uuid(); i int; begin
 for i in 1..120 loop
  if not record_product_event(gen_random_uuid(),'cta_clicked','anonymous',s,gen_random_uuid()::text,'/','register',null) then raise exception 'Early rate limit'; end if;
 end loop;
 if record_product_event(gen_random_uuid(),'cta_clicked','anonymous',s,gen_random_uuid()::text,'/','register',null) then raise exception 'Rate limit failed'; end if;
end $$;
select 'Product analytics SQL checks passed' as result;
