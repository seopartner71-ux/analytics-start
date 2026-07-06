CREATE OR REPLACE FUNCTION public.update_project_deadline(_project_id uuid, _deadline timestamp with time zone)
RETURNS public.projects
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _project public.projects;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Требуется авторизация';
  END IF;

  SELECT p.*
  INTO _project
  FROM public.projects p
  WHERE p.id = _project_id
    AND (
      p.owner_id = _uid
      OR public.has_role(_uid, 'admin'::public.app_role)
      OR public.has_role(_uid, 'director'::public.app_role)
      OR public.has_role(_uid, 'seo'::public.app_role)
      OR (
        public.has_role(_uid, 'manager'::public.app_role)
        AND EXISTS (
          SELECT 1
          FROM public.team_members tm
          WHERE tm.owner_id = _uid
            AND (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
        )
      )
    )
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Недостаточно прав для изменения дедлайна проекта';
  END IF;

  UPDATE public.projects
  SET deadline = _deadline
  WHERE id = _project_id
  RETURNING * INTO _project;

  RETURN _project;
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_project_deadline(uuid, timestamp with time zone) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_project_deadline(uuid, timestamp with time zone) TO service_role;