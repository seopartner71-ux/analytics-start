
-- 1. crawl_jobs
CREATE TABLE public.crawl_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL,
  user_id uuid NOT NULL,
  url text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  error_message text,
  started_at timestamptz,
  finished_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawl_jobs_project ON public.crawl_jobs(project_id);
CREATE INDEX idx_crawl_jobs_user ON public.crawl_jobs(user_id);
CREATE INDEX idx_crawl_jobs_status ON public.crawl_jobs(status);

ALTER TABLE public.crawl_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own crawl_jobs"
  ON public.crawl_jobs FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Project owners view crawl_jobs"
  ON public.crawl_jobs FOR SELECT
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = crawl_jobs.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Admins view all crawl_jobs"
  ON public.crawl_jobs FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 2. crawl_pages
CREATE TABLE public.crawl_pages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  url text NOT NULL,
  status_code integer,
  depth integer,
  title text,
  description text,
  h1 text,
  canonical text,
  is_indexed boolean,
  word_count integer,
  load_time_ms integer,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawl_pages_job ON public.crawl_pages(job_id);

ALTER TABLE public.crawl_pages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own crawl_pages"
  ON public.crawl_pages FOR ALL
  USING (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_pages.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_pages.job_id AND j.user_id = auth.uid()));

CREATE POLICY "Admins view all crawl_pages"
  ON public.crawl_pages FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 3. crawl_issues
CREATE TABLE public.crawl_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  page_id uuid REFERENCES public.crawl_pages(id) ON DELETE CASCADE,
  type text NOT NULL,
  severity text NOT NULL DEFAULT 'info',
  code text NOT NULL,
  message text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_crawl_issues_job ON public.crawl_issues(job_id);
CREATE INDEX idx_crawl_issues_page ON public.crawl_issues(page_id);
CREATE INDEX idx_crawl_issues_severity ON public.crawl_issues(severity);

ALTER TABLE public.crawl_issues ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own crawl_issues"
  ON public.crawl_issues FOR ALL
  USING (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_issues.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_issues.job_id AND j.user_id = auth.uid()));

CREATE POLICY "Admins view all crawl_issues"
  ON public.crawl_issues FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- 4. crawl_stats
CREATE TABLE public.crawl_stats (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id uuid NOT NULL UNIQUE REFERENCES public.crawl_jobs(id) ON DELETE CASCADE,
  total_pages integer NOT NULL DEFAULT 0,
  total_issues integer NOT NULL DEFAULT 0,
  critical_count integer NOT NULL DEFAULT 0,
  warning_count integer NOT NULL DEFAULT 0,
  info_count integer NOT NULL DEFAULT 0,
  avg_load_time_ms integer NOT NULL DEFAULT 0,
  score integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.crawl_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users access own crawl_stats"
  ON public.crawl_stats FOR ALL
  USING (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_stats.job_id AND j.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.crawl_jobs j WHERE j.id = crawl_stats.job_id AND j.user_id = auth.uid()));

CREATE POLICY "Admins view all crawl_stats"
  ON public.crawl_stats FOR SELECT TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));

-- Realtime
ALTER TABLE public.crawl_jobs REPLICA IDENTITY FULL;
ALTER TABLE public.crawl_pages REPLICA IDENTITY FULL;
ALTER TABLE public.crawl_issues REPLICA IDENTITY FULL;
ALTER TABLE public.crawl_stats REPLICA IDENTITY FULL;

ALTER PUBLICATION supabase_realtime ADD TABLE public.crawl_jobs;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crawl_pages;
ALTER TABLE public.crawl_pages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crawl_issues;
ALTER PUBLICATION supabase_realtime ADD TABLE public.crawl_stats;
