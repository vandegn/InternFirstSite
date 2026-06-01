-- Track when a message triggered an email notification (for rate-limiting).
alter table messages
  add column if not exists email_notified_at timestamptz;

-- Track when a 30-minute reminder email was sent for an interview.
alter table interview_schedules
  add column if not exists reminder_sent_at timestamptz;

create index if not exists idx_messages_email_notified
  on messages (sender_id, receiver_id, email_notified_at)
  where email_notified_at is not null;

create index if not exists idx_interview_schedules_reminder_due
  on interview_schedules (scheduled_at)
  where status = 'accepted' and reminder_sent_at is null;
