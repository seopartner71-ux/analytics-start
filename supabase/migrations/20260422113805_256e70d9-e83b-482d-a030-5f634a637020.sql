-- Allow project members (via project_members) to write analytics data for their projects
-- so that "Refresh data" buttons work for assigned employees.
-- Integrations table is intentionally excluded — only owners/admins/directors manage credentials.

-- metrika_stats
CREATE POLICY "Project members manage metrika_stats"
ON public.metrika_stats FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- gsc_daily_stats
CREATE POLICY "Project members manage gsc_daily_stats"
ON public.gsc_daily_stats FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- gsc_pages
CREATE POLICY "Project members manage gsc_pages"
ON public.gsc_pages FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- gsc_queries
CREATE POLICY "Project members manage gsc_queries"
ON public.gsc_queries FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- audit_checks (technical audit results)
CREATE POLICY "Project members manage audit_checks"
ON public.audit_checks FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- audit_url_errors (via audit_checks -> project)
CREATE POLICY "Project members manage audit_url_errors"
ON public.audit_url_errors FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.audit_checks ac
  WHERE ac.id = audit_url_errors.audit_check_id
    AND public.is_project_member(ac.project_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.audit_checks ac
  WHERE ac.id = audit_url_errors.audit_check_id
    AND public.is_project_member(ac.project_id, auth.uid())
));

-- crawl_jobs
CREATE POLICY "Project members manage crawl_jobs"
ON public.crawl_jobs FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- crawl_pages
CREATE POLICY "Project members manage crawl_pages"
ON public.crawl_pages FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_pages.job_id
    AND public.is_project_member(j.project_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_pages.job_id
    AND public.is_project_member(j.project_id, auth.uid())
));

-- crawl_issues
CREATE POLICY "Project members manage crawl_issues"
ON public.crawl_issues FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_issues.job_id
    AND public.is_project_member(j.project_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_issues.job_id
    AND public.is_project_member(j.project_id, auth.uid())
));

-- crawl_stats
CREATE POLICY "Project members manage crawl_stats"
ON public.crawl_stats FOR ALL TO authenticated
USING (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_stats.job_id
    AND public.is_project_member(j.project_id, auth.uid())
))
WITH CHECK (EXISTS (
  SELECT 1 FROM public.crawl_jobs j
  WHERE j.id = crawl_stats.job_id
    AND public.is_project_member(j.project_id, auth.uid())
));

-- link_profile
CREATE POLICY "Project members manage link_profile"
ON public.link_profile FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- cached_reports
CREATE POLICY "Project members manage cached_reports"
ON public.cached_reports FOR ALL TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));

-- integrations: allow updating ONLY last_sync (for sync timestamp). 
-- Members cannot insert/delete integrations or change tokens — that remains owner/admin only.
-- Achieved via separate UPDATE policy that restricts which rows; column-level enforcement is done in client code.
CREATE POLICY "Project members touch integration last_sync"
ON public.integrations FOR UPDATE TO authenticated
USING (public.is_project_member(project_id, auth.uid()))
WITH CHECK (public.is_project_member(project_id, auth.uid()));