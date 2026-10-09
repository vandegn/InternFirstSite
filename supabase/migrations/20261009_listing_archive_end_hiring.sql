-- ============================================
-- ARCHIVE A POSTING / END HIRING, and UNARCHIVE AS CLOSED
-- ============================================
--
-- Posted Jobs gets an "Archive/End Hiring" action and, on an archived posting,
-- "Unarchive". Product rules:
--
--   Archive & End Hiring (one transaction, archive_listing_and_end_hiring):
--     * the posting closes, is marked archived, and stops accepting
--       applications (enforced here, not just in the UI);
--     * every attached applicant whose stage is not stage_type 'offered' moves
--       to the posting's Rejected column (created from the "Rejected" preset if
--       the board has none) — already-rejected applicants stay where they are,
--       Offered applicants keep their status;
--     * live interview invites / availability requests for the rejected
--       applicants are cancelled and their unanswered offers withdrawn, so
--       nothing keeps "hiring" after hiring ended;
--     * each rejected student gets the usual "Application update" bell entry.
--   Students see the change through the same application rows, and their
--   personal archive (student_application_archives) is untouched.
--
--   Unarchive as Closed (unarchive_listing):
--     * the posting returns to Posted Jobs with status 'closed';
--     * every application on it is DETACHED (applications.detached_at): the
--       student keeps the record and its final status, but the employer no
--       longer sees it anywhere — candidate list, counts, pipeline, interviews,
--       offers, résumés, answers. Reopening later does not reconnect them.
--
-- Detachment is the "hiring cycle" marker. Rather than auditing every employer
-- query, the employer-side RLS on applications excludes detached rows, and
-- every other employer policy that reaches applicant data through a subquery
-- on applications inherits that automatically (answers, résumés, skills,
-- experiences, organizations, certifications, offer-letter uploads). The
-- policies that key on listing/employer instead of on applications (offers,
-- interview_schedules, interview_availability_requests) get an explicit
-- application_is_attached() check below.
--
-- unique(student_id, listing_id) becomes a partial unique index over attached
-- rows, so a student whose old application was detached can apply again once
-- the posting is reopened.
--
-- Run this in the Supabase SQL Editor, after 20261009_student_application_archive.sql.

-- ============================================
-- 1. Columns
-- ============================================
alter table internship_listings
  add column if not exists archived_at timestamptz;

-- An archived posting is always closed; reopening means unarchiving first.
alter table internship_listings
  drop constraint if exists internship_listings_archived_is_closed;
alter table internship_listings
  add constraint internship_listings_archived_is_closed
  check (archived_at is null or status = 'closed');

create index if not exists idx_listings_archived
  on internship_listings(employer_id) where archived_at is not null;

-- Set when the posting this application belongs to was unarchived (its
-- hiring cycle ended). Detached rows are student history only.
alter table applications
  add column if not exists detached_at timestamptz;

create index if not exists idx_applications_listing_attached
  on applications(listing_id) where detached_at is null;

-- ============================================
-- 2. One live application per student per posting
-- ============================================
-- Drop the table-level unique(student_id, listing_id) whatever it was named,
-- and enforce uniqueness only among attached applications.
do $$
declare
  c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    where con.conrelid = 'applications'::regclass
      and con.contype = 'u'
      and (
        select array_agg(att.attname::text order by att.attname)
        from unnest(con.conkey) k
        join pg_attribute att on att.attrelid = con.conrelid and att.attnum = k
      ) = array['listing_id', 'student_id']
  loop
    execute format('alter table applications drop constraint %I', c.conname);
  end loop;
end $$;

create unique index if not exists applications_one_attached_per_student_listing
  on applications(student_id, listing_id)
  where detached_at is null;

-- ============================================
-- 3. Helpers
-- ============================================
-- security definer so it answers the same way inside any table's policy,
-- whatever the caller can see of applications.
create or replace function application_is_attached(p_application_id uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from applications
    where id = p_application_id and detached_at is null
  );
$$;

