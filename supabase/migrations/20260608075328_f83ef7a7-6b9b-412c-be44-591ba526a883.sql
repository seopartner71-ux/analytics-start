
ALTER TABLE public.project_reports
  ADD COLUMN IF NOT EXISTS co_assignee_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];
