-- Lightweight query for the keep-alive workflow: the free plan pauses projects
-- after 7 days of low activity. Exposes no data, so anon may call it.
create function public.ping()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$
  select now();
$$;

revoke execute on function public.ping() from public;
grant execute on function public.ping() to anon, authenticated;
