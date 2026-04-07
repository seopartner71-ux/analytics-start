
CREATE TABLE public.site_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'yandex',
  metric_name TEXT NOT NULL,
  metric_value TEXT NOT NULL DEFAULT '0',
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.site_health ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage site_health"
  ON public.site_health FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = site_health.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins can view all site_health"
  ON public.site_health FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.site_errors (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  source TEXT NOT NULL DEFAULT 'yandex',
  error_type TEXT NOT NULL,
  url TEXT NOT NULL DEFAULT '',
  detected_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'Новая'
);

ALTER TABLE public.site_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage site_errors"
  ON public.site_errors FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = site_errors.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins can view all site_errors"
  ON public.site_errors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
