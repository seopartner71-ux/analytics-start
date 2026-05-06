ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS source_type text,
  ADD COLUMN IF NOT EXISTS source_id text;

CREATE INDEX IF NOT EXISTS idx_crm_tasks_source ON public.crm_tasks(source_type, source_id) WHERE source_type IS NOT NULL;