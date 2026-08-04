-- ============================================
-- REPOINT "new applicant" NOTIFICATIONS AT THE PIPELINE
-- ============================================
-- notifyEmployerOfApplication used to link every new-applicant alert at
-- /dashboard/employer/applications — a generic list of every applicant to every
-- listing, which drops the employer nowhere near the candidate the alert named.
-- It now links to that candidate's card on the listing's pipeline board.
--
-- Rows already in employers' bells keep the old link, so rebuild it here.
-- notifications carries no application_id, so each row is matched back through
-- actor_id (the student who applied) and user_id (the employer who owns the
-- listing). A student can hold several applications with the same employer, so
-- ties break on the application filed closest to the notification's timestamp —
-- the only signal the row actually preserves.
--
-- Safe to re-run: rows already pointing at the pipeline are skipped.
--
-- Run this in the Supabase SQL Editor.

update notifications n
set link = m.new_link
from (
  select distinct on (nn.id)
    nn.id as notification_id,
    '/dashboard/employer/pipeline?listing=' || a.listing_id || '&application=' || a.id as new_link
  from notifications nn
  join students s              on s.user_id = nn.actor_id
  join applications a          on a.student_id = s.id
  join internship_listings il  on il.id = a.listing_id
  join employers e             on e.id = il.employer_id and e.user_id = nn.user_id
  where nn.type = 'new_application'
    and coalesce(nn.link, '') not like '/dashboard/employer/pipeline%'
  order by nn.id, abs(extract(epoch from (a.applied_at - nn.created_at)))
) m
where n.id = m.notification_id;
