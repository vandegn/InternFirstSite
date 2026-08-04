-- ============================================
-- OFFERS LAND IN THE INBOX TOO
-- ============================================
-- Extending an offer already writes a notification. A notification is a
-- pointer that disappears once read, which is the wrong shape for the most
-- important thing an employer ever tells a student. So the offer also arrives
-- as a real message in the thread with that employer, where it stays, is
-- searchable, and can be replied to.
--
-- Same mechanism as the interview availability request
-- (messages.availability_request_id, 20260802_interview_availability.sql): the
-- id hangs off the message, and the Inbox renders a card in place of the text
-- bubble whenever it is set. `body` remains a readable fallback -- it is what
-- the email notification and any non-card surface shows.
--
-- Run this in the Supabase SQL Editor, after 20260803_offers.sql.

alter table messages
  add column if not exists offer_id uuid references offers(id) on delete set null;

create index if not exists idx_messages_offer on messages (offer_id);
