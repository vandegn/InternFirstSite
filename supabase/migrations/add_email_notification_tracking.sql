-- Track when a message triggered an email notification (for rate-limiting).
alter table messages
  add column if not exists email_notified_at timestamptz;

create index if not exists idx_messages_email_notified
  on messages (sender_id, receiver_id, email_notified_at)
  where email_notified_at is not null;
