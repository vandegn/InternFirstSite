-- InternFirst MVP Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- 1. PROFILES (shared across all roles)
-- ============================================
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null check (role in ('student', 'employer', 'intern_first_admin')),
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 2. STUDENTS (role-specific data)
-- ============================================
create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete cascade not null unique,
  major text,
  graduation_year integer,
  resume_url text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 3. EMPLOYERS (role-specific data)
-- ============================================
create table employers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete cascade not null unique,
  company_name text not null,
  business_id text,                    -- EIN for manual verification
  verified boolean default false,
  description text,
  logo_url text,
  website text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 4. INTERNSHIP LISTINGS
-- ============================================
create table internship_listings (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  title text not null,
  description text not null,
  location text,
  is_remote boolean default false,
  compensation text,
  requirements text,
  key_responsibilities text,
  industry text not null default 'Other' check (industry in ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other')),
  status text default 'active' check (status in ('active', 'paused', 'closed')),
  application_deadline date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 4b. LISTING VIEWS (analytics tracking)
-- ============================================
create table listing_views (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  viewer_id uuid references profiles(user_id),
  viewed_at timestamptz default now() not null
);

create index idx_listing_views_listing on listing_views(listing_id);
create index idx_listing_views_viewer on listing_views(viewer_id);

-- RLS for listing_views
alter table listing_views enable row level security;

create policy "Employers can view analytics for their listings"
  on listing_views for select to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

create policy "Authenticated users can insert views"
  on listing_views for insert to authenticated
  with check (true);

-- ============================================
-- 5. APPLICATIONS
-- ============================================
create table applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  status text default 'applied' check (status in ('applied', 'reviewed', 'interviewing', 'offered', 'rejected')),
  applied_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  unique(student_id, listing_id)       -- prevent duplicate applications
);

-- ============================================
-- 6. MESSAGES
-- ============================================
create table messages (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references profiles(user_id) not null,
  receiver_id uuid references profiles(user_id) not null,
  application_id uuid references applications(id) on delete set null,
  body text not null,
  read boolean default false,
  sent_at timestamptz default now() not null
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_profiles_user_id on profiles(user_id);
create index idx_profiles_role on profiles(role);
create index idx_employers_verified on employers(verified);
create index idx_listings_employer on internship_listings(employer_id);
create index idx_listings_status on internship_listings(status);
create index idx_listings_industry on internship_listings(industry);
create index idx_applications_student on applications(student_id);
create index idx_applications_listing on applications(listing_id);
create index idx_applications_status on applications(status);
create index idx_messages_sender on messages(sender_id);
create index idx_messages_receiver on messages(receiver_id);

-- ============================================
-- AUTO-UPDATE updated_at TRIGGER
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_profiles_updated_at before update on profiles for each row execute function update_updated_at();
create trigger set_students_updated_at before update on students for each row execute function update_updated_at();
create trigger set_employers_updated_at before update on employers for each row execute function update_updated_at();
create trigger set_listings_updated_at before update on internship_listings for each row execute function update_updated_at();
create trigger set_applications_updated_at before update on applications for each row execute function update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table profiles enable row level security;
alter table students enable row level security;
alter table employers enable row level security;
alter table internship_listings enable row level security;
alter table applications enable row level security;
alter table messages enable row level security;

-- PROFILES: users can read all profiles, but only update their own
create policy "Profiles are viewable by authenticated users"
  on profiles for select to authenticated using (true);

create policy "Users can update own profile"
  on profiles for update to authenticated using (auth.uid() = user_id);

create policy "Users can insert own profile"
  on profiles for insert to authenticated with check (auth.uid() = user_id);

-- STUDENTS: students can manage their own record, others can view
create policy "Students are viewable by authenticated users"
  on students for select to authenticated using (true);

create policy "Students can manage own record"
  on students for all to authenticated using (auth.uid() = user_id);

-- EMPLOYERS: employers can manage their own record, others can view
create policy "Employers are viewable by authenticated users"
  on employers for select to authenticated using (true);

create policy "Employers can manage own record"
  on employers for all to authenticated using (auth.uid() = user_id);

-- INTERNSHIP LISTINGS: anyone can view active listings, employers manage their own
create policy "Active listings are viewable by authenticated users"
  on internship_listings for select to authenticated using (true);

create policy "Employers can manage own listings"
  on internship_listings for all to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  );

-- APPLICATIONS: students see their own, employers see applications to their listings
create policy "Students can view own applications"
  on applications for select to authenticated
  using (
    student_id in (select id from students where user_id = auth.uid())
  );

create policy "Employers can view applications to their listings"
  on applications for select to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

create policy "Students can insert own applications"
  on applications for insert to authenticated
  with check (
    student_id in (select id from students where user_id = auth.uid())
  );

create policy "Employers can update application status"
  on applications for update to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- MESSAGES: users can see messages they sent or received
create policy "Users can view own messages"
  on messages for select to authenticated
  using (auth.uid() = sender_id or auth.uid() = receiver_id);

create policy "Users can send messages"
  on messages for insert to authenticated
  with check (auth.uid() = sender_id);

-- ============================================
-- 7. STUDENT SKILLS
-- ============================================
create table student_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  name text not null,
  is_custom boolean default false,
  created_at timestamptz default now() not null,
  unique(student_id, name)
);

