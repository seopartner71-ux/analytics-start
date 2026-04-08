
CREATE TABLE public.yandex_webmaster_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  check_number text NOT NULL,
  check_name text NOT NULL,
  section text NOT NULL DEFAULT 'possible',
  api_field text,
  status text NOT NULL DEFAULT 'not_checked',
  error_details_json jsonb,
  task_text text,
  task_status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES public.team_members(id),
  synced_at timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.yandex_webmaster_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage yandex_webmaster_checks"
  ON public.yandex_webmaster_checks FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = yandex_webmaster_checks.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins view all yandex_webmaster_checks"
  ON public.yandex_webmaster_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE TABLE public.yandex_webmaster_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  indexed_pages integer NOT NULL DEFAULT 0,
  excluded_pages integer NOT NULL DEFAULT 0,
  total_queries integer NOT NULL DEFAULT 0,
  avg_position numeric NOT NULL DEFAULT 0,
  avg_ctr numeric NOT NULL DEFAULT 0,
  external_links integer NOT NULL DEFAULT 0,
  referring_domains integer NOT NULL DEFAULT 0,
  snapshot_date date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.yandex_webmaster_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage yandex_webmaster_snapshots"
  ON public.yandex_webmaster_snapshots FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = yandex_webmaster_snapshots.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins view all yandex_webmaster_snapshots"
  ON public.yandex_webmaster_snapshots FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
