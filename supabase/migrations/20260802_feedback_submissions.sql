-- Feedback gets its own admin-only queue.
--
-- The first cut delivered feedback as a normal message into the admin's
-- inbox. That buried it among real employer/student conversations, gave no way
-- to mark an item handled, and made the destination depend on resolving an
-- admin account by email at request time. Feedback is now a first-class record
-- with a status, reviewed on a dedicated admin tab.
--
-- Submitter identity is snapshotted (email, name, role) rather than joined:
-- feedback has to stay readable after the person who sent it deletes their
-- account, which is exactly when you most want to know what they said.

create table if not exists feedback_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(user_id) on delete set null,
  submitter_email text,
  submitter_name text,
  submitter_role text,
  category text not null default 'other'
    check (category in ('bug', 'idea', 'other')),
  message text not null check (length(trim(message)) > 0),
  page_path text,
  status text not null default 'new'
    check (status in ('new', 'reviewed', 'resolved')),
  admin_note text,
  created_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references profiles(user_id) on delete set null
);

-- The admin queue reads newest-first, usually filtered to unhandled items.
create index if not exists idx_feedback_status_created
  on feedback_submissions(status, created_at desc);

alter table feedback_submissions enable row level security;

-- Anyone signed in can file feedback, but only as themselves — user_id is
-- pinned to the caller so a submission can't be attributed to someone else.
create policy "Users can submit feedback"
  on feedback_submissions for insert to authenticated
  with check (user_id = auth.uid());

-- Deliberately no student/employer SELECT policy. Feedback is a private
-- channel to the InternFirst team, not a public board.
create policy "Admins can view all feedback"
  on feedback_submissions for select to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'intern_first_admin'
    )
  );

create policy "Admins can update feedback status"
  on feedback_submissions for update to authenticated
  using (
    exists (
      select 1 from profiles
      where profiles.user_id = auth.uid()
        and profiles.role = 'intern_first_admin'
    )
  );

comment on table feedback_submissions is
  'In-product feedback from students and employers. Reviewed at /dashboard/admin/feedback.';
