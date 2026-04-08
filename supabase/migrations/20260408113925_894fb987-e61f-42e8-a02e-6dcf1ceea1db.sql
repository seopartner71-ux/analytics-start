
-- Table for audit checks
CREATE TABLE public.audit_checks (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  check_number text NOT NULL,
  check_name text NOT NULL,
  section text NOT NULL DEFAULT 'technical',
  importance text NOT NULL DEFAULT 'medium',
  difficulty text NOT NULL DEFAULT 'medium',
  check_type text NOT NULL DEFAULT 'auto',
  external_url text,
  result text NOT NULL DEFAULT 'unchecked',
  comment text,
  status text NOT NULL DEFAULT 'new',
  assigned_to uuid REFERENCES public.team_members(id),
  audit_date timestamp with time zone NOT NULL DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_checks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage audit_checks"
  ON public.audit_checks FOR ALL
  USING (EXISTS (SELECT 1 FROM projects WHERE projects.id = audit_checks.project_id AND projects.owner_id = auth.uid()));

CREATE POLICY "Admins can view all audit_checks"
  ON public.audit_checks FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Table for audit URL errors (sub-rows)
CREATE TABLE public.audit_url_errors (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  audit_check_id uuid NOT NULL REFERENCES public.audit_checks(id) ON DELETE CASCADE,
  url text NOT NULL DEFAULT '',
  error_detail text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_url_errors ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Access via audit_checks owner"
  ON public.audit_url_errors FOR ALL
  USING (EXISTS (
    SELECT 1 FROM audit_checks ac
    JOIN projects p ON p.id = ac.project_id
    WHERE ac.id = audit_url_errors.audit_check_id AND p.owner_id = auth.uid()
  ));

CREATE POLICY "Admins can view all audit_url_errors"
  ON public.audit_url_errors FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
