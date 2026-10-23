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
  -- Square company mark for job cards (see migrations/20261023_company_icon.sql).
  -- logo_url stays the full-size logo.
  icon_url text,
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
  archived_at timestamptz,             -- Archive/End Hiring (section 27); an archived posting is always closed
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null,
  constraint internship_listings_archived_is_closed check (archived_at is null or status = 'closed')
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
  -- Set when the posting was unarchived and this hiring cycle ended (section 27):
  -- the student keeps the record, the employer no longer sees it.
  detached_at timestamptz
);

-- One live application per student per posting; a detached one doesn't count,
-- so a student can apply again once an unarchived posting is reopened.
create unique index applications_one_attached_per_student_listing
  on applications(student_id, listing_id)
  where detached_at is null;

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
  -- How the interview happens: the InternFirst video room, the employer's own
  -- link (sent to the student in chat), or a phone screen.
  format text not null default 'internfirst'
    check (format in ('internfirst', 'external_link', 'phone')),
  meeting_url text,
  -- Screening or Interview, from the candidate's pipeline category when it was
  -- confirmed (migrations/20261009_employer_proposed_interview_slots.sql).
  meeting_type text not null default 'interview'
    check (meeting_type in ('screening', 'interview')),
  -- The teammate who owns the meeting; drives the employer's Upcoming
  -- Interviews page.
  organizer_user_id uuid references profiles(user_id) on delete set null,
  cancelled_by text check (cancelled_by in ('employer', 'student')),
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_schedules_meeting_url_check
    check (format <> 'external_link' or (meeting_url is not null and meeting_url ~* '^https?://'))
);

-- Only one active interview per application at a time
create unique index interview_schedules_one_active_per_application
  on interview_schedules (application_id)
  where status not in ('declined', 'cancelled', 'completed');

create index idx_interview_schedules_employer on interview_schedules (employer_id, scheduled_at);
create index idx_interview_schedules_student on interview_schedules (student_id, scheduled_at);
create index idx_interview_schedules_status on interview_schedules (status);
create index idx_interview_schedules_organizer on interview_schedules (organizer_user_id, scheduled_at);

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
-- answer_options for multi_select, storage_path for file uploads (an object
-- key in the private `applicant-docs` bucket, served via /api/files).
-- file_url is legacy (old public-bucket URLs) and no longer written.
create table application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  question_id uuid references listing_questions(id) on delete cascade not null,
  answer_text text,
  answer_options text[] not null default '{}',
  file_url text,
  storage_path text,
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

-- ============================================
-- 22. PRIVATE APPLICANT DOCS (storage)
-- ============================================
-- Resumes (student_resumes.storage_path) and application file-answers
-- (application_answers.storage_path) live in the PRIVATE `applicant-docs`
-- bucket, created by app/scripts/private-docs-setup.mjs. Reads go through
-- GET /api/files/[kind]/[id], which authorizes via the table RLS above and
-- then redirects to a 60-second service-role signed URL. There is
-- deliberately no storage SELECT policy — the bucket is not directly
-- readable. student_resumes (defined in migrations/add_student_resumes.sql)
-- also gained storage_path, and its file_url dropped NOT NULL.

create policy "Students upload own applicant docs"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'applicant-docs'
    and (storage.foldername(name))[1] in ('resumes', 'application-files')
    and (storage.foldername(name))[2] in (
      select id::text from students where user_id = auth.uid()
    )
  );

-- ============================================
-- 23. POLICY ACCEPTANCES
-- ============================================
-- Durable record of who accepted which version of the Terms & Conditions and
-- Privacy Policy (content in app/src/lib/policies). Written by /auth/callback
-- (service role) from versions stamped into user_metadata at registration.
-- accepted_at is the client's claim; recorded_at is server time. Append-only:
-- a version bump produces a second row, never an overwrite.

create table policy_acceptances (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null check (role in ('student', 'employer')),
  terms_version text not null,
  privacy_version text not null,
  accepted_at timestamptz not null,
  recorded_at timestamptz default now() not null,
  unique (user_id, role, terms_version, privacy_version)
);

create index idx_policy_acceptances_user on policy_acceptances(user_id);

alter table policy_acceptances enable row level security;

-- Only the service-role callback writes; users may read their own history.
create policy "Users read own policy acceptances"
  on policy_acceptances for select to authenticated
  using (user_id = auth.uid());

