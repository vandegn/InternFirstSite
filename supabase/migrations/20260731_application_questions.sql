-- Custom Application Questions
-- ============================================
-- Employers can attach free-text questions to a listing. When a student applies,
-- they must answer every question (answers cannot be blank). Answers are stored
-- per application with a snapshot of the question text so employers still see
-- what was asked even if the question is later edited or removed.

-- Questions attached to a listing, ordered by position.
create table listing_questions (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid references internship_listings(id) on delete cascade not null,
  question text not null,
  position int not null default 0,
  created_at timestamptz default now() not null
);

create index idx_listing_questions_listing on listing_questions(listing_id, position);

alter table listing_questions enable row level security;

-- Anyone authenticated can read questions (students need them at apply time).
create policy "Questions are viewable by authenticated users"
  on listing_questions for select to authenticated
  using (true);

-- Employers manage questions on their own listings.
create policy "Employers can manage own listing questions"
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

-- Student answers to a listing's questions, one row per (application, question).
create table application_answers (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  question_id uuid references listing_questions(id) on delete set null,
  question_text text not null,          -- snapshot of the question at answer time
  answer text not null check (length(btrim(answer)) > 0),
  created_at timestamptz default now() not null
);

create index idx_application_answers_application on application_answers(application_id);

alter table application_answers enable row level security;

-- Students can insert answers for their own applications.
create policy "Students can insert own answers"
  on application_answers for insert to authenticated
  with check (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

-- Students can read their own answers.
create policy "Students can view own answers"
  on application_answers for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join students s on a.student_id = s.id
      where s.user_id = auth.uid()
    )
  );

-- Employers can read answers submitted to their listings.
create policy "Employers can view answers to their listings"
  on application_answers for select to authenticated
  using (
    application_id in (
      select a.id from applications a
      join internship_listings il on a.listing_id = il.id
      join employers e on il.employer_id = e.id
      where e.user_id = auth.uid()
    )
  );
