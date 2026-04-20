ALTER TABLE public.notifications ALTER COLUMN project_id DROP NOT NULL;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'project';