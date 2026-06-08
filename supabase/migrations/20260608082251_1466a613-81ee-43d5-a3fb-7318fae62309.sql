-- Allow SEO role to manage all projects and CRM tasks (create, edit, assign anyone)
CREATE POLICY "Seo manage all projects"
ON public.projects
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'seo'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'seo'::app_role));

CREATE POLICY "Seo manage all crm_tasks"
ON public.crm_tasks
FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'seo'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'seo'::app_role));