-- ============================================
-- 24. STUDENT CERTIFICATIONS
-- ============================================
-- Credentials a student proves with a document — Six Sigma belts, OSHA 30, CPR,
-- a cloud cert. One row per uploaded PDF, many per student. The certification
-- number lives beside the file because that is what an employer checks against
-- the issuer's registry; it is nullable so an unnumbered credential can still
-- be uploaded. See supabase/migrations/20260803_student_certifications.sql for
-- the RLS.
--
-- The PDF is applicant PII of the same class as a resume, so it lives in the
-- private `applicant-docs` bucket under certifications/<studentId>/ and is read
-- only through GET /api/files/certification/[id] (section 22). file_url is
-- legacy — nullable, and unset on anything uploaded after
-- 20260803_certifications_private_docs.sql.

create table student_certifications (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade not null,
  name text not null,
  certification_number text,
  storage_path text,
  file_url text,
  uploaded_at timestamptz default now() not null
);

create index idx_student_certifications_student on student_certifications(student_id);

-- ============================================
-- 25. OFFERS
-- ============================================
-- The record behind an "Offered" pipeline column. Created only by the board's
-- two-step confirmation (move dialog, then ExtendOfferModal), never by a bare
-- stage change, because it tells a student they got the job.
--
-- Shaped like interview_schedules, the platform's other two-sided commitment:
-- a status the student moves, notifications both ways, and a partial unique
-- index keeping one live offer per application. The optional letter is a PDF in
-- the private `applicant-docs` bucket under offer-letters/<applicationId>/,
-- read only through GET /api/files/offer/[id] (section 22).
--
-- See supabase/migrations/20260803_offers.sql for the RLS and the storage
-- INSERT policy that lets employers write the letter.

create table offers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  status text not null default 'extended'
    check (status in ('extended', 'accepted', 'declined', 'withdrawn')),
  storage_path text,
  note text,
  extended_at timestamptz default now() not null,
  responded_at timestamptz
);

create index idx_offers_application on offers(application_id);
create index idx_offers_student on offers(student_id, status);
create index idx_offers_employer on offers(employer_id, status);

-- Withdrawn and declined rows stay as history, so an employer who withdraws
-- can extend a fresh offer.
create unique index idx_offers_one_live
  on offers(application_id)
  where status in ('extended', 'accepted');

-- ============================================
-- 26. INTERVIEW SCHEDULING HANDSHAKE
-- ============================================
-- End state of migrations/20260802_interview_availability.sql +
-- 20261009_employer_proposed_interview_slots.sql (see those files for RLS).
--
--   1. The employer proposes exact meeting-length slots in a date window
--      ('awaiting_student')
--   2. The student selects one — tentative ('awaiting_employer')
--   3. The employer confirms it, writing or moving the interview_schedules
--      row ('scheduled')
--   Off-ramps: 'no_availability' (none of the slots work), 'cancelled'
--   (employer withdrew to re-request).
--
-- Scheduling is offered only for candidates whose pipeline column has
-- stage_type 'screening' or 'interviewing' (pipeline_stages.stage_type allows
-- 'applied', 'reviewing', 'screening', 'interviewing', 'offered', 'rejected';
-- see migrations/2026-06-24-pipeline-stages.sql and 20261009).

create table interview_availability_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,
  window_start date not null,
  window_end date not null,
  status text not null default 'requested' check (status in
    ('requested', 'awaiting_student', 'awaiting_employer', 'scheduled', 'no_availability', 'cancelled')),
  duration_minutes int not null default 30 check (duration_minutes > 0),
  meeting_type text not null default 'interview' check (meeting_type in ('screening', 'interview')),
  employer_note text,
  student_note text,
  employer_timezone text,
  student_timezone text,
  requested_by uuid references profiles(user_id) on delete set null,
  -- The slot the student picked; not an FK (a second requests<->slots FK makes
  -- PostgREST embeds ambiguous). Validated by the API.
  selected_slot_id uuid,
  selected_at timestamptz,
  message_id uuid references messages(id) on delete set null,
  interview_id uuid references interview_schedules(id) on delete set null,
  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  scheduled_at_confirmed timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint interview_availability_window_ordered check (window_end >= window_start),
  constraint interview_availability_selection_state
    check (selected_slot_id is null or status in ('awaiting_employer', 'scheduled', 'cancelled'))
);

create unique index interview_availability_one_live_per_application
  on interview_availability_requests (application_id)
  where status in ('requested', 'awaiting_student', 'awaiting_employer');

-- One row per meeting-length slot the employer offered.
create table interview_availability_slots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references interview_availability_requests(id) on delete cascade not null,
  slot_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint interview_availability_slot_ordered check (ends_at > starts_at)
);

create index idx_availability_slots_request on interview_availability_slots (request_id, starts_at);

alter table messages add column availability_request_id uuid
  references interview_availability_requests(id) on delete cascade;


-- Product analytics (keep synchronized with migrations/20260916_product_analytics.sql)
-- First-party analytics. Apply before deploying the accompanying application.
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name in ('listing_viewed','cta_clicked','registration_started','registration_completed','application_started','application_completed','job_posting_started','job_published')),
  role text not null check (role in ('student','employer','anonymous')),
  session_id uuid,
  flow_key text not null,
  path text,
  cta text check (cta in ('register','apply','post_job','browse_internships','waitlist')),
  listing_id uuid, -- no FK: aggregate history survives listing deletion
  created_at timestamptz not null default now(),
  unique(name, flow_key)
);
create index product_events_date_role on public.product_events(created_at, role);
create index product_events_session_date on public.product_events(session_id, created_at);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant select on public.product_events to authenticated;
create policy "Admins read product analytics" on public.product_events for select to authenticated
using (public.is_intern_first_admin(auth.uid()));
alter table public.internship_listings add column analytics_flow_id uuid;

-- Only the validated server endpoint can call this. Serialize each session's
-- writes so concurrent requests cannot bypass the 120 events/minute budget.
create function public.record_product_event(p_id uuid, p_name text, p_role text, p_session uuid, p_flow text, p_path text, p_cta text, p_listing uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_name not in ('listing_viewed','cta_clicked','registration_started','application_started','job_posting_started') then
    raise exception 'Invalid client event';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session::text, 0));
  if (select count(*) from product_events where session_id = p_session and created_at > now() - interval '1 minute') >= 120 then return false; end if;
  insert into product_events(id,name,role,session_id,flow_key,path,cta,listing_id)
  values(p_id,p_name,p_role,p_session,p_flow,p_path,p_cta,p_listing) on conflict do nothing;
  return true;
end $$;
revoke all on function public.record_product_event(uuid,text,text,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_product_event(uuid,text,text,uuid,text,text,text,uuid) to service_role;

create function public.capture_product_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare flow text; actor uuid;
begin
  if tg_table_name = 'profiles' then
    if new.role not in ('student','employer') then return new; end if;
    select raw_user_meta_data->>'analyticsFlowId' into flow from auth.users where id = new.user_id;
    if flow is null or flow !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then flow := new.user_id::text; end if;
    insert into product_events(name,role,flow_key) values('registration_completed',new.role,flow || ':' || new.role) on conflict do nothing;
  elsif tg_table_name = 'applications' then
    select user_id into actor from students where id = new.student_id;
    insert into product_events(name,role,flow_key,listing_id) values('application_completed','student',actor::text || ':' || new.listing_id::text,new.listing_id) on conflict do nothing;
  elsif tg_table_name = 'internship_listings' then
    if new.status is distinct from 'active' then return new; end if;
    if tg_op = 'UPDATE' then
      if old.status = 'active' then return new; end if;
    end if;
    -- Link draft/scheduled publication back to the original form, including
    -- publication by another teammate or the scheduled publishing job.
    flow := coalesce(new.analytics_flow_id::text, new.id::text);
    -- One first publication per listing; pausing/reactivating isn't a new job.
    if not exists (select 1 from product_events where name = 'job_published' and listing_id = new.id) then
      insert into product_events(name,role,flow_key,listing_id) values('job_published','employer',flow,new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.capture_product_completion() from public, anon, authenticated;
create trigger analytics_registration after insert on public.profiles for each row execute function public.capture_product_completion();
create trigger analytics_application after insert on public.applications for each row execute function public.capture_product_completion();
create trigger analytics_publication after insert or update of status on public.internship_listings for each row execute function public.capture_product_completion();

create function public.admin_product_analytics(p_start timestamptz, p_end timestamptz, p_role text default 'all')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_intern_first_admin(auth.uid()) then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end - p_start > interval '367 days' or p_role is null or p_role not in ('all','student','employer','anonymous') then raise exception 'Invalid filters'; end if;
  with filtered as (
    select * from product_events where created_at >= p_start and created_at < p_end and (p_role = 'all' or role = p_role)
  ), counts as (
    select name, role, count(*) as count from filtered group by name, role
  ), daily as (
    select to_char(created_at at time zone 'UTC','YYYY-MM-DD') as day,name,count(*) as count from filtered group by 1,2 order by 1,2
  ), ctas as (
    select cta,path,count(*) as count from filtered where name = 'cta_clicked' group by cta,path order by count(*) desc
  ), funnels as (
    select s.name,s.role,count(*) as started,
      count(*) filter (where exists (
        select 1 from product_events c where c.flow_key = s.flow_key and c.role = s.role
        and c.name = case s.name when 'registration_started' then 'registration_completed' when 'application_started' then 'application_completed' else 'job_published' end
        and c.created_at < p_end
      )) as completed
    from filtered s where s.name in ('registration_started','application_started','job_posting_started') group by s.name,s.role
  ) select jsonb_build_object(
    'events',coalesce((select jsonb_agg(counts) from counts),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(daily) from daily),'[]'::jsonb),
    'ctas',coalesce((select jsonb_agg(ctas) from ctas),'[]'::jsonb),
    'funnels',coalesce((select jsonb_agg(funnels) from funnels),'[]'::jsonb),
    'totals',jsonb_build_object(
      'registrations',(select count(*) from profiles where role in ('student','employer') and created_at >= p_start and created_at < p_end and (p_role = 'all' or role = p_role)),
      'applications',(select count(*) from applications where applied_at >= p_start and applied_at < p_end and p_role in ('all','student')),
      'listings',(select count(*) from internship_listings where created_at >= p_start and created_at < p_end and p_role in ('all','employer')),
      'uniqueListingViews',(select count(*) from listing_views where viewed_at >= p_start and viewed_at < p_end and p_role in ('all','student')),
      'waitlist',(select count(*) from waitlist where created_at >= p_start and created_at < p_end and (p_role = 'all' or role = p_role))
    )
  ) into result;
  return result;
end $$;
revoke all on function public.admin_product_analytics(timestamptz,timestamptz,text) from public, anon;
grant execute on function public.admin_product_analytics(timestamptz,timestamptz,text) to authenticated;

-- ============================================
-- 26. STUDENT APPLICATION ARCHIVE
-- ============================================
-- The student's private filing for My Applications (Open / Rejected / Archive
-- tabs). Archive = insert, restore = delete. Kept off the applications row so
-- students never get UPDATE on applications: archiving can't touch hiring
-- status, employers keep updating archived applications, and employers can't
-- see the archive. See migrations/20261009_student_application_archive.sql.
create table student_application_archives (
  application_id uuid primary key references applications(id) on delete cascade,
  student_id uuid not null references students(id) on delete cascade,
  archived_at timestamptz not null default now()
);

create index idx_student_application_archives_student
  on student_application_archives(student_id);

alter table student_application_archives enable row level security;

create policy "Students view own application archives"
  on student_application_archives for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

create policy "Students archive own applications"
  on student_application_archives for insert to authenticated
  with check (
    exists (
      select 1
      from applications a
      join students s on s.id = a.student_id
      where a.id = student_application_archives.application_id
        and a.student_id = student_application_archives.student_id
        and s.user_id = auth.uid()
    )
  );

create policy "Students restore own applications"
  on student_application_archives for delete to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

-- ============================================
-- 27. ARCHIVE A POSTING / END HIRING, UNARCHIVE AS CLOSED
-- ============================================
-- Posted Jobs' Archive/End Hiring and Unarchive, each one transaction. Archive
-- closes the posting, moves every attached applicant outside Offered to the
-- Rejected column and refuses new applications; unarchive returns it closed and
-- detaches its applications from the employer (students keep theirs). Employer
-- RLS ignores detached applications. Keep synchronized with
-- migrations/20261009_listing_archive_end_hiring.sql.

create index idx_listings_archived on internship_listings(employer_id) where archived_at is not null;
create index idx_applications_listing_attached on applications(listing_id) where detached_at is null;

-- ============================================
-- 27.3 Helpers
-- ============================================
-- security definer so it answers the same way inside any table's policy,
-- whatever the caller can see of applications.
create or replace function application_is_attached(p_application_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from applications
    where id = p_application_id and detached_at is null
  );
$$;

-- Who may archive / unarchive a posting: an active member of an approved
-- company whose role carries manage_listings (ROLE_CAPABILITIES in
-- lib/employer-team.ts: master_admin, recruiting_lead).
create or replace function can_manage_employer_listings(uid uuid, emp uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from employer_members m
    join employers e on e.id = m.employer_id
    where m.user_id = uid
      and m.employer_id = emp
      and m.status = 'active'
      and m.role in ('master_admin', 'recruiting_lead')
      and e.verification_status = 'approved'
  );
$$;

-- The canonical bucket of an application, mirroring applicationStageType() /
-- planEndHiring() in the app: the stage's stage_type, else the legacy status.
create or replace function application_stage_type(p_stage_type text, p_status text)
returns text
language sql immutable as $$
  select coalesce(
    p_stage_type,
    case
      when lower(regexp_replace(coalesce(p_status, ''), '[\s-]+', '_', 'g'))
           in ('offered', 'offer_extended') then 'offered'
      when lower(regexp_replace(coalesce(p_status, ''), '[\s-]+', '_', 'g'))
           in ('rejected', 'closed', 'not_selected', 'rejected/closed') then 'rejected'
      else 'applied'
    end
  );
