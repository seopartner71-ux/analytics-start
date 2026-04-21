ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS report_period text NOT NULL DEFAULT 'monthly',
  ADD COLUMN IF NOT EXISTS report_day integer NOT NULL DEFAULT 1;

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_report_period_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_report_period_check
  CHECK (report_period IN ('monthly','weekly','quarterly','custom'));

ALTER TABLE public.projects
  DROP CONSTRAINT IF EXISTS projects_report_day_check;
ALTER TABLE public.projects
  ADD CONSTRAINT projects_report_day_check
  CHECK (report_day BETWEEN 1 AND 28);