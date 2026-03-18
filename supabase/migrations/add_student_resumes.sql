-- Student Resumes table (students can upload multiple resumes)
create table student_resumes (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  name text not null,              -- display name, e.g. "Software Engineering Resume"
  file_url text not null,
  uploaded_at timestamptz default now() not null
);

create index idx_student_resumes_student on student_resumes(student_id);

-- Add resume_id to applications (which resume was submitted with the application)
alter table applications add column resume_id uuid references student_resumes(id) on delete set null;

-- RLS
alter table student_resumes enable row level security;

-- Students can manage their own resumes
create policy "Students can view own resumes"
  on student_resumes for select to authenticated
  using (
    student_id in (select id from students where user_id = auth.uid())
  );

create policy "Students can insert own resumes"
  on student_resumes for insert to authenticated
  with check (
    student_id in (select id from students where user_id = auth.uid())
  );

create policy "Students can delete own resumes"
  on student_resumes for delete to authenticated
  using (
    student_id in (select id from students where user_id = auth.uid())
  );

-- Employers can view resumes attached to applications for their listings
create policy "Employers can view resumes on applications to their listings"
  on student_resumes for select to authenticated
  using (
    id in (
      select a.resume_id from applications a
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
      and a.resume_id is not null
    )
  );
