CREATE OR REPLACE FUNCTION public.archive_team_member_everywhere(p_member_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner_id uuid;
BEGIN
  SELECT owner_id INTO v_owner_id
  FROM public.team_members
  WHERE id = p_member_id;

  IF v_owner_id IS NULL THEN
    RAISE EXCEPTION 'Сотрудник не найден';
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin'::app_role)
    OR public.has_role(auth.uid(), 'director'::app_role)
    OR auth.uid() = v_owner_id
  ) THEN
    RAISE EXCEPTION 'Недостаточно прав для удаления сотрудника';
  END IF;

  UPDATE public.projects
  SET seo_specialist_id = NULL
  WHERE seo_specialist_id = p_member_id;

  UPDATE public.projects
  SET account_manager_id = NULL
  WHERE account_manager_id = p_member_id;

  UPDATE public.companies
  SET responsible_id = NULL
  WHERE responsible_id = p_member_id;

  UPDATE public.crm_tasks
  SET assignee_id = NULL
  WHERE assignee_id = p_member_id;

  UPDATE public.crm_tasks
  SET creator_id = NULL
  WHERE creator_id = p_member_id;

  UPDATE public.period_tasks
  SET assignee_id = NULL
  WHERE assignee_id = p_member_id;

  UPDATE public.subtasks
  SET assignee_id = NULL
  WHERE assignee_id = p_member_id;

  UPDATE public.onboarding_tasks
  SET assignee_id = NULL
  WHERE assignee_id = p_member_id;

  UPDATE public.onboarding_checklist_items
  SET assignee_id = NULL
  WHERE assignee_id = p_member_id;

  UPDATE public.audit_checks
  SET assigned_to = NULL
  WHERE assigned_to = p_member_id;

  UPDATE public.yandex_webmaster_checks
  SET assigned_to = NULL
  WHERE assigned_to = p_member_id;

  UPDATE public.task_comments
  SET author_id = NULL
  WHERE author_id = p_member_id;

  UPDATE public.project_comments
  SET author_id = NULL
  WHERE author_id = p_member_id;

  DELETE FROM public.project_members
  WHERE team_member_id = p_member_id;

  UPDATE public.team_members
  SET archived_at = now(),
      archived_by = auth.uid(),
      updated_at = now()
  WHERE id = p_member_id;

  UPDATE public.profiles
  SET archived_at = now(),
      archived_by = auth.uid(),
      status = 'archived',
      updated_at = now()
  WHERE user_id = v_owner_id;
END;
$$;