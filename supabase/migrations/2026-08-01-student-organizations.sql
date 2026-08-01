-- Creates the student_organizations table (Greek Life + clubs) with RLS.
-- The table is defined in schema.sql but was never applied to the live database,
-- causing POST /rest/v1/student_organizations to 404. Run this in the Supabase
-- SQL editor to fix the organizations section of the student profile.

create table if not exists student_organizations (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  type text not null check (type in ('greek_life', 'club')),
  name text not null,
  chapter text,
  role text,
  join_date date,
  end_date date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index if not exists idx_student_organizations_student on student_organizations(student_id);

create trigger set_student_organizations_updated_at before update on student_organizations for each row execute function update_updated_at();

alter table student_organizations enable row level security;

create policy "Students can view own organizations"
  on student_organizations for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can insert own organizations"
  on student_organizations for insert to authenticated
  with check (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can update own organizations"
  on student_organizations for update to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can delete own organizations"
  on student_organizations for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Employers can view organizations of applicants"
  on student_organizations for select to authenticated
  using (
    student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );
