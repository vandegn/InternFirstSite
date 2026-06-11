-- ============================================
-- NOTIFICATIONS
-- ============================================
-- In-platform notifications surfaced by the header bell. A row is inserted
-- by the actor (current user) for the recipient whenever a relevant event
-- happens: a first message in a conversation, an application status change
-- (CRM move), a new applicant, or an interview event.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).

create table if not exists notifications (
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

create index if not exists idx_notifications_user on notifications(user_id, created_at desc);
create index if not exists idx_notifications_unread on notifications(user_id) where read = false;

alter table notifications enable row level security;

-- Recipients can read their own notifications.
create policy "Users can view own notifications"
  on notifications for select to authenticated
  using (auth.uid() = user_id);

-- Recipients can mark their own notifications read.
create policy "Users can update own notifications"
  on notifications for update to authenticated
  using (auth.uid() = user_id);

-- Any authenticated user can create a notification, but only as themselves
-- (actor_id must be the current user). This lets an employer notify a student
-- when moving them on the CRM board, a student notify an employer on apply, etc.
create policy "Users can create notifications as themselves"
  on notifications for insert to authenticated
  with check (auth.uid() = actor_id);
