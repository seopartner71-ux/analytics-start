ALTER TABLE public.projects 
ADD COLUMN IF NOT EXISTS topvisor_user_id TEXT,
ADD COLUMN IF NOT EXISTS topvisor_api_key TEXT,
ADD COLUMN IF NOT EXISTS topvisor_project_id TEXT;