-- ============================================
-- Employers must be approved before they can post
-- ============================================
--
-- Until now "Employers can manage own listings" was a single FOR ALL policy,
-- so a pending employer could create listings freely -- they were just hidden
-- from students by the select policy. That made verification feel like a
-- display filter rather than a gate, and left unreviewed companies able to
-- stage a catalogue of postings that would all go live the instant they were
-- approved.
--
-- Splitting the policy per-command lets a pending employer keep reading and
-- editing what they already have (so nothing they wrote disappears while they
-- wait) while INSERT alone requires approval.

drop policy if exists "Employers can manage own listings" on internship_listings;

create policy "Employers can view own listings"
  on internship_listings for select to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  );

-- The gate. is_approved_employer is security definer, so tightening the
-- employers select policy later can't quietly turn this into `false`.
create policy "Approved employers can create listings"
  on internship_listings for insert to authenticated
  with check (
    is_approved_employer(auth.uid())
    and employer_id in (select id from employers where user_id = auth.uid())
  );

create policy "Employers can update own listings"
  on internship_listings for update to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  )
  with check (
    employer_id in (select id from employers where user_id = auth.uid())
  );

create policy "Employers can delete own listings"
  on internship_listings for delete to authenticated
  using (
    employer_id in (select id from employers where user_id = auth.uid())
  );
