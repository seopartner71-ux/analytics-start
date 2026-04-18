-- Add gsc_site_url to projects
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS gsc_site_url text;

-- gsc_queries: top search queries cache
CREATE TABLE IF NOT EXISTS public.gsc_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  query text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  date_from date NOT NULL,
  date_to date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gsc_queries_project ON public.gsc_queries(project_id, date_from, date_to);

ALTER TABLE public.gsc_queries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage gsc_queries"
ON public.gsc_queries FOR ALL
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = gsc_queries.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Admins view gsc_queries"
ON public.gsc_queries FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- gsc_pages: top pages cache
CREATE TABLE IF NOT EXISTS public.gsc_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  page_url text NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  date_from date NOT NULL,
  date_to date NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_gsc_pages_project ON public.gsc_pages(project_id, date_from, date_to);

ALTER TABLE public.gsc_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage gsc_pages"
ON public.gsc_pages FOR ALL
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = gsc_pages.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Admins view gsc_pages"
ON public.gsc_pages FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

-- gsc_daily_stats: time series
CREATE TABLE IF NOT EXISTS public.gsc_daily_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  stat_date date NOT NULL,
  clicks integer NOT NULL DEFAULT 0,
  impressions integer NOT NULL DEFAULT 0,
  ctr numeric NOT NULL DEFAULT 0,
  position numeric NOT NULL DEFAULT 0,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, stat_date)
);
CREATE INDEX IF NOT EXISTS idx_gsc_daily_project ON public.gsc_daily_stats(project_id, stat_date);

ALTER TABLE public.gsc_daily_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage gsc_daily_stats"
ON public.gsc_daily_stats FOR ALL
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = gsc_daily_stats.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Admins view gsc_daily_stats"
ON public.gsc_daily_stats FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));