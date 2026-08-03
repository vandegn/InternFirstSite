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
  -- School, picked from the Dept. of Education approved list served by
  -- /api/schools. school_id is the federal institution id; name and state are
  -- denormalised so profile views render without a lookup.
  -- See migrations/20260802_student_school.sql.
  school_id integer,
  school_name text,
  school_state text,
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
  description text,
  logo_url text,
  website text,
  -- Verification. Every employer starts 'pending'; until they are 'approved'
  -- their listings are hidden and applicant data is invisible to them.
  -- `verified` is a derived mirror maintained by trg_sync_employer_verified --
  -- never write it directly. See migrations/20260801_employer_verification.sql.
  verification_status text not null default 'pending'
    check (verification_status in ('pending', 'needs_info', 'approved', 'rejected')),
  verified boolean default false,
  verification_note text,              -- reviewer -> employer
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(user_id) on delete set null,
  -- Automated triage signals, written by /api/employer/verification-signals
  email_domain text,
  website_domain text,
  domain_match boolean,
  free_email_provider boolean,
  domain_registered_at timestamptz,
  domain_age_days int,
  signals_checked_at timestamptz,
  signals_error text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_employers_verification_status on employers(verification_status);

create or replace function sync_employer_verified()
returns trigger
language plpgsql
as $$
begin
  new.verified := (new.verification_status = 'approved');
  return new;
end;
$$;

create trigger trg_sync_employer_verified
  before insert or update of verification_status on employers
  for each row execute function sync_employer_verified();

-- Predicates used by the verification gates below. security definer so
-- tightening the employers/profiles select policies later cannot silently
-- turn these into `false` and lock everyone out.
create or replace function is_approved_employer(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from employers where user_id = uid and verification_status = 'approved'
  );
$$;

create or replace function is_intern_first_admin(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where user_id = uid and role = 'intern_first_admin'
  );
$$;

