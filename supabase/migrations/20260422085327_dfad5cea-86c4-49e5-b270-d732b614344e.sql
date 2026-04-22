ALTER TABLE public.project_periods
ADD COLUMN IF NOT EXISTS crm_task_id uuid REFERENCES public.crm_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_project_periods_crm_task_id ON public.project_periods(crm_task_id);