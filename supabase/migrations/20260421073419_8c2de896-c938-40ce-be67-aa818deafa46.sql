
-- Periods (monthly buckets per project)
CREATE TABLE public.project_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  year integer NOT NULL,
  month integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  title text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, year, month)
);
CREATE INDEX idx_project_periods_project ON public.project_periods(project_id);

ALTER TABLE public.project_periods ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage project_periods" ON public.project_periods
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Project owners manage project_periods" ON public.project_periods
  FOR ALL
  USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_periods.project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_periods.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Managers view assigned project_periods" ON public.project_periods
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.projects p
    JOIN public.team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE p.id = project_periods.project_id AND tm.owner_id = auth.uid()
  ));

CREATE TRIGGER trg_project_periods_updated
  BEFORE UPDATE ON public.project_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Tasks within a period
CREATE TABLE public.period_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_id uuid NOT NULL REFERENCES public.project_periods(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'general',
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  deadline date,
  required boolean NOT NULL DEFAULT false,
  instruction_article_id uuid REFERENCES public.knowledge_articles(id) ON DELETE SET NULL,
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_period_tasks_period ON public.period_tasks(period_id);

ALTER TABLE public.period_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage period_tasks" ON public.period_tasks
  FOR ALL TO authenticated
  USING (has_role(auth.uid(),'admin'::app_role))
  WITH CHECK (has_role(auth.uid(),'admin'::app_role));

CREATE POLICY "Owner manages via period" ON public.period_tasks
  FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.project_periods pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = period_tasks.period_id AND p.owner_id = auth.uid()
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.project_periods pp
    JOIN public.projects p ON p.id = pp.project_id
    WHERE pp.id = period_tasks.period_id AND p.owner_id = auth.uid()
  ));

CREATE POLICY "Managers view via period" ON public.period_tasks
  FOR SELECT TO authenticated
  USING (has_role(auth.uid(),'manager'::app_role) AND EXISTS (
    SELECT 1 FROM public.project_periods pp
    JOIN public.projects p ON p.id = pp.project_id
    JOIN public.team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE pp.id = period_tasks.period_id AND tm.owner_id = auth.uid()
  ));

CREATE TRIGGER trg_period_tasks_updated
  BEFORE UPDATE ON public.period_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