-- ============================================
-- 4. INTERNSHIP LISTINGS
-- ============================================
create table internship_listings (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  title text not null,
  description text not null,
  location text,                       -- canonical "Raleigh, NC" display string (see section 20)
  city text,                           -- structured parts, set by the location picker
  state text check (state is null or state ~ '^[A-Z]{2}$'),
  lat double precision,
  lng double precision,
  is_remote boolean default false,
  is_hybrid boolean default false,
  compensation text,                   -- display string derived from the comp_* columns (see section 19)
  requirements text,
  key_responsibilities text,
  industry text not null default 'Other' check (industry in ('Technology', 'Finance', 'Healthcare', 'Marketing', 'Legal', 'Engineering', 'Education', 'Media', 'Nonprofit', 'Government', 'Retail', 'Other')),
  status text default 'active' check (status in ('active', 'paused', 'closed')),
  application_deadline date,
  duration text,
  -- Customization (see section 19: Customizable Job Postings)
  comp_type text check (comp_type in ('hourly', 'salary', 'stipend', 'unpaid', 'other')),
  comp_min_cents int,
  comp_max_cents int,
  comp_note text,
  role_tags text[] not null default '{}',
  banner_url text,
  accent_color text check (accent_color ~ '^#[0-9a-fA-F]{6}$'),
  -- Billing (see section 18: Employer Payment Plans)
  pricing_model text check (pricing_model in ('ppj', 'ppa')),
  applicant_quota int,                 -- PPJ estimate upper bound (informational, no cap)
  applicant_count int not null default 0,  -- maintained by handle_new_application() trigger
  cpa_cents int,                       -- group CPA snapshot at posting time
  expires_at timestamptz,              -- derived from posting duration (does not affect price)
  payment_status text not null default 'active' check (payment_status in ('pending', 'paid', 'active')),
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

-- One row per account per listing, so view counts are unique viewers rather
-- than page loads. NULL viewer_ids stay distinct (no constraint on anonymous).
create unique index idx_listing_views_unique_viewer
  on listing_views(listing_id, viewer_id);

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
-- 4c. SAVED LISTINGS (student bookmarks)
-- ============================================
-- Private to the student: saving is not applying, costs the employer nothing,
-- and is never visible to them.
create table saved_listings (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  saved_at timestamptz not null default now(),
  unique (student_id, listing_id)
);

create index idx_saved_listings_student on saved_listings(student_id);
create index idx_saved_listings_listing on saved_listings(listing_id);

alter table saved_listings enable row level security;

create policy "Students can view own saved listings"
  on saved_listings for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can save listings"
  on saved_listings for insert to authenticated
  with check (student_id in (select id from students where user_id = auth.uid()));

create policy "Students can unsave listings"
  on saved_listings for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- ============================================
-- 5. APPLICATIONS
-- ============================================
create table applications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  status text default 'applied' check (status in ('applied', 'reviewed', 'interviewing', 'offered', 'rejected')),
  match_score int check (match_score between 0 and 100),  -- weighted profile match (app/src/lib/matching.ts); null if scoring failed; PPA bills only >= 70 (section 18)
  flagged_knockout boolean not null default false,        -- set by flag_knockout_answer() trigger (section 19)
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
  sent_at timestamptz default now() not null,
  email_notified_at timestamptz
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

create policy "Admins can view all employers"
  on employers for select to authenticated
  using (is_intern_first_admin(auth.uid()));

create policy "Admins can update verification"
  on employers for update to authenticated
  using (is_intern_first_admin(auth.uid()))
  with check (is_intern_first_admin(auth.uid()));

-- INTERNSHIP LISTINGS: listings are visible only while their employer is
-- approved, so an unreviewed company cannot put a posting in front of students.
-- Employers still see and edit their own via "Employers can manage own listings".
create policy "Active listings are viewable by authenticated users"
  on internship_listings for select to authenticated
  using (
    employer_id in (select id from employers where verification_status = 'approved')
  );

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

-- Gated on approval: applicant data is the thing worth stealing, so it stays
-- invisible until a human has reviewed the company.
create policy "Employers can view applications to their listings"
  on applications for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and listing_id in (
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
    is_approved_employer(auth.uid())
    and listing_id in (
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

-- Receivers can update their received messages (used to mark them as read).
create policy "Receivers can mark messages read"
  on messages for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);

-- ============================================
-- 7. STUDENT SKILLS
-- ============================================
-- Fixed catalog of selectable skills (seeded from app/public/skills.json).
-- student_skills.name is FK-constrained to this table, so only catalog skills
-- can be attached — no free-text/custom skills. Keeps skill matching consistent.
create table valid_skills (
  name text primary key
);

alter table valid_skills enable row level security;

create policy "Anyone can view valid skills"
  on valid_skills for select to authenticated
  using (true);

create table student_skills (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  name text not null references valid_skills(name) on update cascade,
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
    is_approved_employer(auth.uid())
    and student_id in (
      select s.id from students s
      join applications a on a.student_id = s.id
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- Cap each student at 10 skills (mirrors MAX_STUDENT_SKILLS in
-- app/src/lib/constants.ts — keep the number in sync).
create or replace function enforce_skill_limit()
returns trigger
language plpgsql
as $$
begin
  if (select count(*) from student_skills where student_id = new.student_id) >= 10 then
    raise exception 'A student can have at most 10 skills.'
      using errcode = 'check_violation';
  end if;
  return new;
end;
$$;

create trigger student_skills_limit
  before insert on student_skills
  for each row execute function enforce_skill_limit();

-- ============================================
-- 8. STUDENT EXPERIENCES
-- ============================================
create table student_experiences (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  -- Professional history only. Campus clubs and involvement live in
  -- student_organizations.
  type text not null check (type in ('internship', 'work', 'project')),
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
    is_approved_employer(auth.uid())
    and student_id in (
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
  type text not null check (type in ('greek_life', 'club', 'campus_involvement', 'other')),
  name text not null,
  chapter text,
  role text,
  description text,
  join_date date,
  end_date date,
  -- Still a member: the UI ignores end_date and renders "Present".
  is_current boolean default false,
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
    is_approved_employer(auth.uid())
    and student_id in (
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
  -- Ranked, strongest preference first. The scalar columns mirror element 1 and
  -- are maintained by trg_sync_survey_preference_arrays.
  work_environments text[] NOT NULL DEFAULT '{}',
  preferred_durations text[] NOT NULL DEFAULT '{}',
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

-- ============================================
-- 15. INTERVIEW SCHEDULES
-- ============================================
create table interview_schedules (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  scheduled_at timestamptz not null,
  duration_minutes int not null default 30 check (duration_minutes > 0),
  status text not null default 'pending' check (status in
    ('pending', 'accepted', 'declined', 'reschedule_requested', 'cancelled', 'completed')),
  employer_notes text,
  cancelled_by text check (cancelled_by in ('employer', 'student')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Only one active interview per application at a time
create unique index interview_schedules_one_active_per_application
  on interview_schedules (application_id)
  where status not in ('declined', 'cancelled', 'completed');

create index idx_interview_schedules_employer on interview_schedules (employer_id, scheduled_at);
create index idx_interview_schedules_student on interview_schedules (student_id, scheduled_at);
create index idx_interview_schedules_status on interview_schedules (status);

create trigger set_interview_schedules_updated_at
  before update on interview_schedules
  for each row execute function update_updated_at();

alter table interview_schedules enable row level security;

-- Employer can view interviews for their listings
create policy "Employers can view own interviews"
  on interview_schedules for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

-- Student can view interviews assigned to them
create policy "Students can view own interviews"
  on interview_schedules for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- Employer can create interviews for their own listings
create policy "Employers can create interviews for own listings"
  on interview_schedules for insert to authenticated
  with check (employer_id in (select id from employers where user_id = auth.uid()));

-- Employer can update their own interviews (reschedule, cancel, room metadata)
create policy "Employers can update own interviews"
  on interview_schedules for update to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

-- Student can update interviews assigned to them (respond, cancel)
create policy "Students can update own interviews"
  on interview_schedules for update to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- =============================================
-- STUDENT EEO / VOLUNTARY SELF-IDENTIFICATION
-- =============================================
-- Federally-recognized voluntary self-id (race, ethnicity, gender,
-- veteran, disability) plus work authorization. Voluntariness is
-- enforced by application code (every question accepts "declined").
-- IMPORTANT: This table is NOT readable by employers — there is no
-- employer SELECT policy on it, which is intentional.

CREATE TABLE student_eeo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL UNIQUE REFERENCES students(id) ON DELETE CASCADE,
  ethnicity_hispanic_latino text CHECK (ethnicity_hispanic_latino IN ('yes', 'no', 'declined')),
  race text[] NOT NULL DEFAULT '{}',
  race_declined boolean NOT NULL DEFAULT false,
  gender text CHECK (gender IN ('male', 'female', 'non_binary', 'self_describe', 'declined')),
  gender_self_describe text,
  veteran_status text CHECK (veteran_status IN ('protected_veteran', 'not_veteran', 'declined')),
  disability_status text CHECK (disability_status IN ('yes', 'no', 'declined')),
  work_authorized_us text CHECK (work_authorized_us IN ('yes', 'no')),
  requires_sponsorship text CHECK (requires_sponsorship IN ('yes', 'no')),
  completed_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_student_eeo_student ON student_eeo(student_id);

ALTER TABLE student_eeo ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view own EEO"
  ON student_eeo FOR SELECT
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "Students can insert own EEO"
  ON student_eeo FOR INSERT
  WITH CHECK (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE POLICY "Students can update own EEO"
  ON student_eeo FOR UPDATE
  USING (student_id IN (SELECT id FROM students WHERE user_id = auth.uid()));

CREATE TRIGGER set_student_eeo_updated_at
  BEFORE UPDATE ON student_eeo
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- 16. NOTIFICATIONS
-- ============================================
-- In-platform notifications surfaced by the header bell. A row is inserted
-- by the actor (current user) for the recipient whenever a relevant event
-- happens: a first message in a conversation, an application status change
-- (CRM move), a new applicant, or an interview event.

create table notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete cascade not null,   -- recipient
  actor_id uuid references profiles(user_id) on delete set null,          -- who triggered it
  type text not null check (type in ('message', 'application_status', 'new_application', 'interview')),
  title text not null,
  body text,
  link text,
  read boolean default false,
  created_at timestamptz default now() not null
);

create index idx_notifications_user on notifications(user_id, created_at desc);
create index idx_notifications_unread on notifications(user_id) where read = false;

alter table notifications enable row level security;

create policy "Users can view own notifications"
  on notifications for select to authenticated
  using (auth.uid() = user_id);

create policy "Users can update own notifications"
  on notifications for update to authenticated
  using (auth.uid() = user_id);

create policy "Users can create notifications as themselves"
  on notifications for insert to authenticated
  with check (auth.uid() = actor_id);

-- ============================================
-- 17. WAITLIST
-- ============================================
-- Pre-launch signups collected from the public /waitlist page. Anyone can
-- insert (anon role) but only authenticated admins should read.

create table waitlist (
  id uuid primary key default gen_random_uuid(),
  email text not null unique,
  full_name text,
  role text check (role in ('student', 'employer', 'other')),
  created_at timestamptz default now() not null
);

create index idx_waitlist_created on waitlist(created_at desc);

alter table waitlist enable row level security;

create policy "Anyone can join the waitlist"
  on waitlist for insert to anon, authenticated
  with check (true);

create policy "Admins can view waitlist"
  on waitlist for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'intern_first_admin'
    )
  );

-- ============================================
-- 18. EMPLOYER PAYMENT PLANS (PPJ / PPA)
-- ============================================
-- CPA (Cost-Per-Application) is a per–occupation-group benchmark anchored to a
-- listing's industry and snapshotted onto the listing as cpa_cents at posting.
-- PPJ (Pay Per Job): fixed upfront fee = median(estimated range) × CPA. The
--   listing goes live only after Stripe payment succeeds. No applicant cap.
-- PPA (Pay Per Application): no upfront charge; each completed application whose
--   match_score >= 70 accrues cpa_cents, tallied and invoiced monthly. No cap.
-- The pricing columns on internship_listings are defined inline above.
-- NOTE: the match threshold (70) below MUST stay in sync with
--       PPA_MATCH_THRESHOLD in app/src/lib/constants.ts.

-- Stripe customer per employer
create table employer_billing (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null unique,
  stripe_customer_id text,
  default_payment_method text,
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

create index idx_employer_billing_employer on employer_billing(employer_id);

alter table employer_billing enable row level security;

create policy "Employers read own billing"
  on employer_billing for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

create trigger set_employer_billing_updated_at
  before update on employer_billing
  for each row execute function update_updated_at();

-- Record of every Stripe charge (PPJ upfront receipts + monthly PPA invoices)
create table listing_payments (
  id uuid primary key default gen_random_uuid(),
  employer_id uuid references employers(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete set null,
  type text not null check (type in ('ppj_upfront', 'ppa_monthly')),
  stripe_ref text,
  amount_cents int not null default 0,
  status text not null default 'pending' check (status in ('pending', 'paid', 'failed')),
  applicant_quota int,
  duration_days int,
  billing_period date,
  created_at timestamptz default now() not null
);

create index idx_listing_payments_employer on listing_payments(employer_id, created_at desc);
create index idx_listing_payments_listing on listing_payments(listing_id);

alter table listing_payments enable row level security;

create policy "Employers read own payments"
  on listing_payments for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

-- PPA metering ledger: one row per chargeable applicant
create table applicant_charges (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  application_id uuid references applications(id) on delete cascade not null unique,
  billing_period date not null,
  amount_cents int not null,
  invoiced boolean not null default false,
  listing_payment_id uuid references listing_payments(id) on delete set null,
  created_at timestamptz default now() not null
);

create index idx_applicant_charges_employer on applicant_charges(employer_id, billing_period);
create index idx_applicant_charges_uninvoiced on applicant_charges(employer_id) where invoiced = false;

alter table applicant_charges enable row level security;

create policy "Employers read own charges"
  on applicant_charges for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

-- Count applicants and meter qualifying PPA applications. Security-definer so it
-- runs regardless of the inserting client's RLS scope. No cap → no auto-close.
create or replace function handle_new_application()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_model       text;
  v_cpa         int;
  v_employer_id uuid;
  v_status      text;
  v_deadline    date;
begin
  select pricing_model, cpa_cents, employer_id, status, application_deadline
    into v_model, v_cpa, v_employer_id, v_status, v_deadline
  from internship_listings
  where id = new.listing_id;

  update internship_listings
    set applicant_count = applicant_count + 1
  where id = new.listing_id;

  -- Only bill live listings: expired/paused/closed listings never charge, even
  -- if a direct-link application slips in before the daily close-expired cron
  -- (supabase/migrations/20260726_close_expired_listings.sql) flips them.
  if v_model = 'ppa'
     and v_status = 'active'
     and (v_deadline is null or v_deadline >= current_date)
     and coalesce(new.match_score, 0) >= 70 then
    insert into applicant_charges (listing_id, employer_id, application_id, billing_period, amount_cents)
    values (new.listing_id, v_employer_id, new.id, date_trunc('month', now())::date, coalesce(v_cpa, 1609))
    on conflict (application_id) do nothing;
  end if;

  return new;
end;
$$;

create trigger on_application_created
  after insert on applications
  for each row execute function handle_new_application();

-- ============================================
-- 19. CUSTOMIZABLE JOB POSTINGS
-- ============================================
-- Employer-controlled extras on a listing. The comp_*, role_tags, banner_url
-- and accent_color columns are defined inline on internship_listings above.
--
-- `industry` deliberately stays a 12-value preset: it drives PPJ/PPA pricing
-- (cpaForIndustry), the student filter pills, and major-based recommendations.
-- role_tags is the additive free-form escape hatch.
--
-- `compensation` is kept as a display string derived from the comp_* columns by
-- formatCompensation() in app/src/lib/constants.ts and written on every save.
-- getActiveListings' paid/unpaid filter matches the literal string 'Unpaid',
-- so that derivation must keep producing it for comp_type = 'unpaid'.

-- ----- Extra content sections -----
-- Job Overview / Qualifications / Key Responsibilities stay as columns on
-- internship_listings — they feed the keyword search in getActiveListings.
-- These are additional employer-authored markdown blocks rendered after them.
create table listing_sections (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  heading text not null,
  body text not null,
  position int not null default 0,
  created_at timestamptz default now() not null
);

create index idx_listing_sections_listing on listing_sections(listing_id, position);

alter table listing_sections enable row level security;

create policy "Employers manage sections on own listings"
  on listing_sections for all to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  )
  with check (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

create policy "Sections on active listings are viewable"
  on listing_sections for select to authenticated
  using (listing_id in (select id from internship_listings where status = 'active'));

create policy "Sections on active listings are publicly viewable"
  on listing_sections for select to anon
  using (listing_id in (select id from internship_listings where status = 'active'));

-- ----- Custom screening questions -----
-- knockout_answer only applies to question_type = 'yes_no'. A matching answer
-- flags the application for the employer; it never blocks submission.
create table listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  prompt text not null,
  help_text text,
  question_type text not null default 'short_text'
    check (question_type in ('short_text', 'long_text', 'single_select', 'multi_select', 'yes_no', 'file')),
  options text[] not null default '{}',
  required boolean not null default false,
  knockout_answer text check (knockout_answer in ('yes', 'no')),
  position int not null default 0,
  created_at timestamptz default now() not null
);

create index idx_listing_questions_listing on listing_questions(listing_id, position);

alter table listing_questions enable row level security;

create policy "Employers manage questions on own listings"
  on listing_questions for all to authenticated
  using (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  )
  with check (
    listing_id in (
      select il.id from internship_listings il
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

create policy "Questions on active listings are viewable"
  on listing_questions for select to authenticated
  using (listing_id in (select id from internship_listings where status = 'active'));

create policy "Questions on active listings are publicly viewable"
  on listing_questions for select to anon
  using (listing_id in (select id from internship_listings where status = 'active'));

-- ----- Application answers -----
-- One row per (application, question). Which column is populated depends on the
-- question type: answer_text for short/long/yes_no/single_select,
-- answer_options for multi_select, file_url for file uploads.
create table application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  question_id uuid references listing_questions(id) on delete cascade not null,
  answer_text text,
  answer_options text[] not null default '{}',
  file_url text,
  created_at timestamptz default now() not null,
  unique(application_id, question_id)
);

create index idx_application_answers_application on application_answers(application_id);
create index idx_application_answers_question on application_answers(question_id);

alter table application_answers enable row level security;

-- Deliberately no update/delete policy — answers are immutable once submitted.
create policy "Students insert answers on own applications"
  on application_answers for insert to authenticated
  with check (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

create policy "Students read answers on own applications"
  on application_answers for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

create policy "Employers read answers on their listings"
  on application_answers for select to authenticated
  using (
    is_approved_employer(auth.uid())
    and application_id in (
      select a.id from applications a
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );

-- ----- Knockout flagging -----
-- Set server-side rather than by the client, so a student cannot submit a
-- disqualifying answer with the flag suppressed.
create or replace function flag_knockout_answer()
returns trigger as $$
declare
  ko text;
  qtype text;
begin
  select knockout_answer, question_type into ko, qtype
    from listing_questions where id = new.question_id;

  if qtype = 'yes_no' and ko is not null and lower(new.answer_text) = ko then
    update applications set flagged_knockout = true where id = new.application_id;
  end if;

  return new;
end;
$$ language plpgsql security definer;

create trigger trg_flag_knockout_answer
  after insert on application_answers
  for each row execute function flag_knockout_answer();

-- ============================================
-- 20. STRUCTURED LISTING LOCATION
-- ============================================
-- Employers pick a location from a bundled US city autocomplete
-- (app/src/app/api/locations/route.ts) rather than free-typing it. The city,
-- state, lat and lng columns are defined inline on internship_listings above.
--
-- `location` is kept as the canonical "Raleigh, NC" display string: listing
-- cards, detail pages, and the student location filter (an ilike over
-- `location` in getActiveListings) all read it. Rows created before the picker
-- keep their free-text location with null city/state; the edit form flags
-- those and asks the employer to re-pick.

create index idx_listings_city_state on internship_listings(state, city);

-- Supports radius search ("internships near me") via a bounding-box prefilter.
-- A plain btree is sufficient here; no PostGIS needed.
create index idx_listings_latlng on internship_listings(lat, lng) where lat is not null;

-- ============================================
-- 21. VERIFICATION-GATED APPLICANT COUNT
-- ============================================
-- Pending employers see no applications at all (see the gate on the
-- applications select policy), which would leave them staring at an empty
-- page. This returns the bare count for the caller's own listings so the UI can
-- say "3 applications are already waiting" -- a far better prompt to finish
-- verification. security definer deliberately bypasses the gate; it returns a
-- single integer and leaks nothing about any individual applicant.

create or replace function employer_pending_applicant_count()
returns int
language sql
stable
security definer
set search_path = public
as $fn$
  select count(a.id)::int
  from applications a
  join internship_listings il on a.listing_id = il.id
  join employers e on il.employer_id = e.id
  where e.user_id = auth.uid();
$fn$;

revoke all on function employer_pending_applicant_count() from public;
grant execute on function employer_pending_applicant_count() to authenticated;
