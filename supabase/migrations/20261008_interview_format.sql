-- Interview format: the employer chooses how the interview happens.
--   internfirst   — the built-in InternFirst video room (the default, and what
--                   every interview before this migration used)
--   external_link — the employer's own meeting link (Zoom, Teams, Meet…),
--                   sent to the student in chat with the date and time
--   phone         — a phone screen; the student is asked in chat for the best
--                   number to reach them
alter table interview_schedules
  add column if not exists format text not null default 'internfirst',
  add column if not exists meeting_url text;

alter table interview_schedules
  drop constraint if exists interview_schedules_format_check;
alter table interview_schedules
  add constraint interview_schedules_format_check
  check (format in ('internfirst', 'external_link', 'phone'));

-- An external-link interview is meaningless without its link.
alter table interview_schedules
  drop constraint if exists interview_schedules_meeting_url_check;
alter table interview_schedules
  add constraint interview_schedules_meeting_url_check
  check (format <> 'external_link' or (meeting_url is not null and meeting_url ~* '^https?://'));
