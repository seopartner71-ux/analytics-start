-- 1) Директор автоматически имеет "all_projects_access"
CREATE OR REPLACE FUNCTION public.has_all_projects_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    public.has_role(_user_id, 'admin'::app_role)
    OR public.has_role(_user_id, 'director'::app_role)
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.user_id = _user_id AND p.all_projects_access = true
    );
$$;

-- 2) Хелпер: admin ИЛИ director
CREATE OR REPLACE FUNCTION public.is_admin_or_director(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin'::app_role)
      OR public.has_role(_user_id, 'director'::app_role);
$$;

-- 3) Расширяем политики "Admins ..." до admin+director на рабочих таблицах.
--    Управление пользователями (profiles UPDATE, user_roles, project_members) НЕ трогаем — остаётся только admin.

-- projects: добавим явную политику для director (read-all + manage-all через owner_id-логику в коде/RLS)
DROP POLICY IF EXISTS "Directors view all projects" ON public.projects;
CREATE POLICY "Directors view all projects"
ON public.projects FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors manage all projects" ON public.projects;
CREATE POLICY "Directors manage all projects"
ON public.projects FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- crm_tasks
DROP POLICY IF EXISTS "Directors manage all crm_tasks" ON public.crm_tasks;
CREATE POLICY "Directors manage all crm_tasks"
ON public.crm_tasks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- audit_checks
DROP POLICY IF EXISTS "Directors manage audit_checks" ON public.audit_checks;
CREATE POLICY "Directors manage audit_checks"
ON public.audit_checks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- audit_url_errors
DROP POLICY IF EXISTS "Directors manage audit_url_errors" ON public.audit_url_errors;
CREATE POLICY "Directors manage audit_url_errors"
ON public.audit_url_errors FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- link_profile
DROP POLICY IF EXISTS "Directors manage link_profile" ON public.link_profile;
CREATE POLICY "Directors manage link_profile"
ON public.link_profile FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- knowledge_articles
DROP POLICY IF EXISTS "Directors manage knowledge_articles" ON public.knowledge_articles;
CREATE POLICY "Directors manage knowledge_articles"
ON public.knowledge_articles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- knowledge_books
DROP POLICY IF EXISTS "Directors manage knowledge_books" ON public.knowledge_books;
CREATE POLICY "Directors manage knowledge_books"
ON public.knowledge_books FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- knowledge_chunks
DROP POLICY IF EXISTS "Directors manage knowledge_chunks" ON public.knowledge_chunks;
CREATE POLICY "Directors manage knowledge_chunks"
ON public.knowledge_chunks FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- integrations
DROP POLICY IF EXISTS "Directors manage integrations" ON public.integrations;
CREATE POLICY "Directors manage integrations"
ON public.integrations FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- gsc_*
DROP POLICY IF EXISTS "Directors manage gsc_daily_stats" ON public.gsc_daily_stats;
CREATE POLICY "Directors manage gsc_daily_stats"
ON public.gsc_daily_stats FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors manage gsc_pages" ON public.gsc_pages;
CREATE POLICY "Directors manage gsc_pages"
ON public.gsc_pages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors manage gsc_queries" ON public.gsc_queries;
CREATE POLICY "Directors manage gsc_queries"
ON public.gsc_queries FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- crawl_*
DROP POLICY IF EXISTS "Directors manage crawl_jobs" ON public.crawl_jobs;
CREATE POLICY "Directors manage crawl_jobs"
ON public.crawl_jobs FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors manage crawl_pages" ON public.crawl_pages;
CREATE POLICY "Directors manage crawl_pages"
ON public.crawl_pages FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors manage crawl_issues" ON public.crawl_issues;
CREATE POLICY "Directors manage crawl_issues"
ON public.crawl_issues FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

DROP POLICY IF EXISTS "Directors manage crawl_stats" ON public.crawl_stats;
CREATE POLICY "Directors manage crawl_stats"
ON public.crawl_stats FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- cached_reports
DROP POLICY IF EXISTS "Directors manage cached_reports" ON public.cached_reports;
CREATE POLICY "Directors manage cached_reports"
ON public.cached_reports FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- companies
DROP POLICY IF EXISTS "Directors manage companies" ON public.companies;
CREATE POLICY "Directors manage companies"
ON public.companies FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'director'::app_role));

-- profiles SELECT — директор должен видеть всех пользователей (для назначений)
DROP POLICY IF EXISTS "Directors view profiles" ON public.profiles;
CREATE POLICY "Directors view profiles"
ON public.profiles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));

-- project_members SELECT — директор должен видеть состав команд
DROP POLICY IF EXISTS "Directors view project_members" ON public.project_members;
CREATE POLICY "Directors view project_members"
ON public.project_members FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));

-- user_roles SELECT — директор видит роли (но не меняет)
DROP POLICY IF EXISTS "Directors view user_roles" ON public.user_roles;
CREATE POLICY "Directors view user_roles"
ON public.user_roles FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'director'::app_role));