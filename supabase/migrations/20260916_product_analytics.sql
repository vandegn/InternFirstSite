-- First-party analytics. Apply before deploying the accompanying application.
begin;
create table public.product_events (
  id uuid primary key default gen_random_uuid(),
  name text not null check (name in ('listing_viewed','cta_clicked','registration_started','registration_completed','application_started','application_completed','job_posting_started','job_published')),
  role text not null check (role in ('student','employer','anonymous')),
  session_id uuid,
  flow_key text not null,
  path text,
  cta text check (cta in ('register','apply','post_job','browse_internships','waitlist')),
  listing_id uuid, -- no FK: aggregate history survives listing deletion
  created_at timestamptz not null default now(),
  unique(name, flow_key)
);
create index product_events_date_role on public.product_events(created_at, role);
create index product_events_session_date on public.product_events(session_id, created_at);
alter table public.product_events enable row level security;
revoke all on public.product_events from anon, authenticated;
grant select on public.product_events to authenticated;
create policy "Admins read product analytics" on public.product_events for select to authenticated
using (public.is_intern_first_admin(auth.uid()));
alter table public.internship_listings add column analytics_flow_id uuid;

-- Only the validated server endpoint can call this. Serialize each session's
-- writes so concurrent requests cannot bypass the 120 events/minute budget.
create function public.record_product_event(p_id uuid, p_name text, p_role text, p_session uuid, p_flow text, p_path text, p_cta text, p_listing uuid)
returns boolean language plpgsql security definer set search_path = public as $$
begin
  if p_name not in ('listing_viewed','cta_clicked','registration_started','application_started','job_posting_started') then
    raise exception 'Invalid client event';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_session::text, 0));
  if (select count(*) from product_events where session_id = p_session and created_at > now() - interval '1 minute') >= 120 then return false; end if;
  insert into product_events(id,name,role,session_id,flow_key,path,cta,listing_id)
  values(p_id,p_name,p_role,p_session,p_flow,p_path,p_cta,p_listing) on conflict do nothing;
  return true;
end $$;
revoke all on function public.record_product_event(uuid,text,text,uuid,text,text,text,uuid) from public, anon, authenticated;
grant execute on function public.record_product_event(uuid,text,text,uuid,text,text,text,uuid) to service_role;

create function public.capture_product_completion()
returns trigger language plpgsql security definer set search_path = public as $$
declare flow text; actor uuid;
begin
  if tg_table_name = 'profiles' then
    if new.role not in ('student','employer') then return new; end if;
    select raw_user_meta_data->>'analyticsFlowId' into flow from auth.users where id = new.user_id;
    if flow is null or flow !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then flow := new.user_id::text; end if;
    insert into product_events(name,role,flow_key) values('registration_completed',new.role,flow || ':' || new.role) on conflict do nothing;
  elsif tg_table_name = 'applications' then
    select user_id into actor from students where id = new.student_id;
    insert into product_events(name,role,flow_key,listing_id) values('application_completed','student',actor::text || ':' || new.listing_id::text,new.listing_id) on conflict do nothing;
  elsif tg_table_name = 'internship_listings' then
    if new.status is distinct from 'active' then return new; end if;
    if tg_op = 'UPDATE' then
      if old.status = 'active' then return new; end if;
    end if;
    -- Link draft/scheduled publication back to the original form, including
    -- publication by another teammate or the scheduled publishing job.
    flow := coalesce(new.analytics_flow_id::text, new.id::text);
    -- One first publication per listing; pausing/reactivating isn't a new job.
    if not exists (select 1 from product_events where name = 'job_published' and listing_id = new.id) then
      insert into product_events(name,role,flow_key,listing_id) values('job_published','employer',flow,new.id) on conflict do nothing;
    end if;
  end if;
  return new;
end $$;
revoke all on function public.capture_product_completion() from public, anon, authenticated;
create trigger analytics_registration after insert on public.profiles for each row execute function public.capture_product_completion();
create trigger analytics_application after insert on public.applications for each row execute function public.capture_product_completion();
create trigger analytics_publication after insert or update of status on public.internship_listings for each row execute function public.capture_product_completion();

create function public.admin_product_analytics(p_start timestamptz, p_end timestamptz, p_role text default 'all')
returns jsonb language plpgsql stable security definer set search_path = public as $$
declare result jsonb;
begin
  if not public.is_intern_first_admin(auth.uid()) then raise exception 'Forbidden' using errcode = '42501'; end if;
  if p_start is null or p_end is null or p_end <= p_start or p_end - p_start > interval '367 days' or p_role is null or p_role not in ('all','student','employer','anonymous') then raise exception 'Invalid filters'; end if;
  with filtered as (
    select * from product_events where created_at >= p_start and created_at < p_end and (p_role = 'all' or role = p_role)
  ), counts as (
    select name, role, count(*) as count from filtered group by name, role
  ), daily as (
    select to_char(created_at at time zone 'UTC','YYYY-MM-DD') as day,name,count(*) as count from filtered group by 1,2 order by 1,2
  ), ctas as (
    select cta,path,count(*) as count from filtered where name = 'cta_clicked' group by cta,path order by count(*) desc
  ), funnels as (
    select s.name,s.role,count(*) as started,
      count(*) filter (where exists (
        select 1 from product_events c where c.flow_key = s.flow_key and c.role = s.role
        and c.name = case s.name when 'registration_started' then 'registration_completed' when 'application_started' then 'application_completed' else 'job_published' end
        and c.created_at < p_end
      )) as completed
    from filtered s where s.name in ('registration_started','application_started','job_posting_started') group by s.name,s.role
  ) select jsonb_build_object(
    'events',coalesce((select jsonb_agg(counts) from counts),'[]'::jsonb),
    'daily',coalesce((select jsonb_agg(daily) from daily),'[]'::jsonb),
    'ctas',coalesce((select jsonb_agg(ctas) from ctas),'[]'::jsonb),
    'funnels',coalesce((select jsonb_agg(funnels) from funnels),'[]'::jsonb),
    'totals',jsonb_build_object(
      'registrations',(select count(*) from profiles where role in ('student','employer') and created_at >= p_start and created_at < p_end and (p_role = 'all' or role = p_role)),
      'applications',(select count(*) from applications where applied_at >= p_start and applied_at < p_end and p_role in ('all','student')),
      'listings',(select count(*) from internship_listings where created_at >= p_start and created_at < p_end and p_role in ('all','employer')),
      'uniqueListingViews',(select count(*) from listing_views where viewed_at >= p_start and viewed_at < p_end and p_role in ('all','student')),
      'waitlist',(select count(*) from waitlist where created_at >= p_start and created_at < p_end and (p_role = 'all' or role = p_role))
    )
  ) into result;
  return result;
end $$;
revoke all on function public.admin_product_analytics(timestamptz,timestamptz,text) from public, anon;
grant execute on function public.admin_product_analytics(timestamptz,timestamptz,text) to authenticated;
commit;
