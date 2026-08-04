-- ============================================
-- THE PIPELINE BOARD IS MOVED BY HAND
-- ============================================
-- Scheduling an interview (or asking a candidate for their availability) used
-- to drag the card into the Interviewing column on its own, and declining or
-- cancelling walked it back. Interview state and board position are two
-- different things: an employer may interview someone who they have already
-- pushed to a later stage, or want a candidate to sit in Screening until the
-- interview actually happens. Only the employer decides where a card sits.
--
-- Interviews are unaffected — the invite, the calendar event, the emails and
-- the notifications all still fire. What goes away is the implicit stage write.
--
-- The functions are left in place (harmless without their triggers, and
-- move_application_to_stage_type is still used by nothing else today) so this
-- can be reverted by recreating the three triggers alone.
--
-- Run this in the Supabase SQL Editor.

-- Forward moves: interview scheduled / availability requested → Interviewing.
drop trigger if exists trg_sync_stage_on_interview_created on interview_schedules;
drop trigger if exists trg_sync_stage_on_availability_requested on interview_availability_requests;

-- Reverse move: interview declined or cancelled → back to the previous stage.
-- Goes too. With the forward moves gone, a card only sits in Interviewing
-- because the employer put it there, and a declined invite is not a reason to
-- undo that decision.
drop trigger if exists trg_sync_stage_on_interview_closed on interview_schedules;
