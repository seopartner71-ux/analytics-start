CREATE TABLE public.project_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  category text NOT NULL DEFAULT 'other',
  title text NOT NULL,
  url text,
  login text,
  password text,
  notes text,
  tags text[] NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.project_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own credentials" ON public.project_credentials
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins and directors view all credentials" ON public.project_credentials
  FOR SELECT TO authenticated USING (public.is_admin_or_director(auth.uid()));

CREATE POLICY "Admins and directors manage all credentials" ON public.project_credentials
  FOR ALL TO authenticated USING (public.is_admin_or_director(auth.uid())) WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE POLICY "Project owners view project credentials" ON public.project_credentials
  FOR SELECT USING (
    project_id IS NOT NULL AND EXISTS (
      SELECT 1 FROM public.projects p WHERE p.id = project_credentials.project_id AND p.owner_id = auth.uid()
    )
  );

CREATE INDEX idx_project_credentials_project ON public.project_credentials(project_id);
CREATE INDEX idx_project_credentials_owner ON public.project_credentials(owner_id);

CREATE TRIGGER update_project_credentials_updated_at
  BEFORE UPDATE ON public.project_credentials
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();