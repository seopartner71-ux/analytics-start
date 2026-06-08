
CREATE TABLE public.project_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  due_date date NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','in_progress','sent','overdue','cancelled')),
  comment text NOT NULL DEFAULT '',
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  assignee_user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  reminder_2d_sent boolean NOT NULL DEFAULT false,
  reminder_1d_sent boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_reports_due_date ON public.project_reports(due_date);
CREATE INDEX idx_project_reports_owner ON public.project_reports(owner_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.project_reports TO authenticated;
GRANT ALL ON public.project_reports TO service_role;

ALTER TABLE public.project_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view reports" ON public.project_reports
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Authenticated can insert reports" ON public.project_reports
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Authenticated can update reports" ON public.project_reports
  FOR UPDATE TO authenticated USING (true);
CREATE POLICY "Owners can delete reports" ON public.project_reports
  FOR DELETE TO authenticated USING (auth.uid() = owner_id);

CREATE TRIGGER trg_project_reports_updated_at
  BEFORE UPDATE ON public.project_reports
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
