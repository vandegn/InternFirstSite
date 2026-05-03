-- Add Zoom meeting fields to interview_schedules
alter table interview_schedules
  add column if not exists zoom_meeting_id text,
  add column if not exists zoom_meeting_password text;