$$;

-- ============================================
-- 27.4 Guards: archived postings take no new applications or moves
-- ============================================
-- Writes can only change archived_at / detached_at through the RPCs below,
-- which set this transaction-local flag.
create or replace function guard_listing_archive_columns()
returns trigger
language plpgsql as $$
begin
  if new.archived_at is distinct from old.archived_at
     and coalesce(current_setting('app.listing_archive_rpc', true), '') <> 'on' then
    raise exception 'Use Archive/End Hiring or Unarchive to change a posting''s archive state.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_listing_archive_columns on internship_listings;
create trigger trg_guard_listing_archive_columns
  before update of archived_at on internship_listings
  for each row execute function guard_listing_archive_columns();

-- Before insert: an archived posting accepts no applications. FOR SHARE waits
-- for an in-flight archive (which holds the listing FOR UPDATE) to commit, then
-- re-reads it, so an application racing the archive is refused rather than
-- slipping in un-rejected.
-- Before update of stage_id: nobody moves an attached candidate on an archived
-- posting (the RPC moves them before it sets archived_at). Detaching, or a
-- stage delete nulling stage_id, is allowed.
create or replace function guard_application_on_archived_listing()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_archived timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.stage_id is not distinct from old.stage_id or new.stage_id is null
       or new.detached_at is not null then
      return new;
    end if;
  end if;

  select archived_at into v_archived
  from internship_listings
  where id = new.listing_id
  for share;

  if v_archived is not null then
    if tg_op = 'INSERT' then
      raise exception 'This posting has been archived and is no longer accepting applications.'
        using errcode = 'P0001';
    else
      raise exception 'Hiring has ended for this posting, so candidates can''t be moved.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_archived_listing_application on applications;
create trigger trg_block_archived_listing_application
  before insert or update of stage_id on applications
  for each row execute function guard_application_on_archived_listing();

-- Employers can't set or clear detached_at by hand: their update policy below
-- only admits attached rows and only leaves them attached.

