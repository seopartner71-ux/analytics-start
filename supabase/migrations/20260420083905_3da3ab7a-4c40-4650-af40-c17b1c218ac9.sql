-- 1. Добавляем поля недели в crm_tasks
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS week_number int,
  ADD COLUMN IF NOT EXISTS week_year int;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_week
  ON public.crm_tasks (project_id, week_year, week_number);

-- Триггер: автозаполнение из deadline (ISO-неделя)
CREATE OR REPLACE FUNCTION public.set_crm_task_week()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.deadline IS NOT NULL THEN
    NEW.week_number := EXTRACT(ISOYEAR FROM (NEW.deadline AT TIME ZONE 'Europe/Moscow'))::int * 0 + EXTRACT(WEEK FROM (NEW.deadline AT TIME ZONE 'Europe/Moscow'))::int;
    NEW.week_year   := EXTRACT(ISOYEAR FROM (NEW.deadline AT TIME ZONE 'Europe/Moscow'))::int;
  ELSE
    NEW.week_number := NULL;
    NEW.week_year := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_set_crm_task_week ON public.crm_tasks;
CREATE TRIGGER trg_set_crm_task_week
BEFORE INSERT OR UPDATE OF deadline ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.set_crm_task_week();

-- Заполняем существующие
UPDATE public.crm_tasks
SET week_number = EXTRACT(WEEK FROM (deadline AT TIME ZONE 'Europe/Moscow'))::int,
    week_year   = EXTRACT(ISOYEAR FROM (deadline AT TIME ZONE 'Europe/Moscow'))::int
WHERE deadline IS NOT NULL AND (week_number IS NULL OR week_year IS NULL);

-- 2. Таблица weekly_reports
CREATE TABLE IF NOT EXISTS public.weekly_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  week_number int NOT NULL,
  week_year int NOT NULL,
  week_start date NOT NULL,
  week_end date NOT NULL,
  status text NOT NULL DEFAULT 'draft', -- draft | sent
  planned_items jsonb NOT NULL DEFAULT '[]'::jsonb,  -- [{id, title, source, hidden}]
  done_items jsonb NOT NULL DEFAULT '[]'::jsonb,     -- [{title, status, source}]
  metrics jsonb NOT NULL DEFAULT '{}'::jsonb,        -- {positions_text, traffic_text, custom}
  manager_comment text NOT NULL DEFAULT '',
  share_token text NOT NULL DEFAULT replace(gen_random_uuid()::text, '-', ''),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  sent_at timestamptz,
  UNIQUE (project_id, week_year, week_number)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_reports_share_token
  ON public.weekly_reports (share_token);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_project
  ON public.weekly_reports (project_id, week_year DESC, week_number DESC);

-- updated_at trigger
DROP TRIGGER IF EXISTS trg_weekly_reports_updated_at ON public.weekly_reports;
CREATE TRIGGER trg_weekly_reports_updated_at
BEFORE UPDATE ON public.weekly_reports
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.weekly_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project participants manage weekly_reports"
ON public.weekly_reports
FOR ALL
TO authenticated
USING (public.is_project_participant(project_id, auth.uid()))
WITH CHECK (public.is_project_participant(project_id, auth.uid()));

CREATE POLICY "Admins manage weekly_reports"
ON public.weekly_reports
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'::public.app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Публичный доступ через security definer функцию
CREATE OR REPLACE FUNCTION public.get_weekly_report_by_token(p_token text)
RETURNS TABLE (
  id uuid,
  project_id uuid,
  project_name text,
  week_number int,
  week_year int,
  week_start date,
  week_end date,
  status text,
  planned_items jsonb,
  done_items jsonb,
  metrics jsonb,
  manager_comment text,
  sent_at timestamptz
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT wr.id, wr.project_id, p.name, wr.week_number, wr.week_year,
         wr.week_start, wr.week_end, wr.status, wr.planned_items,
         wr.done_items, wr.metrics, wr.manager_comment, wr.sent_at
  FROM public.weekly_reports wr
  JOIN public.projects p ON p.id = wr.project_id
  WHERE wr.share_token = p_token AND wr.status = 'sent';
$$;

GRANT EXECUTE ON FUNCTION public.get_weekly_report_by_token(text) TO anon, authenticated;

-- 3. pg_cron + pg_net
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;