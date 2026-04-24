-- Связь периодов с недельными отчётами и явная неделя выполнения для задач периода
ALTER TABLE public.period_tasks
  ADD COLUMN IF NOT EXISTS week_number int,
  ADD COLUMN IF NOT EXISTS week_start date,
  ADD COLUMN IF NOT EXISTS week_end date;

ALTER TABLE public.weekly_reports
  ADD COLUMN IF NOT EXISTS period_id uuid REFERENCES public.project_periods(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_period_tasks_week
  ON public.period_tasks (period_id, week_start, week_end);

CREATE INDEX IF NOT EXISTS idx_weekly_reports_period
  ON public.weekly_reports (period_id);