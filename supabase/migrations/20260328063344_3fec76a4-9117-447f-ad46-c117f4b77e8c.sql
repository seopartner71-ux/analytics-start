
CREATE TABLE public.report_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  name text NOT NULL DEFAULT 'Default',
  modules jsonb NOT NULL DEFAULT '[]'::jsonb,
  default_period text NOT NULL DEFAULT 'currentMonth',
  show_comparison boolean NOT NULL DEFAULT true,
  client_logo_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.report_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage report_templates"
  ON public.report_templates
  FOR ALL
  TO public
  USING (
    EXISTS (
      SELECT 1 FROM public.projects
      WHERE projects.id = report_templates.project_id
        AND projects.owner_id = auth.uid()
    )
  );
