-- Correct installations of the initial report function; safe after the corrected base migration.
do $fix$
declare definition text;
begin
  select pg_get_functiondef('public.admin_product_analytics(timestamptz,timestamptz,text)'::regprocedure) into definition;
  definition := regexp_replace(definition,
    'from applications where created_at[[:space:]]*>=[[:space:]]*p_start and created_at[[:space:]]*<[[:space:]]*p_end',
    'from applications where applied_at >= p_start and applied_at < p_end');
  execute definition;
end $fix$;
