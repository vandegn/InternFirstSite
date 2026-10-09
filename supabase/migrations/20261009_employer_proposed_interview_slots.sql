-- ============================================
-- EMPLOYER-PROPOSED INTERVIEW SLOTS
-- ============================================
-- Inverts the availability handshake from 20260802_interview_availability.sql.
-- It used to be: employer picks a window -> student marks broad frames
-- (Morning / Afternoon / Evening) -> employer picks a final time. Now:
--
--   1. The employer picks a meeting length, a date window, and the exact
--      meeting-length slots they're free for              -> 'awaiting_student'
--   2. The student selects one slot (tentative)            -> 'awaiting_employer'
--   3. The employer confirms it ("Confirm Screening" /
--      "Confirm Interview"), which writes or moves the
--      interview_schedules row                             -> 'scheduled'
--
-- The status values and the one-live-request partial unique index are
-- unchanged; only who writes the slots, and what the student's answer is,
-- changes. Also adds:
--   * a 'screening' pipeline stage_type, so Screening vs Interview is a real
--     category rather than a label guess;
--   * meeting_type / organizer_user_id on interview_schedules, so both
--     Upcoming Interviews pages can show "Screening" vs "Interview" and the
--     employer's page lists only the meetings that teammate owns.
--
-- Requires 20260803_employer_team.sql (acting_employer_ids) and
-- 20261008_interview_format.sql. Safe to re-run.
--
-- Until this is applied the app keeps working, but Request Time returns
-- "Interview scheduling needs the 20261009 migration" and "Phone Screening"
-- columns are recognized as Screening by their label.

-- ----- 1. 'screening' stage_type -----
alter table pipeline_stages drop constraint if exists pipeline_stages_stage_type_check;
alter table pipeline_stages
  add constraint pipeline_stages_stage_type_check
  check (stage_type in ('applied', 'reviewing', 'screening', 'interviewing', 'offered', 'rejected'));

-- Columns created from the "Phone Screening" preset were bucketed as
-- 'reviewing' because there was nothing better.
update pipeline_stages
set stage_type = 'screening'
where stage_type = 'reviewing' and label ilike '%screen%';

-- ----- 2. requests: who asked, in what zone, for what, and the pick -----
alter table interview_availability_requests
  add column if not exists meeting_type text not null default 'interview',
  add column if not exists employer_timezone text,
  add column if not exists requested_by uuid references profiles(user_id) on delete set null,
  -- The slot the student picked. Deliberately not a foreign key: a second FK
  -- between requests and slots would make every PostgREST embed of
  -- interview_availability_slots ambiguous. The route validates it belongs
  -- to the request.
  add column if not exists selected_slot_id uuid,
  add column if not exists selected_at timestamptz;

alter table interview_availability_requests
  drop constraint if exists interview_availability_requests_meeting_type_check;
alter table interview_availability_requests
  add constraint interview_availability_requests_meeting_type_check
  check (meeting_type in ('screening', 'interview'));

-- A pick only exists once the student has made it.
alter table interview_availability_requests
  drop constraint if exists interview_availability_selection_state;
alter table interview_availability_requests
  add constraint interview_availability_selection_state
  check (selected_slot_id is null or status in ('awaiting_employer', 'scheduled', 'cancelled'));

comment on column interview_availability_requests.student_timezone is
  'The student''s IANA zone, captured when they pick a slot.';
comment on column interview_availability_requests.employer_timezone is
  'The employer''s IANA zone — the zone the proposed slots were drawn in.';

-- ----- 3. slots: the employer writes them now -----
-- One row per meeting-length slot the employer offers. slot_date is the
-- employer's local calendar day; starts_at/ends_at are real instants.
drop policy if exists "Students insert slots on own requests" on interview_availability_slots;
drop policy if exists "Students delete slots on own requests" on interview_availability_slots;

drop policy if exists "Employers insert slots on own requests" on interview_availability_slots;
create policy "Employers insert slots on own requests"
  on interview_availability_slots for insert to authenticated
  with check (
    request_id in (
      select r.id from interview_availability_requests r
      where r.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers delete slots on own requests" on interview_availability_slots;
create policy "Employers delete slots on own requests"
  on interview_availability_slots for delete to authenticated
  using (
    request_id in (
      select r.id from interview_availability_requests r
      where r.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- ----- 4. interviews: Screening vs Interview, and whose meeting it is -----
alter table interview_schedules
  add column if not exists meeting_type text not null default 'interview',
  add column if not exists organizer_user_id uuid references profiles(user_id) on delete set null;

alter table interview_schedules
  drop constraint if exists interview_schedules_meeting_type_check;
alter table interview_schedules
  add constraint interview_schedules_meeting_type_check
  check (meeting_type in ('screening', 'interview'));

-- Existing interviews belong to the account that owns the company.
update interview_schedules i
set organizer_user_id = e.user_id
from employers e
where e.id = i.employer_id and i.organizer_user_id is null;

create index if not exists idx_interview_schedules_organizer
  on interview_schedules (organizer_user_id, scheduled_at);