create index idx_student_skills_student on student_skills(student_id);

alter table student_skills enable row level security;

create policy "Students can view own skills"
  on student_skills for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can insert own skills"
  on student_skills for insert to authenticated
  with check (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can delete own skills"
  on student_skills for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Employers can view skills of applicants"
  on student_skills for select to authenticated
  using (
    student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ============================================
-- 8. STUDENT EXPERIENCES
-- ============================================
create table student_experiences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  type text not null check (type in ('internship', 'project', 'campus_involvement')),
  title text not null,
  organization text,
  location text,
  description text,
  technologies text,
  link text,
  start_date date,
  end_date date,
  is_current boolean default false,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_student_experiences_student on student_experiences(student_id);
create index idx_student_experiences_type on student_experiences(type);

create trigger set_student_experiences_updated_at before update on student_experiences for each row execute function update_updated_at();

alter table student_experiences enable row level security;

create policy "Students can view own experiences"
  on student_experiences for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can insert own experiences"
  on student_experiences for insert to authenticated
  with check (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can update own experiences"
  on student_experiences for update to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can delete own experiences"
  on student_experiences for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Employers can view experiences of applicants"
  on student_experiences for select to authenticated
  using (
    student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ============================================
-- 9. STUDENT ORGANIZATIONS
-- ============================================
create table student_organizations (
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

create index idx_student_organizations_student on student_organizations(student_id);

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

-- ============================================
-- 14. UNIVERSITY-EMPLOYER PARTNERSHIPS
-- ============================================
create table university_employer_partnerships (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz default now() not null,
  unique(university_id, employer_id)
);

create index idx_uep_university on university_employer_partnerships(university_id);
create index idx_uep_employer on university_employer_partnerships(employer_id);
create index idx_uep_status on university_employer_partnerships(status);

alter table university_employer_partnerships enable row level security;

create policy "Authenticated users can view active partnerships"
  on university_employer_partnerships for select to authenticated
  using (true);

create policy "University admins can insert partnerships for their university"
  on university_employer_partnerships for insert to authenticated
  with check (
    university_id in (
      select ua.university_id from university_admins ua where ua.user_id = auth.uid()
    )
  );

create policy "University admins can update partnerships for their university"
  on university_employer_partnerships for update to authenticated
  using (
    university_id in (
      select ua.university_id from university_admins ua where ua.user_id = auth.uid()
    )
  );

create policy "University admins can delete partnerships for their university"
  on university_employer_partnerships for delete to authenticated
  using (
    university_id in (
      select ua.university_id from university_admins ua where ua.user_id = auth.uid()
    )
  );

-- =============================================
-- CAREER SURVEY RESPONSES
-- =============================================

CREATE TABLE career_survey_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  industries text[] NOT NULL DEFAULT '{}',
  work_environment text NOT NULL,
  preferred_duration text NOT NULL,
  skills text[] NOT NULL DEFAULT '{}',
  career_goals text DEFAULT '',
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_career_survey_student ON career_survey_responses(student_id);

ALTER TABLE career_survey_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own survey"
  ON career_survey_responses FOR SELECT
  USING (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can insert own survey"
  ON career_survey_responses FOR INSERT
  WITH CHECK (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));

CREATE POLICY "Students can update own survey"
  ON career_survey_responses FOR UPDATE
  USING (student_id IN (
    SELECT id FROM students WHERE user_id = auth.uid()
  ));
