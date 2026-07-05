
-- Broaden task_comments RLS: allow all task participants (owner, assignee, creator, accomplices) and admin/manager/director/seo to read and write comments.
DROP POLICY IF EXISTS "Task owners manage comments" ON public.task_comments;

CREATE POLICY "Participants view task comments"
ON public.task_comments FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.crm_tasks t
    WHERE t.id = task_comments.task_id
      AND (
        t.owner_id = auth.uid()
        OR (t.assignee_id IS NOT NULL AND public.is_task_assignee(t.assignee_id, auth.uid()))
        OR public.is_task_creator(t.id, auth.uid())
        OR public.is_task_accomplice(t.id, auth.uid())
      )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR public.has_role(auth.uid(), 'seo'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Participants insert task comments"
ON public.task_comments FOR INSERT
TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.crm_tasks t
    WHERE t.id = task_comments.task_id
      AND (
        t.owner_id = auth.uid()
        OR (t.assignee_id IS NOT NULL AND public.is_task_assignee(t.assignee_id, auth.uid()))
        OR public.is_task_creator(t.id, auth.uid())
        OR public.is_task_accomplice(t.id, auth.uid())
      )
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
  OR public.has_role(auth.uid(), 'seo'::app_role)
  OR public.has_role(auth.uid(), 'manager'::app_role)
);

CREATE POLICY "Authors update own comments"
ON public.task_comments FOR UPDATE
TO authenticated
USING (
  author_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = task_comments.author_id AND tm.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.crm_tasks t
    WHERE t.id = task_comments.task_id AND t.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
)
WITH CHECK (true);

CREATE POLICY "Authors or owner delete comments"
ON public.task_comments FOR DELETE
TO authenticated
USING (
  author_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.id = task_comments.author_id AND tm.owner_id = auth.uid()
  )
  OR EXISTS (
    SELECT 1 FROM public.crm_tasks t
    WHERE t.id = task_comments.task_id AND t.owner_id = auth.uid()
  )
  OR public.has_role(auth.uid(), 'admin'::app_role)
  OR public.has_role(auth.uid(), 'director'::app_role)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.task_comments TO authenticated;
GRANT ALL ON public.task_comments TO service_role;