-- Who may archive / unarchive a posting: an active member of an approved
-- company whose role carries manage_listings (ROLE_CAPABILITIES in
-- lib/employer-team.ts: master_admin, recruiting_lead).
create or replace function can_manage_employer_listings(uid uuid, emp uuid)
returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1
    from employer_members m
    join employers e on e.id = m.employer_id
    where m.user_id = uid
      and m.employer_id = emp
      and m.status = 'active'
      and m.role in ('master_admin', 'recruiting_lead')
      and e.verification_status = 'approved'
  );
$$;

-- The canonical bucket of an application, mirroring applicationStageType() /
-- planEndHiring() in the app: the stage's stage_type, else the legacy status.
create or replace function application_stage_type(p_stage_type text, p_status text)
returns text
language sql immutable as $$
  select coalesce(
    p_stage_type,
    case
      when lower(regexp_replace(coalesce(p_status, ''), '[\s-]+', '_', 'g'))
           in ('offered', 'offer_extended') then 'offered'
      when lower(regexp_replace(coalesce(p_status, ''), '[\s-]+', '_', 'g'))
           in ('rejected', 'closed', 'not_selected', 'rejected/closed') then 'rejected'
      else 'applied'
    end
  );
$$;

-- ============================================
-- 4. Guards: archived postings take no new applications or moves
-- ============================================
-- Writes can only change archived_at / detached_at through the RPCs below,
-- which set this transaction-local flag.
create or replace function guard_listing_archive_columns()
returns trigger
language plpgsql as $$
begin
  if new.archived_at is distinct from old.archived_at
     and coalesce(current_setting('app.listing_archive_rpc', true), '') <> 'on' then
    raise exception 'Use Archive/End Hiring or Unarchive to change a posting''s archive state.'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

drop trigger if exists trg_guard_listing_archive_columns on internship_listings;
create trigger trg_guard_listing_archive_columns
  before update of archived_at on internship_listings
  for each row execute function guard_listing_archive_columns();

-- Before insert: an archived posting accepts no applications. FOR SHARE waits
-- for an in-flight archive (which holds the listing FOR UPDATE) to commit, then
-- re-reads it, so an application racing the archive is refused rather than
-- slipping in un-rejected.
-- Before update of stage_id: nobody moves an attached candidate on an archived
-- posting (the RPC moves them before it sets archived_at). Detaching, or a
-- stage delete nulling stage_id, is allowed.
create or replace function guard_application_on_archived_listing()
returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_archived timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.stage_id is not distinct from old.stage_id or new.stage_id is null
       or new.detached_at is not null then
      return new;
    end if;
  end if;

  select archived_at into v_archived
  from internship_listings
  where id = new.listing_id
  for share;

  if v_archived is not null then
    if tg_op = 'INSERT' then
      raise exception 'This posting has been archived and is no longer accepting applications.'
        using errcode = 'P0001';
    else
      raise exception 'Hiring has ended for this posting, so candidates can''t be moved.'
        using errcode = 'P0001';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_block_archived_listing_application on applications;
create trigger trg_block_archived_listing_application
  before insert or update of stage_id on applications
  for each row execute function guard_application_on_archived_listing();

-- Employers can't set or clear detached_at by hand: their update policy below
-- only admits attached rows and only leaves them attached.

