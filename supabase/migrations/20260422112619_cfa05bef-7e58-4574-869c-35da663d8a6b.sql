-- Allow users to see projects they participate in via project_members
CREATE OR REPLACE FUNCTION public.is_project_member(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.project_members pm
    LEFT JOIN public.team_members tm ON tm.id = pm.team_member_id
    WHERE pm.project_id = _project_id
      AND (
        pm.user_id = _user_id
        OR tm.owner_id = _user_id
      )
  );
$$;

DROP POLICY IF EXISTS "Project members can view their projects" ON public.projects;
CREATE POLICY "Project members can view their projects"
ON public.projects
FOR SELECT
TO authenticated
USING (public.is_project_member(id, auth.uid()));