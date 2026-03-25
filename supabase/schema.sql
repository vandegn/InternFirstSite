-- InternFirst MVP Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor > New Query)

-- ============================================
-- 1. PROFILES (shared across all roles)
-- ============================================
create table profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null unique,
  role text not null check (role in ('student', 'employer', 'university_admin', 'intern_first_admin')),
  full_name text not null,
  email text not null,
  phone text,
  avatar_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 2. UNIVERSITIES
-- ============================================
create table universities (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text not null unique,         -- e.g. 'unc.edu'
  partner boolean default false,
  enrollment_size integer,
  contract_start date,
  logo_url text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 3. STUDENTS (role-specific data)
-- ============================================
create table students (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete cascade not null unique,
  university_id uuid references universities(id),
  major text,
  graduation_year integer,
  resume_url text,
  bio text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 4. EMPLOYERS (role-specific data)
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
-- 5. UNIVERSITY ADMINS (role-specific data)
-- ============================================
create table university_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete cascade not null unique,
  university_id uuid references universities(id) not null,
  job_title text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 6. INTERNSHIP LISTINGS
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
  industry text not null default 'Other' check (industry in ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other')),
  status text default 'active' check (status in ('active', 'paused', 'closed')),
  application_deadline date,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 6b. LISTING VIEWS (analytics tracking)
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
-- 7. APPLICATIONS
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
-- 8. MESSAGES
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
-- 9. UNIVERSITY EVENTS
-- ============================================
create table university_events (
  id uuid primary key default gen_random_uuid(),
  university_id uuid references universities(id) on delete cascade not null,
  created_by uuid references university_admins(id) on delete cascade not null,
  title text not null,
  description text,
  event_type text not null check (event_type in ('career_fair', 'info_session', 'workshop', 'networking', 'other')),
  event_date date not null,
  start_time time not null,
  end_time time,
  location text,
  is_virtual boolean default false,
  virtual_link text,
  max_attendees integer,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

-- ============================================
-- 10. EVENT REGISTRATIONS
-- ============================================
create table event_registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references university_events(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  registered_at timestamptz default now() not null,
  unique(event_id, student_id)
);

-- ============================================
-- INDEXES
-- ============================================
create index idx_profiles_user_id on profiles(user_id);
create index idx_profiles_role on profiles(role);
create index idx_students_university on students(university_id);
create index idx_employers_verified on employers(verified);
create index idx_listings_employer on internship_listings(employer_id);
create index idx_listings_status on internship_listings(status);
create index idx_listings_industry on internship_listings(industry);
create index idx_applications_student on applications(student_id);
create index idx_applications_listing on applications(listing_id);
create index idx_applications_status on applications(status);
create index idx_messages_sender on messages(sender_id);
create index idx_messages_receiver on messages(receiver_id);
create index idx_events_university on university_events(university_id);
create index idx_events_date on university_events(event_date);
create index idx_event_registrations_event on event_registrations(event_id);
create index idx_event_registrations_student on event_registrations(student_id);

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
create trigger set_university_admins_updated_at before update on university_admins for each row execute function update_updated_at();
create trigger set_universities_updated_at before update on universities for each row execute function update_updated_at();
create trigger set_listings_updated_at before update on internship_listings for each row execute function update_updated_at();
create trigger set_applications_updated_at before update on applications for each row execute function update_updated_at();
create trigger set_events_updated_at before update on university_events for each row execute function update_updated_at();

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================
alter table profiles enable row level security;
alter table students enable row level security;
alter table employers enable row level security;
alter table university_admins enable row level security;
alter table universities enable row level security;
alter table internship_listings enable row level security;
alter table applications enable row level security;
alter table messages enable row level security;
alter table university_events enable row level security;
alter table event_registrations enable row level security;

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

-- UNIVERSITY ADMINS: can manage their own record
create policy "University admins can manage own record"
  on university_admins for all to authenticated using (auth.uid() = user_id);

-- UNIVERSITIES: readable by all authenticated users
create policy "Universities are viewable by authenticated users"
  on universities for select to authenticated using (true);

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

-- UNIVERSITY EVENTS: uni admins manage events at their university, students at that uni can view
create policy "University admins can manage events at their university"
  on university_events for all to authenticated
  using (
    university_id in (
      select ua.university_id from university_admins ua where ua.user_id = auth.uid()
    )
  );

create policy "Students can view events at their university"
  on university_events for select to authenticated
  using (
    university_id in (
      select s.university_id from students s where s.user_id = auth.uid()
    )
  );

-- EVENT REGISTRATIONS: students can register/view their own, uni admins can view all for their events
create policy "Students can register for events at their university"
  on event_registrations for insert to authenticated
  with check (
    student_id in (select id from students where user_id = auth.uid())
    and event_id in (
      select e.id from university_events e
      join students s on s.university_id = e.university_id
      where s.user_id = auth.uid()
    )
  );

create policy "Students can view own registrations"
  on event_registrations for select to authenticated
  using (
    student_id in (select id from students where user_id = auth.uid())
  );

create policy "Students can cancel own registrations"
  on event_registrations for delete to authenticated
  using (
    student_id in (select id from students where user_id = auth.uid())
  );

create policy "University admins can view registrations for their events"
  on event_registrations for select to authenticated
  using (
    event_id in (
      select e.id from university_events e
      join university_admins ua on ua.university_id = e.university_id
      where ua.user_id = auth.uid()
    )
  );
