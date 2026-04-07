
-- Managers can view assigned projects
CREATE POLICY "Managers can view assigned projects"
ON public.projects FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = auth.uid()
      AND (tm.id = projects.seo_specialist_id OR tm.id = projects.account_manager_id)
    )
  )
);

-- Viewers can view assigned projects
CREATE POLICY "Viewers can view assigned projects"
ON public.projects FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'viewer') AND (
    EXISTS (
      SELECT 1 FROM public.team_members tm
      WHERE tm.owner_id = auth.uid()
      AND (tm.id = projects.seo_specialist_id OR tm.id = projects.account_manager_id)
    )
  )
);

-- Managers manage tasks on assigned projects
CREATE POLICY "Managers manage tasks on assigned projects"
ON public.crm_tasks FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
      WHERE p.id = crm_tasks.project_id AND tm.owner_id = auth.uid()
    )
  )
);

-- Managers manage comments on assigned projects
CREATE POLICY "Managers manage comments on assigned projects"
ON public.project_comments FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
      WHERE p.id = project_comments.project_id AND tm.owner_id = auth.uid()
    )
  )
);

-- Managers manage files on assigned projects
CREATE POLICY "Managers manage files on assigned projects"
ON public.project_files FOR ALL TO authenticated
USING (
  public.has_role(auth.uid(), 'manager') AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
      WHERE p.id = project_files.project_id AND tm.owner_id = auth.uid()
    )
  )
);

-- Viewers read comments on assigned projects
CREATE POLICY "Viewers read comments on assigned projects"
ON public.project_comments FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'viewer') AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
      WHERE p.id = project_comments.project_id AND tm.owner_id = auth.uid()
    )
  )
);

-- Viewers read files on assigned projects
CREATE POLICY "Viewers read files on assigned projects"
ON public.project_files FOR SELECT TO authenticated
USING (
  public.has_role(auth.uid(), 'viewer') AND (
    EXISTS (
      SELECT 1 FROM public.projects p
      JOIN public.team_members tm ON (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
      WHERE p.id = project_files.project_id AND tm.owner_id = auth.uid()
    )
  )
);

-- Admins manage user_roles
CREATE POLICY "Admins manage all roles"
ON public.user_roles FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'));
