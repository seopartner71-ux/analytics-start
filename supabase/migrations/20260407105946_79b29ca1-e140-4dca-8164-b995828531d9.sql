
-- Table: project_analytics (monthly traffic/position snapshots per project)
CREATE TABLE public.project_analytics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  month DATE NOT NULL,
  organic_traffic INTEGER NOT NULL DEFAULT 0,
  avg_position NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage project_analytics"
  ON public.project_analytics FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_analytics.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins can view all project_analytics"
  ON public.project_analytics FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table: project_keywords (keyword positions per project)
CREATE TABLE public.project_keywords (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  keyword TEXT NOT NULL,
  position INTEGER NOT NULL DEFAULT 0,
  position_change INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.project_keywords ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage project_keywords"
  ON public.project_keywords FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = project_keywords.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins can view all project_keywords"
  ON public.project_keywords FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
