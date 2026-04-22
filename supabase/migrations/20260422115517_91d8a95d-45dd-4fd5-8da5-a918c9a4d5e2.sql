-- Allow assigned team members to view (and update status of) their tasks.
-- Связь "user → team_member" определяется через email (в team_members нет user_id),
-- либо через owner_id (если запись team_member создал сам пользователь).

CREATE OR REPLACE FUNCTION public.is_task_assignee(_task_assignee uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.team_members tm
    LEFT JOIN auth.users u ON u.id = _user_id
    WHERE tm.id = _task_assignee
      AND (
        tm.owner_id = _user_id
        OR (u.email IS NOT NULL AND lower(tm.email) = lower(u.email))
      )
  );
$$;

DROP POLICY IF EXISTS "Assignees can view their tasks" ON public.crm_tasks;
CREATE POLICY "Assignees can view their tasks"
ON public.crm_tasks
FOR SELECT
TO authenticated
USING (
  assignee_id IS NOT NULL
  AND public.is_task_assignee(assignee_id, auth.uid())
);

DROP POLICY IF EXISTS "Assignees can update their tasks" ON public.crm_tasks;
CREATE POLICY "Assignees can update their tasks"
ON public.crm_tasks
FOR UPDATE
TO authenticated
USING (
  assignee_id IS NOT NULL
  AND public.is_task_assignee(assignee_id, auth.uid())
)
WITH CHECK (
  assignee_id IS NOT NULL
  AND public.is_task_assignee(assignee_id, auth.uid())
);