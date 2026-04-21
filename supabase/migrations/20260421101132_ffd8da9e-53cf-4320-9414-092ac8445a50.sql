CREATE TABLE IF NOT EXISTS public.user_time_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  log_date date NOT NULL,
  active_seconds integer NOT NULL DEFAULT 0,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_user_time_logs_date ON public.user_time_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_user_time_logs_user_date ON public.user_time_logs(user_id, log_date);

ALTER TABLE public.user_time_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own time logs" ON public.user_time_logs;
CREATE POLICY "Users view own time logs"
ON public.user_time_logs FOR SELECT TO authenticated
USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins view all time logs" ON public.user_time_logs;
CREATE POLICY "Admins view all time logs"
ON public.user_time_logs FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role));

-- RPC: безопасно прибавляет секунды к сегодняшней записи пользователя
CREATE OR REPLACE FUNCTION public.increment_time(p_seconds integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user uuid := auth.uid();
  v_date date := (now() AT TIME ZONE 'UTC')::date;
BEGIN
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;
  IF p_seconds IS NULL OR p_seconds <= 0 OR p_seconds > 600 THEN
    RETURN; -- защитный лимит на одну транзакцию: не более 10 минут
  END IF;

  INSERT INTO public.user_time_logs (user_id, log_date, active_seconds)
  VALUES (v_user, v_date, p_seconds)
  ON CONFLICT (user_id, log_date)
  DO UPDATE SET
    active_seconds = public.user_time_logs.active_seconds + EXCLUDED.active_seconds,
    updated_at = now();
END;
$$;

REVOKE ALL ON FUNCTION public.increment_time(integer) FROM public;
GRANT EXECUTE ON FUNCTION public.increment_time(integer) TO authenticated;