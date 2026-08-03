-- ============================================
-- INTERVIEW AVAILABILITY HANDSHAKE
-- ============================================
-- The three-step negotiation that runs *before* an interview_schedules row
-- exists. Today the employer picks a time out of thin air and the student can
-- only accept/decline/ask-again. This adds the round trip:
--
--   1. Employer picks a date window on the pipeline board  -> 'requested'
--   2. A message lands in the student's inbox and they mark
--      the days + time frames that work                    -> 'awaiting_student'
--   3. Student submits, employer is notified, returns to the
--      board and picks one final time from what was offered -> 'awaiting_employer'
--   4. Confirming writes the real interview_schedules row    -> 'scheduled'
--
-- Two off-ramps:
--   'no_availability' — the student says nothing in the window works.
--   'cancelled'       — the employer withdraws, usually to re-request a
--                       different window when no proposed slot works.
--
-- The status column is the single source of truth for the pipeline chip, so
-- every transition is an explicit write. See lib/interview-availability.ts for
-- the mirrored state machine the app enforces before it ever reaches the DB.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).

-- ----- requests -----
create table if not exists interview_availability_requests (
  id uuid primary key default gen_random_uuid(),
  application_id uuid references applications(id) on delete cascade not null,
  employer_id uuid references employers(id) on delete cascade not null,
  student_id uuid references students(id) on delete cascade not null,
  listing_id uuid references internship_listings(id) on delete cascade not null,

  -- The interviewing window, as plain calendar dates. Deliberately not
  -- timestamps: "the week of the 10th" means the same thing in both parties'
  -- time zones, and the student's proposed slots carry the real instants.
  window_start date not null,
  window_end date not null,

  status text not null default 'requested' check (status in
    ('requested', 'awaiting_student', 'awaiting_employer', 'scheduled', 'no_availability', 'cancelled')),

  duration_minutes int not null default 30 check (duration_minutes > 0),
  employer_note text,
  student_note text,

  -- The student's IANA zone, captured when they submit. The employer's slot
  -- picker renders "9:00 AM your time / 6:00 AM theirs" from it so nobody
  -- proposes a 3am interview by accident.
  student_timezone text,

  -- The inbox message carrying the picker. Set once the message is written.
  message_id uuid references messages(id) on delete set null,
  -- The interview this ultimately produced, once the employer confirms.
  interview_id uuid references interview_schedules(id) on delete set null,

  requested_at timestamptz not null default now(),
  responded_at timestamptz,
  scheduled_at_confirmed timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint interview_availability_window_ordered check (window_end >= window_start)
);

-- One live negotiation per application. Re-requesting cancels the old row
-- first (see cancel route), so this also stops double-submits from the board.
create unique index if not exists interview_availability_one_live_per_application
  on interview_availability_requests (application_id)
  where status in ('requested', 'awaiting_student', 'awaiting_employer');

create index if not exists idx_availability_requests_employer
  on interview_availability_requests (employer_id, status);
create index if not exists idx_availability_requests_student
  on interview_availability_requests (student_id, status);
create index if not exists idx_availability_requests_application
  on interview_availability_requests (application_id);

drop trigger if exists set_interview_availability_updated_at on interview_availability_requests;
create trigger set_interview_availability_updated_at
  before update on interview_availability_requests
  for each row execute function update_updated_at();

-- ----- slots -----
-- One row per (day, time frame) the student marked as workable.
--
-- slot_date is the student's local calendar day and is what both sides read as
-- the label; starts_at/ends_at are the same frame as real instants, so the
-- employer's final pick can be validated by exact UTC containment with no
-- time-zone guessing on the server.
create table if not exists interview_availability_slots (
  id uuid primary key default gen_random_uuid(),
  request_id uuid references interview_availability_requests(id) on delete cascade not null,
  slot_date date not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  created_at timestamptz not null default now(),

  constraint interview_availability_slot_ordered check (ends_at > starts_at)
);

create index if not exists idx_availability_slots_request
  on interview_availability_slots (request_id, starts_at);

