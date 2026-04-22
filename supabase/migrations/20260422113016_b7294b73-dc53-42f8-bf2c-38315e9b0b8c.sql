-- Allow project members (via project_members) to view all analytics for their projects
-- Integrations: VIEW only (admins/owners/directors still manage)

-- metrika_stats
CREATE POLICY "Project members view metrika_stats"
ON public.metrika_stats FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- gsc_daily_stats
CREATE POLICY "Project members view gsc_daily_stats"
ON public.gsc_daily_stats FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- gsc_pages
CREATE POLICY "Project members view gsc_pages"
ON public.gsc_pages FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- gsc_queries
CREATE POLICY "Project members view gsc_queries"
ON public.gsc_queries FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- audit_checks
CREATE POLICY "Project members view audit_checks"
ON public.audit_checks FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- audit_url_errors (via audit_checks -> project)
CREATE POLICY "Project members view audit_url_errors"
ON public.audit_url_errors FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.audit_checks ac
  WHERE ac.id = audit_url_errors.audit_check_id
    AND public.is_project_member(ac.project_id, auth.uid())
));

-- crawl_jobs
CREATE POLICY "Project members view crawl_jobs"
ON public.crawl_jobs FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- crawl_pages (via crawl_jobs -> project)
CREATE POLICY "Project members view crawl_pages"
ON public.crawl_pages FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_pages.job_id
    AND public.is_project_member(j.project_id, auth.uid())
));

-- crawl_issues
CREATE POLICY "Project members view crawl_issues"
ON public.crawl_issues FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_issues.job_id
    AND public.is_project_member(j.project_id, auth.uid())
));

-- crawl_stats
CREATE POLICY "Project members view crawl_stats"
ON public.crawl_stats FOR SELECT TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_stats.job_id
    AND public.is_project_member(j.project_id, auth.uid())
));

-- link_profile
CREATE POLICY "Project members view link_profile"
ON public.link_profile FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- cached_reports
CREATE POLICY "Project members view cached_reports"
ON public.cached_reports FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));

-- integrations: VIEW only for project members (no insert/update/delete — those remain for owner/admin/director)
CREATE POLICY "Project members view integrations"
ON public.integrations FOR SELECT TO authenticated
USING (public.is_project_member(project_id, auth.uid()));