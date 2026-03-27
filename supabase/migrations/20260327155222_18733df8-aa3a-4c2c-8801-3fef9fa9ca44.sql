CREATE TABLE public.metrika_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  counter_id text NOT NULL,
  date_from date NOT NULL,
  date_to date NOT NULL,
  visits_by_day jsonb NOT NULL DEFAULT '[]'::jsonb,
  total_visits integer NOT NULL DEFAULT 0,
  bounce_rate numeric(5,2) NOT NULL DEFAULT 0,
  page_depth numeric(5,2) NOT NULL DEFAULT 0,
  avg_duration_seconds integer NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.metrika_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage metrika_stats"
ON public.metrika_stats
FOR ALL
TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.projects
  WHERE projects.id = metrika_stats.project_id
    AND projects.owner_id = auth.uid()
));

CREATE INDEX idx_metrika_stats_project ON public.metrika_stats(project_id, fetched_at DESC);