-- ============================================
-- 27.5 Employer RLS ignores detached applications
-- ============================================
drop policy if exists "Employers can view applications to their listings" on applications;
create policy "Employers can view applications to their listings"
  on applications for select to authenticated
  using (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can update application status" on applications;
create policy "Employers can update application status"
  on applications for update to authenticated
  using (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can delete applications to their listings" on applications;
create policy "Employers can delete applications to their listings"
  on applications for delete to authenticated
  using (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- Offers: keyed on listing, so they need the explicit check.
drop policy if exists "Employers manage offers on own listings" on offers;
create policy "Employers manage offers on own listings"
  on offers for all to authenticated
  using (
    is_approved_employer(auth.uid())
    and application_is_attached(application_id)
    and listing_id in (
      select il.id from internship_listings il
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    is_approved_employer(auth.uid())
    and application_is_attached(application_id)
    and listing_id in (
      select il.id from internship_listings il
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- Interviews and availability requests: keyed on employer_id.
drop policy if exists "Employers can view own interviews" on interview_schedules;
create policy "Employers can view own interviews"
  on interview_schedules for select to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  );

drop policy if exists "Employers can update own interviews" on interview_schedules;
create policy "Employers can update own interviews"
  on interview_schedules for update to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  );

drop policy if exists "Employers view own availability requests" on interview_availability_requests;
create policy "Employers view own availability requests"
  on interview_availability_requests for select to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  );

drop policy if exists "Employers update own availability requests" on interview_availability_requests;
create policy "Employers update own availability requests"
  on interview_availability_requests for update to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  )
  with check (employer_id in (select acting_employer_ids(auth.uid())));

-- Pending-employer teaser count: attached applications only.
create or replace function employer_pending_applicant_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(a.id)::int
  from applications a
  join internship_listings il on a.listing_id = il.id
  join employer_members m on il.employer_id = m.employer_id
  where m.user_id = auth.uid() and m.status = 'active'
    and a.detached_at is null;
$$;

-- ============================================
-- 27.6 archive_listing_and_end_hiring
-- ============================================
create or replace function archive_listing_and_end_hiring(p_listing_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_listing internship_listings%rowtype;
  v_reject_stage pipeline_stages%rowtype;
  v_rejected_ids uuid[];
  v_kept_offered int;
  v_already_rejected int;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  -- Lock the posting first: concurrent applications (guard trigger, FOR SHARE)
  -- and a second archive click both queue behind this.
  select * into v_listing from internship_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Posting not found.' using errcode = 'P0002';
  end if;

  if not can_manage_employer_listings(v_uid, v_listing.employer_id) then
    raise exception 'You don''t have permission to archive this posting.' using errcode = '42501';
  end if;

  -- A retried request after success is a no-op, not an error.
  if v_listing.archived_at is not null then
    return jsonb_build_object(
      'listing_id', p_listing_id, 'archived_at', v_listing.archived_at,
      'already_archived', true, 'rejected', 0, 'kept_offered', 0, 'already_rejected', 0
    );
  end if;

  -- Lock every attached application so no stage change lands mid-way.
  perform 1 from applications
  where listing_id = p_listing_id and detached_at is null
  for update;

  -- The posting's rejection column, or a new one from the "Rejected" preset
  -- (PIPELINE_STAGE_PRESETS), placed after every existing column.
  select * into v_reject_stage
  from pipeline_stages
  where listing_id = p_listing_id and stage_type = 'rejected'
  order by position
  limit 1;

  if not found then
    insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
    values (
      p_listing_id, 'Rejected', 'var(--danger-bg-strong)', 'var(--danger-fg)',
      coalesce((select max(position) from pipeline_stages where listing_id = p_listing_id), 0) + 1,
      'rejected', false
    )
    returning * into v_reject_stage;
  end if;

  select
    count(*) filter (where application_stage_type(ps.stage_type, a.status) = 'offered'),
    count(*) filter (where application_stage_type(ps.stage_type, a.status) = 'rejected')
  into v_kept_offered, v_already_rejected
  from applications a
  left join pipeline_stages ps on ps.id = a.stage_id
  where a.listing_id = p_listing_id and a.detached_at is null;


  -- Everyone not Offered and not already rejected -> Rejected.
  -- trg_sync_application_status mirrors the stage label into status.
  with targets as (
    select a.id
    from applications a
    left join pipeline_stages ps on ps.id = a.stage_id
    where a.listing_id = p_listing_id
      and a.detached_at is null
      and application_stage_type(ps.stage_type, a.status) not in ('offered', 'rejected')
  ),
  moved as (
    update applications a
       set stage_id = v_reject_stage.id
      from targets t
     where a.id = t.id
    returning a.id
  )
  select coalesce(array_agg(id), '{}') into v_rejected_ids from moved;

  -- Nothing keeps hiring after hiring ended: cancel upcoming interviews and
  -- open availability requests for the rejected, and withdraw any offer they
  -- hadn't answered (e.g. a candidate dragged out of Offered with one live).
  update interview_schedules
     set status = 'cancelled', cancelled_by = 'employer', cancelled_at = now()
   where application_id = any(v_rejected_ids)
     and status in ('pending', 'accepted', 'reschedule_requested')
     and scheduled_at > now();

  update interview_availability_requests
     set status = 'cancelled'
   where application_id = any(v_rejected_ids)
     and status in ('requested', 'awaiting_student', 'awaiting_employer');

  update offers
     set status = 'withdrawn'
   where application_id = any(v_rejected_ids)
     and status = 'extended';

  -- The same bell entry a manual move to Rejected sends
  -- (updateApplicationStage in lib/supabase.ts).
  insert into notifications (user_id, actor_id, type, title, body, link)
  select s.user_id, v_uid, 'application_status',
         'Application update: ' || v_reject_stage.label,
         'Your application for "' || v_listing.title || '" is now ' || v_reject_stage.label || '.',
         '/dashboard/student/applications'
  from applications a
  join students s on s.id = a.student_id
  where a.id = any(v_rejected_ids);

  -- Close and archive last: the guard trigger refuses stage moves on an
  -- archived posting, and the moves above had to land first.
  perform set_config('app.listing_archive_rpc', 'on', true);
  update internship_listings
     set status = 'closed', archived_at = now(), publish_at = null
   where id = p_listing_id
  returning * into v_listing;
  perform set_config('app.listing_archive_rpc', 'off', true);

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'archived_at', v_listing.archived_at,
    'already_archived', false,
    'rejected', coalesce(array_length(v_rejected_ids, 1), 0),
    'kept_offered', v_kept_offered,
    'already_rejected', v_already_rejected
  );
end;
$$;

revoke all on function archive_listing_and_end_hiring(uuid) from public, anon;
grant execute on function archive_listing_and_end_hiring(uuid) to authenticated;

-- ============================================
-- 27.7 unarchive_listing
-- ============================================
create or replace function unarchive_listing(p_listing_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_listing internship_listings%rowtype;
  v_detached int;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select * into v_listing from internship_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Posting not found.' using errcode = 'P0002';
  end if;

  if not can_manage_employer_listings(v_uid, v_listing.employer_id) then
    raise exception 'You don''t have permission to unarchive this posting.' using errcode = '42501';
  end if;

  if v_listing.archived_at is null then
    return jsonb_build_object(
      'listing_id', p_listing_id, 'status', v_listing.status,
      'already_unarchived', true, 'detached', 0
    );
  end if;

  -- Upcoming interviews / open availability requests on candidates who are
  -- about to vanish from the employer's view would otherwise dangle for the
  -- student with nobody on the other side.
  update interview_schedules
     set status = 'cancelled', cancelled_by = 'employer', cancelled_at = now()
   where listing_id = p_listing_id
     and application_is_attached(application_id)
     and status in ('pending', 'accepted', 'reschedule_requested')
     and scheduled_at > now();

  update interview_availability_requests
     set status = 'cancelled'
   where listing_id = p_listing_id
     and application_is_attached(application_id)
     and status in ('requested', 'awaiting_student', 'awaiting_employer');

  -- End the hiring cycle: the students keep their applications (and final
  -- statuses); the employer stops seeing them, and a reopened posting starts
  -- clean.
  with detached as (
    update applications
       set detached_at = now()
     where listing_id = p_listing_id and detached_at is null
    returning id
  )
  select count(*) into v_detached from detached;

  perform set_config('app.listing_archive_rpc', 'on', true);
  update internship_listings
     set archived_at = null, status = 'closed', applicant_count = 0
   where id = p_listing_id
  returning * into v_listing;
  perform set_config('app.listing_archive_rpc', 'off', true);

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'status', v_listing.status,
    'already_unarchived', false,
    'detached', v_detached
  );
end;
$$;

revoke all on function unarchive_listing(uuid) from public, anon;
grant execute on function unarchive_listing(uuid) to authenticated;

-- ============================================
-- CAREER EVENTS (mirrors migrations/20261009_career_events.sql;
-- hourly cron in migrations/20261009_career_events_cron.sql)
-- ============================================

-- ============================================
-- CAREER EVENTS — auto-updating campus + local events calendar
-- ============================================
-- Students see career events from their own campus and from their school's
-- state, plus online events open to everyone. Events arrive two ways:
--
--   * iCal feeds registered by an admin in `event_sources` (Localist, Presence,
--     CampusGroups, Engage and most campus calendars publish .ics). The sync
--     route /api/career-events/sync pulls every active feed and upserts by
--     (source_id, external_id), so re-running it is idempotent.
--   * Manual entry by an admin on /dashboard/admin/events.
--
-- Location model: schools in us-schools.json carry a state but no city or
-- coordinates, so "around the student" means the school's state. A source is
-- tagged either to one school (campus events) or to a city/state region (local
-- events); its events inherit that tag.
--
-- Notifications (favorite reminders ~24h out, new major events) are written by
-- the same sync/cron path with the service role. `career_event_notifications`
-- is the dedupe ledger: one row per (user, event, kind), so nobody is notified
-- twice no matter how often the cron runs.
--
-- Run this in the Supabase SQL Editor. Then (optionally) schedule the hourly
-- sync with 20261009_career_events_cron.sql.

-- ----- Sources: registered iCal feeds -----
create table if not exists event_sources (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) > 0),
  ical_url text not null check (ical_url ~* '^https?://'),
  -- Campus feed: tagged to one school (same ids as students.school_id).
  school_id integer,
  school_name text,
  -- Region feed (or the campus's state): full state name, like students.school_state.
  city text,
  state text,
  default_category text not null default 'other'
    check (default_category in ('career_fair', 'info_session', 'workshop', 'networking', 'employer_event', 'other')),
  -- IANA zone used for "floating" iCal times that carry no TZID or Z suffix.
  default_timezone text not null default 'America/New_York',
  -- Optional allow-list: when set, only events whose title/description/
  -- categories contain one of these words are imported. Lets a general campus
  -- feed be narrowed to career events ({career, internship, employer, ...}).
  include_keywords text[],
  is_active boolean not null default true,
  last_synced_at timestamptz,
  last_error text,
  last_event_count integer,
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  unique (ical_url),
  -- A source must say where its events are, or nobody would ever see them.
  check (school_id is not null or state is not null)
);

-- ----- Events -----
create table if not exists career_events (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references event_sources(id) on delete cascade,
  -- UID (+ RECURRENCE-ID) from the feed; null for manual events.
  external_id text,
  origin text not null default 'manual' check (origin in ('ical', 'manual')),
  title text not null check (length(trim(title)) > 0),
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  all_day boolean not null default false,
  timezone text,
  location text,
  virtual_url text,
  url text,
  organizer text,
  category text not null default 'other'
    check (category in ('career_fair', 'info_session', 'workshop', 'networking', 'employer_event', 'other')),
  -- Where the event is relevant. school_id set = campus event for that school;
  -- school_id null + state set = local event; both null = online/national.
  school_id integer,
  school_name text,
  city text,
  state text,
  latitude double precision,
  longitude double precision,
  is_major boolean not null default false,
  -- When is_major last flipped to true; the "new major event" notification
  -- window keys off this, so promoting an old event still notifies.
  major_marked_at timestamptz,
  status text not null default 'active' check (status in ('active', 'cancelled')),
  created_by uuid references profiles(user_id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source_id, external_id),
  check (ends_at is null or ends_at >= starts_at)
);

create index if not exists idx_career_events_starts on career_events(starts_at) where status = 'active';
create index if not exists idx_career_events_school on career_events(school_id, starts_at);
create index if not exists idx_career_events_state on career_events(state, starts_at);
create index if not exists idx_career_events_major on career_events(major_marked_at) where is_major;

create or replace function career_events_touch()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  -- Career fairs from feeds start out major. INSERT only: on an upsert that
  -- hits an existing row, is_major isn't in the update set, so an admin who
  -- un-flags a fair keeps it un-flagged across re-syncs.
  if tg_op = 'INSERT' and new.origin = 'ical' and new.category = 'career_fair' then
    new.is_major := true;
  end if;
  if new.is_major and (tg_op = 'INSERT' or not coalesce(old.is_major, false)) then
    new.major_marked_at := now();
  elsif not new.is_major then
    new.major_marked_at := null;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_career_events_touch on career_events;
create trigger trg_career_events_touch
  before insert or update on career_events
  for each row execute function career_events_touch();

-- ----- Favorites -----
create table if not exists student_event_favorites (
  user_id uuid not null references profiles(user_id) on delete cascade,
  event_id uuid not null references career_events(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, event_id)
);

create index if not exists idx_event_favorites_event on student_event_favorites(event_id);

-- ----- Per-student notification switches -----
-- Missing row = both on. Lives here rather than on students because the
-- settings page's notification toggles are not persisted yet.
create table if not exists career_event_preferences (
  user_id uuid primary key references profiles(user_id) on delete cascade,
  notify_favorites boolean not null default true,
  notify_major boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ----- Notification dedupe ledger (service role only) -----
create table if not exists career_event_notifications (
  user_id uuid not null references profiles(user_id) on delete cascade,
  event_id uuid not null references career_events(id) on delete cascade,
  kind text not null check (kind in ('reminder', 'major')),
  created_at timestamptz not null default now(),
  primary key (user_id, event_id, kind)
);

-- ----- The bell needs a name for this -----
alter table notifications drop constraint if exists notifications_type_check;
alter table notifications add constraint notifications_type_check
  check (type in ('message', 'application_status', 'new_application', 'interview', 'offer', 'career_event'));

-- ============================================
-- RLS
-- ============================================
alter table event_sources enable row level security;
alter table career_events enable row level security;
alter table student_event_favorites enable row level security;
alter table career_event_preferences enable row level security;
alter table career_event_notifications enable row level security;

-- Sources: admin only (feed URLs and sync errors are operational detail).
create policy "Admins manage event sources"
  on event_sources for all to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'))
  with check (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'));

-- Events: students read them (relevance is filtered in the app — these are
-- public campus/community events, not private data); admins manage them.
create policy "Students read career events"
  on career_events for select to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'student'));

create policy "Admins manage career events"
  on career_events for all to authenticated
  using (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'))
  with check (exists (select 1 from profiles where profiles.user_id = auth.uid() and profiles.role = 'intern_first_admin'));

-- Favorites: each student manages only their own.
create policy "Users read own event favorites"
  on student_event_favorites for select to authenticated
  using (user_id = auth.uid());
create policy "Users add own event favorites"
  on student_event_favorites for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users remove own event favorites"
  on student_event_favorites for delete to authenticated
  using (user_id = auth.uid());

-- Preferences: own row only.
create policy "Users read own event preferences"
  on career_event_preferences for select to authenticated
  using (user_id = auth.uid());
create policy "Users insert own event preferences"
  on career_event_preferences for insert to authenticated
  with check (user_id = auth.uid());
create policy "Users update own event preferences"
  on career_event_preferences for update to authenticated
  using (user_id = auth.uid());

-- Ledger: no policies — only the service role (sync route) touches it.

comment on table career_events is
  'Career events shown on /dashboard/student/events. Synced from event_sources iCal feeds or entered on /dashboard/admin/events.';
comment on table event_sources is
  'Registered iCal feeds pulled by /api/career-events/sync. Tagged to a school (campus) or a city/state (local).';
