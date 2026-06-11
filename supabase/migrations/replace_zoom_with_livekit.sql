alter table interview_schedules
  drop column if exists zoom_meeting_id,
  drop column if exists zoom_meeting_password;