-- ============================================
-- 5. Employer RLS ignores detached applications
-- ============================================
drop policy if exists "Employers can view applications to their listings" on applications;
create policy "Employers can view applications to their listings"
  on applications for select to authenticated
  using (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can update application status" on applications;
create policy "Employers can update application status"
  on applications for update to authenticated
  using (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

drop policy if exists "Employers can delete applications to their listings" on applications;
create policy "Employers can delete applications to their listings"
  on applications for delete to authenticated
  using (
    detached_at is null
    and is_approved_employer(auth.uid())
    and listing_id in (
      select id from internship_listings
      where employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- Offers: keyed on listing, so they need the explicit check.
drop policy if exists "Employers manage offers on own listings" on offers;
create policy "Employers manage offers on own listings"
  on offers for all to authenticated
  using (
    is_approved_employer(auth.uid())
    and application_is_attached(application_id)
    and listing_id in (
      select il.id from internship_listings il
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  )
  with check (
    is_approved_employer(auth.uid())
    and application_is_attached(application_id)
    and listing_id in (
      select il.id from internship_listings il
      where il.employer_id in (select acting_employer_ids(auth.uid()))
    )
  );

-- Interviews and availability requests: keyed on employer_id.
drop policy if exists "Employers can view own interviews" on interview_schedules;
create policy "Employers can view own interviews"
  on interview_schedules for select to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  );

drop policy if exists "Employers can update own interviews" on interview_schedules;
create policy "Employers can update own interviews"
  on interview_schedules for update to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  );

drop policy if exists "Employers view own availability requests" on interview_availability_requests;
create policy "Employers view own availability requests"
  on interview_availability_requests for select to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  );

drop policy if exists "Employers update own availability requests" on interview_availability_requests;
create policy "Employers update own availability requests"
  on interview_availability_requests for update to authenticated
  using (
    employer_id in (select acting_employer_ids(auth.uid()))
    and application_is_attached(application_id)
  )
  with check (employer_id in (select acting_employer_ids(auth.uid())));

-- Pending-employer teaser count: attached applications only.
create or replace function employer_pending_applicant_count()
returns int
language sql stable security definer set search_path = public as $$
  select count(a.id)::int
  from applications a
  join internship_listings il on a.listing_id = il.id
  join employer_members m on il.employer_id = m.employer_id
  where m.user_id = auth.uid() and m.status = 'active'
    and a.detached_at is null;
$$;

-- ============================================
-- 6. archive_listing_and_end_hiring
-- ============================================
create or replace function archive_listing_and_end_hiring(p_listing_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_listing internship_listings%rowtype;
  v_reject_stage pipeline_stages%rowtype;
  v_rejected_ids uuid[];
  v_kept_offered int;
  v_already_rejected int;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  -- Lock the posting first: concurrent applications (guard trigger, FOR SHARE)
  -- and a second archive click both queue behind this.
  select * into v_listing from internship_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Posting not found.' using errcode = 'P0002';
  end if;

  if not can_manage_employer_listings(v_uid, v_listing.employer_id) then
    raise exception 'You don''t have permission to archive this posting.' using errcode = '42501';
  end if;

  -- A retried request after success is a no-op, not an error.
  if v_listing.archived_at is not null then
    return jsonb_build_object(
      'listing_id', p_listing_id, 'archived_at', v_listing.archived_at,
      'already_archived', true, 'rejected', 0, 'kept_offered', 0, 'already_rejected', 0
    );
  end if;

  -- Lock every attached application so no stage change lands mid-way.
  perform 1 from applications
  where listing_id = p_listing_id and detached_at is null
  for update;

  -- The posting's rejection column, or a new one from the "Rejected" preset
  -- (PIPELINE_STAGE_PRESETS), placed after every existing column.
  select * into v_reject_stage
  from pipeline_stages
  where listing_id = p_listing_id and stage_type = 'rejected'
  order by position
  limit 1;

  if not found then
    insert into pipeline_stages (listing_id, label, color_bg, color_text, position, stage_type, locked)
    values (
      p_listing_id, 'Rejected', 'var(--danger-bg-strong)', 'var(--danger-fg)',
      coalesce((select max(position) from pipeline_stages where listing_id = p_listing_id), 0) + 1,
      'rejected', false
    )
    returning * into v_reject_stage;
  end if;

  select
    count(*) filter (where application_stage_type(ps.stage_type, a.status) = 'offered'),
    count(*) filter (where application_stage_type(ps.stage_type, a.status) = 'rejected')
  into v_kept_offered, v_already_rejected
  from applications a
  left join pipeline_stages ps on ps.id = a.stage_id
  where a.listing_id = p_listing_id and a.detached_at is null;


  -- Everyone not Offered and not already rejected -> Rejected.
  -- trg_sync_application_status mirrors the stage label into status.
  with targets as (
    select a.id
    from applications a
    left join pipeline_stages ps on ps.id = a.stage_id
    where a.listing_id = p_listing_id
      and a.detached_at is null
      and application_stage_type(ps.stage_type, a.status) not in ('offered', 'rejected')
  ),
  moved as (
    update applications a
       set stage_id = v_reject_stage.id
      from targets t
     where a.id = t.id
    returning a.id
  )
  select coalesce(array_agg(id), '{}') into v_rejected_ids from moved;

  -- Nothing keeps hiring after hiring ended: cancel upcoming interviews and
  -- open availability requests for the rejected, and withdraw any offer they
  -- hadn't answered (e.g. a candidate dragged out of Offered with one live).
  update interview_schedules
     set status = 'cancelled', cancelled_by = 'employer', cancelled_at = now()
   where application_id = any(v_rejected_ids)
     and status in ('pending', 'accepted', 'reschedule_requested')
     and scheduled_at > now();

  update interview_availability_requests
     set status = 'cancelled'
   where application_id = any(v_rejected_ids)
     and status in ('requested', 'awaiting_student', 'awaiting_employer');

  update offers
     set status = 'withdrawn'
   where application_id = any(v_rejected_ids)
     and status = 'extended';

  -- The same bell entry a manual move to Rejected sends
  -- (updateApplicationStage in lib/supabase.ts).
  insert into notifications (user_id, actor_id, type, title, body, link)
  select s.user_id, v_uid, 'application_status',
         'Application update: ' || v_reject_stage.label,
         'Your application for "' || v_listing.title || '" is now ' || v_reject_stage.label || '.',
         '/dashboard/student/applications'
  from applications a
  join students s on s.id = a.student_id
  where a.id = any(v_rejected_ids);

  -- Close and archive last: the guard trigger refuses stage moves on an
  -- archived posting, and the moves above had to land first.
  perform set_config('app.listing_archive_rpc', 'on', true);
  update internship_listings
     set status = 'closed', archived_at = now(), publish_at = null
   where id = p_listing_id
  returning * into v_listing;
  perform set_config('app.listing_archive_rpc', 'off', true);

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'archived_at', v_listing.archived_at,
    'already_archived', false,
    'rejected', coalesce(array_length(v_rejected_ids, 1), 0),
    'kept_offered', v_kept_offered,
    'already_rejected', v_already_rejected
  );
end;
$$;

revoke all on function archive_listing_and_end_hiring(uuid) from public, anon;
grant execute on function archive_listing_and_end_hiring(uuid) to authenticated;

-- ============================================
-- 7. unarchive_listing
-- ============================================
create or replace function unarchive_listing(p_listing_id uuid)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_listing internship_listings%rowtype;
  v_detached int;
begin
  if v_uid is null then
    raise exception 'You need to be signed in.' using errcode = '42501';
  end if;

  select * into v_listing from internship_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Posting not found.' using errcode = 'P0002';
  end if;

  if not can_manage_employer_listings(v_uid, v_listing.employer_id) then
    raise exception 'You don''t have permission to unarchive this posting.' using errcode = '42501';
  end if;

  if v_listing.archived_at is null then
    return jsonb_build_object(
      'listing_id', p_listing_id, 'status', v_listing.status,
      'already_unarchived', true, 'detached', 0
    );
  end if;

  -- Upcoming interviews / open availability requests on candidates who are
  -- about to vanish from the employer's view would otherwise dangle for the
  -- student with nobody on the other side.
  update interview_schedules
     set status = 'cancelled', cancelled_by = 'employer', cancelled_at = now()
   where listing_id = p_listing_id
     and application_is_attached(application_id)
     and status in ('pending', 'accepted', 'reschedule_requested')
     and scheduled_at > now();

  update interview_availability_requests
     set status = 'cancelled'
   where listing_id = p_listing_id
     and application_is_attached(application_id)
     and status in ('requested', 'awaiting_student', 'awaiting_employer');

  -- End the hiring cycle: the students keep their applications (and final
  -- statuses); the employer stops seeing them, and a reopened posting starts
  -- clean.
  with detached as (
    update applications
       set detached_at = now()
     where listing_id = p_listing_id and detached_at is null
    returning id
  )
  select count(*) into v_detached from detached;

  perform set_config('app.listing_archive_rpc', 'on', true);
  update internship_listings
     set archived_at = null, status = 'closed', applicant_count = 0
   where id = p_listing_id
  returning * into v_listing;
  perform set_config('app.listing_archive_rpc', 'off', true);

  return jsonb_build_object(
    'listing_id', p_listing_id,
    'status', v_listing.status,
    'already_unarchived', false,
    'detached', v_detached
  );
end;
$$;

revoke all on function unarchive_listing(uuid) from public, anon;
grant execute on function unarchive_listing(uuid) to authenticated;
