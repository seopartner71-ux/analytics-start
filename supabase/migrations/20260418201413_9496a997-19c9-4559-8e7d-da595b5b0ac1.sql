
CREATE OR REPLACE FUNCTION public.notify_overdue_tasks()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  r RECORD;
  v_assignee_user uuid;
  v_owner_user uuid;
  v_project_name text;
  v_title text;
  v_body text;
BEGIN
  FOR r IN
    SELECT t.id, t.title, t.deadline, t.assignee_id, t.project_id, t.owner_id, t.stage
    FROM public.crm_tasks t
    WHERE t.deadline < now()
      AND t.deadline > now() - interval '48 hours'
      AND t.stage NOT IN ('Завершена', 'Принята')
  LOOP
    v_project_name := NULL;
    IF r.project_id IS NOT NULL THEN
      SELECT name INTO v_project_name FROM public.projects WHERE id = r.project_id;
    END IF;

    v_title := 'Задача просрочена: ' || r.title;
    v_body  := 'Дедлайн: ' || to_char(r.deadline AT TIME ZONE 'Europe/Moscow', 'DD.MM.YYYY HH24:MI')
               || COALESCE('. Проект: ' || v_project_name, '');

    -- Исполнитель
    IF r.assignee_id IS NOT NULL THEN
      SELECT owner_id INTO v_assignee_user FROM public.team_members WHERE id = r.assignee_id;
      IF v_assignee_user IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_assignee_user
          AND title = v_title
          AND created_at > now() - interval '25 hours'
      ) THEN
        INSERT INTO public.notifications (user_id, project_id, title, body)
        VALUES (v_assignee_user, COALESCE(r.project_id, r.owner_id), v_title, v_body);
      END IF;
    END IF;

    -- Руководитель (владелец проекта/задачи)
    v_owner_user := r.owner_id;
    IF v_owner_user IS NOT NULL
       AND v_owner_user IS DISTINCT FROM v_assignee_user
       AND NOT EXISTS (
         SELECT 1 FROM public.notifications
         WHERE user_id = v_owner_user
           AND title = v_title
           AND created_at > now() - interval '25 hours'
       ) THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (v_owner_user, COALESCE(r.project_id, r.owner_id), v_title,
              COALESCE('Исполнитель опаздывает. ', '') || v_body);
    END IF;
  END LOOP;
END;
$function$;
