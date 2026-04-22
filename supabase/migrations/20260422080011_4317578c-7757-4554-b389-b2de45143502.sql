-- Расширяем права на удаление period_tasks и project_periods для директоров и менеджеров проекта

-- Директоры могут управлять period_tasks
DROP POLICY IF EXISTS "Directors manage period_tasks" ON public.period_tasks;
CREATE POLICY "Directors manage period_tasks"
ON public.period_tasks
FOR ALL
USING (has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'director'::app_role));

-- Менеджеры могут управлять period_tasks в своих проектах (а не только просматривать)
DROP POLICY IF EXISTS "Managers view via period" ON public.period_tasks;
DROP POLICY IF EXISTS "Managers manage period_tasks via project" ON public.period_tasks;
CREATE POLICY "Managers manage period_tasks via project"
ON public.period_tasks
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM project_periods pp
    JOIN projects p ON p.id = pp.project_id
    JOIN team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE pp.id = period_tasks.period_id AND tm.owner_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM project_periods pp
    JOIN projects p ON p.id = pp.project_id
    JOIN team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE pp.id = period_tasks.period_id AND tm.owner_id = auth.uid()
  )
);

-- Директоры управляют project_periods
DROP POLICY IF EXISTS "Directors manage project_periods" ON public.project_periods;
CREATE POLICY "Directors manage project_periods"
ON public.project_periods
FOR ALL
USING (has_role(auth.uid(), 'director'::app_role))
WITH CHECK (has_role(auth.uid(), 'director'::app_role));

-- Менеджеры управляют project_periods своих проектов (вместо только SELECT)
DROP POLICY IF EXISTS "Managers view assigned project_periods" ON public.project_periods;
DROP POLICY IF EXISTS "Managers manage assigned project_periods" ON public.project_periods;
CREATE POLICY "Managers manage assigned project_periods"
ON public.project_periods
FOR ALL
USING (
  has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE p.id = project_periods.project_id AND tm.owner_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
    SELECT 1 FROM projects p
    JOIN team_members tm ON tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id
    WHERE p.id = project_periods.project_id AND tm.owner_id = auth.uid()
  )
);

-- При удалении периода каскадно удаляем его задачи
ALTER TABLE public.period_tasks
  DROP CONSTRAINT IF EXISTS period_tasks_period_id_fkey;
ALTER TABLE public.period_tasks
  ADD CONSTRAINT period_tasks_period_id_fkey
  FOREIGN KEY (period_id) REFERENCES public.project_periods(id) ON DELETE CASCADE;