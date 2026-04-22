CREATE POLICY "Project members manage site_health"
ON public.site_health FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

CREATE POLICY "Project members manage site_errors"
ON public.site_errors FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));