-- ----- messages carry the picker -----
-- Mirrors the existing nullable application_id FK: a message is still just a
-- message, but when this is set the inbox renders the availability picker
-- instead of a plain text bubble.
alter table messages
  add column if not exists availability_request_id uuid
  references interview_availability_requests(id) on delete cascade;

create index if not exists idx_messages_availability_request
  on messages (availability_request_id);

-- ============================================
-- RLS
-- ============================================
alter table interview_availability_requests enable row level security;
alter table interview_availability_slots enable row level security;

-- ----- requests -----
drop policy if exists "Employers view own availability requests" on interview_availability_requests;
create policy "Employers view own availability requests"
  on interview_availability_requests for select to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()));

drop policy if exists "Students view own availability requests" on interview_availability_requests;
create policy "Students view own availability requests"
  on interview_availability_requests for select to authenticated
  using (student_id in (select id from students where user_id = auth.uid()));

drop policy if exists "Employers create availability requests" on interview_availability_requests;
create policy "Employers create availability requests"
  on interview_availability_requests for insert to authenticated
  with check (employer_id in (select id from employers where user_id = auth.uid()));

-- Employers confirm a time, cancel, or re-request.
drop policy if exists "Employers update own availability requests" on interview_availability_requests;
create policy "Employers update own availability requests"
  on interview_availability_requests for update to authenticated
  using (employer_id in (select id from employers where user_id = auth.uid()))
  with check (employer_id in (select id from employers where user_id = auth.uid()));

-- Students move the row to awaiting_employer / no_availability when they
-- respond. The route re-checks the transition; this only bounds *whose* rows.
drop policy if exists "Students update own availability requests" on interview_availability_requests;
create policy "Students update own availability requests"
  on interview_availability_requests for update to authenticated
  using (student_id in (select id from students where user_id = auth.uid()))
  with check (student_id in (select id from students where user_id = auth.uid()));

-- ----- slots -----
drop policy if exists "Both parties view slots on their requests" on interview_availability_slots;
create policy "Both parties view slots on their requests"
  on interview_availability_slots for select to authenticated
  using (
    request_id in (
      select r.id from interview_availability_requests r
      where r.student_id in (select id from students where user_id = auth.uid())
         or r.employer_id in (select id from employers where user_id = auth.uid())
    )
  );

-- Only the student offers availability, and only on their own request.
drop policy if exists "Students insert slots on own requests" on interview_availability_slots;
create policy "Students insert slots on own requests"
  on interview_availability_slots for insert to authenticated
  with check (
    request_id in (
      select r.id from interview_availability_requests r
      where r.student_id in (select id from students where user_id = auth.uid())
    )
  );

-- Resubmitting clears the previous offer first.
drop policy if exists "Students delete slots on own requests" on interview_availability_slots;
create policy "Students delete slots on own requests"
  on interview_availability_slots for delete to authenticated
  using (
    request_id in (
      select r.id from interview_availability_requests r
      where r.student_id in (select id from students where user_id = auth.uid())
    )
  );

-- ============================================
-- PIPELINE SYNC
-- ============================================
-- Asking for times is the moment a candidate becomes an interview candidate,
-- so the board should move them the same way scheduling does. Reuses
-- move_application_to_stage_type from 20260801_pipeline_interview_sync.sql,
-- and applies the same guard: someone already at Offered or Rejected keeps
-- their stage rather than being walked backwards.
create or replace function sync_stage_on_availability_requested()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_current_type text;
begin
  select ps.stage_type into v_current_type
  from applications a
  left join pipeline_stages ps on ps.id = a.stage_id
  where a.id = new.application_id;

  if v_current_type is null or v_current_type in ('applied', 'reviewing') then
    perform move_application_to_stage_type(new.application_id, 'interviewing');
  end if;

  return new;
end;
$$;

drop trigger if exists trg_sync_stage_on_availability_requested on interview_availability_requests;
create trigger trg_sync_stage_on_availability_requested
  after insert on interview_availability_requests
  for each row execute function sync_stage_on_availability_requested();
