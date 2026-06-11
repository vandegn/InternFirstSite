-- ============================================
-- FIX: allow receivers to mark messages as read
-- ============================================
-- The messages table had RLS enabled with only SELECT and INSERT policies.
-- With no UPDATE policy, `markMessagesAsRead` (UPDATE messages SET read = true)
-- was silently denied (0 rows affected), so the unread `read` flag never
-- flipped and the sidebar "unread messages" badge never cleared.
--
-- This adds an UPDATE policy letting a user update messages they received,
-- which is what marking-as-read requires.
--
-- Run this in the Supabase SQL Editor (Dashboard > SQL Editor > New Query).

create policy "Receivers can mark messages read"
  on messages for update to authenticated
  using (auth.uid() = receiver_id)
  with check (auth.uid() = receiver_id);
