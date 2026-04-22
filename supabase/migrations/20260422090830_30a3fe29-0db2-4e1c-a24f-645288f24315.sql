CREATE OR REPLACE FUNCTION public.task_is_expired(_deadline timestamptz, _status public.task_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  SELECT _deadline IS NOT NULL
     AND _deadline < now()
     AND _status NOT IN ('completed'::public.task_status, 'deferred'::public.task_status);
$$;