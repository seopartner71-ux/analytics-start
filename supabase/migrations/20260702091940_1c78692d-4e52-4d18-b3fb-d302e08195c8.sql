
CREATE OR REPLACE FUNCTION public.is_project_participant(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        p.owner_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.owner_id = _user_id
            AND (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
        )
        OR EXISTS (
          SELECT 1 FROM public.project_members pm
          JOIN public.team_members tm2 ON tm2.id = pm.team_member_id
          WHERE pm.project_id = _project_id
            AND tm2.owner_id = _user_id
        )
      )
  )
  OR public.has_role(_user_id, 'admin'::app_role)
$function$;
