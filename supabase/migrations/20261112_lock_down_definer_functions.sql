-- Lock down EXECUTE on SECURITY DEFINER functions.
--
-- Supabase's security advisor reported 28 security-definer functions that a
-- logged-out visitor could call through PostgREST (/rest/v1/rpc/<name>), and
-- 31 a signed-in user could call. Earlier migrations tried to restrict several
-- of them with `revoke all ... from public`, but Supabase's default privileges
-- also grant EXECUTE to `anon`, `authenticated` and `service_role` directly,
-- so revoking from PUBLIC alone never removed those grants. Every revoke below
-- names the roles explicitly for that reason.
--
-- What each group needs, verified against pg_policy, pg_trigger, cron.job and
-- every .rpc() call in app/src before this was written:
--
--   1. Trigger and event-trigger functions. Postgres does not check EXECUTE
--      when a trigger fires, and PostgREST cannot usefully call them. Nobody
--      but the owner needs EXECUTE.
--   2. Maintenance jobs run by pg_cron as `postgres` (the owner). Clients must
--      not be able to run them on demand.
--   3. Helpers called only from inside other SECURITY DEFINER functions, which
--      run as the owner, so callers never need EXECUTE themselves.
--   4. RLS helpers. Every policy that calls them is `to authenticated`; none
--      applies to `anon`. Signed-in users must keep EXECUTE or those policies
--      fail; logged-out visitors don't need it. (The public employer policy is
--      `verification_status = 'approved'`, not can_view_employer.)
--   5. Client RPCs called only from signed-in dashboards.
--
-- service_role keeps EXECUTE everywhere so server routes are unaffected.
--
-- Groups 4 and 5 will still appear under the advisor's "signed-in users can
-- execute" lint. That is intended: RLS policies evaluate as the querying role,
-- so the helpers must be executable by `authenticated`.

-- 1. Trigger functions --------------------------------------------------------
revoke all on function public.close_listings_on_account_deletion() from public, anon, authenticated;
revoke all on function public.flag_knockout_answer() from public, anon, authenticated;
revoke all on function public.guard_application_on_archived_listing() from public, anon, authenticated;
revoke all on function public.handle_deleted_application() from public, anon, authenticated;
revoke all on function public.handle_new_application() from public, anon, authenticated;
revoke all on function public.seed_master_admin_member() from public, anon, authenticated;
revoke all on function public.seed_pipeline_stages_for_listing() from public, anon, authenticated;
revoke all on function public.set_default_application_stage() from public, anon, authenticated;
revoke all on function public.sync_application_status_from_stage() from public, anon, authenticated;
-- The three below have no trigger attached (20260803_manual_pipeline_movement
-- dropped them and kept the functions so the revert is a CREATE TRIGGER).
revoke all on function public.sync_stage_on_availability_requested() from public, anon, authenticated;
revoke all on function public.sync_stage_on_interview_closed() from public, anon, authenticated;
revoke all on function public.sync_stage_on_interview_created() from public, anon, authenticated;
-- Event trigger behind `ensure_rls`.
revoke all on function public.rls_auto_enable() from public, anon, authenticated;

-- 2. pg_cron maintenance jobs -------------------------------------------------
revoke all on function public.publish_due_listings() from public, anon, authenticated;
revoke all on function public.purge_expired_account_deletions() from public, anon, authenticated;

-- 3. Called only from other SECURITY DEFINER functions ------------------------
-- employer_ids_of_user: can_view_employer / can_view_profile / can_view_student
-- can_manage_employer_listings: archive_listing_and_end_hiring / unarchive_listing
-- move_application_to_stage_type: the sync_stage_* functions above
revoke all on function public.employer_ids_of_user(uuid) from public, anon, authenticated;
revoke all on function public.can_manage_employer_listings(uuid, uuid) from public, anon, authenticated;
revoke all on function public.move_application_to_stage_type(uuid, text) from public, anon, authenticated;

-- 4. RLS helpers: signed-in only ----------------------------------------------
revoke all on function public.acting_employer_ids(uuid) from public, anon;
revoke all on function public.application_is_attached(uuid) from public, anon;
revoke all on function public.can_view_employer(uuid) from public, anon;
revoke all on function public.can_view_profile(uuid) from public, anon;
revoke all on function public.can_view_student(uuid) from public, anon;
revoke all on function public.is_approved_employer(uuid) from public, anon;
revoke all on function public.is_employer_master_admin(uuid, uuid) from public, anon;
revoke all on function public.is_intern_first_admin(uuid) from public, anon;
grant execute on function public.acting_employer_ids(uuid) to authenticated;
grant execute on function public.application_is_attached(uuid) to authenticated;
grant execute on function public.can_view_employer(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_view_student(uuid) to authenticated;
grant execute on function public.is_approved_employer(uuid) to authenticated;
grant execute on function public.is_employer_master_admin(uuid, uuid) to authenticated;
grant execute on function public.is_intern_first_admin(uuid) to authenticated;

-- 5. Client RPCs used only from signed-in dashboards --------------------------
-- employer_pending_applicant_count: employer dashboard (getPendingApplicantCount)
-- record_listing_view: student dashboard (trackListingView)
revoke all on function public.employer_pending_applicant_count() from public, anon;
revoke all on function public.record_listing_view(uuid) from public, anon;
grant execute on function public.employer_pending_applicant_count() to authenticated;
grant execute on function public.record_listing_view(uuid) to authenticated;

-- service_role keeps everything --------------------------------------------------
grant execute on function
  public.close_listings_on_account_deletion(),
  public.flag_knockout_answer(),
  public.guard_application_on_archived_listing(),
  public.handle_deleted_application(),
  public.handle_new_application(),
  public.seed_master_admin_member(),
  public.seed_pipeline_stages_for_listing(),
  public.set_default_application_stage(),
  public.sync_application_status_from_stage(),
  public.sync_stage_on_availability_requested(),
  public.sync_stage_on_interview_closed(),
  public.sync_stage_on_interview_created(),
  public.rls_auto_enable(),
  public.publish_due_listings(),
  public.purge_expired_account_deletions(),
  public.employer_ids_of_user(uuid),
  public.can_manage_employer_listings(uuid, uuid),
  public.move_application_to_stage_type(uuid, text),
  public.acting_employer_ids(uuid),
  public.application_is_attached(uuid),
  public.can_view_employer(uuid),
  public.can_view_profile(uuid),
  public.can_view_student(uuid),
  public.is_approved_employer(uuid),
  public.is_employer_master_admin(uuid, uuid),
  public.is_intern_first_admin(uuid),
  public.employer_pending_applicant_count(),
  public.record_listing_view(uuid)
to service_role;
