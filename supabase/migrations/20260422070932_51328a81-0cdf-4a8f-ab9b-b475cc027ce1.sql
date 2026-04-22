
-- 1. Уведомления о новых комментариях в задаче
CREATE OR REPLACE FUNCTION public.notify_task_comment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_task RECORD;
  v_author_user uuid;
  v_assignee_user uuid;
  v_creator_user uuid;
  v_project_name text;
  v_title text;
  v_body text;
BEGIN
  -- Только пользовательские (не системные) комментарии
  IF NEW.is_system = true THEN
    RETURN NEW;
  END IF;

  SELECT t.id, t.title, t.assignee_id, t.creator_id, t.owner_id, t.project_id
  INTO v_task
  FROM public.crm_tasks t
  WHERE t.id = NEW.task_id;

  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  v_author_user := auth.uid();

  IF v_task.project_id IS NOT NULL THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = v_task.project_id;
  END IF;

  v_title := '💬 Новый комментарий: ' || v_task.title;
  v_body := COALESCE('Проект: ' || v_project_name || E'\n', '') || LEFT(NEW.body, 200);

  -- Исполнитель
  IF v_task.assignee_id IS NOT NULL THEN
    SELECT owner_id INTO v_assignee_user FROM public.team_members WHERE id = v_task.assignee_id;
    IF v_assignee_user IS NOT NULL AND v_assignee_user IS DISTINCT FROM v_author_user THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (v_assignee_user, COALESCE(v_task.project_id, v_task.owner_id), v_title, v_body);
    END IF;
  END IF;

  -- Постановщик (через team_members.creator_id → owner_id)
  IF v_task.creator_id IS NOT NULL THEN
    SELECT owner_id INTO v_creator_user FROM public.team_members WHERE id = v_task.creator_id;
    IF v_creator_user IS NOT NULL
       AND v_creator_user IS DISTINCT FROM v_author_user
       AND v_creator_user IS DISTINCT FROM v_assignee_user THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (v_creator_user, COALESCE(v_task.project_id, v_task.owner_id), v_title, v_body);
    END IF;
  END IF;

  -- Владелец задачи (если отличается от постановщика и автора)
  IF v_task.owner_id IS NOT NULL
     AND v_task.owner_id IS DISTINCT FROM v_author_user
     AND v_task.owner_id IS DISTINCT FROM v_assignee_user
     AND v_task.owner_id IS DISTINCT FROM v_creator_user THEN
    INSERT INTO public.notifications (user_id, project_id, title, body)
    VALUES (v_task.owner_id, COALESCE(v_task.project_id, v_task.owner_id), v_title, v_body);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_comment ON public.task_comments;
CREATE TRIGGER trg_notify_task_comment
AFTER INSERT ON public.task_comments
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_comment();

-- 2. Напоминание за 24 часа до дедлайна
CREATE OR REPLACE FUNCTION public.notify_upcoming_deadlines()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  r RECORD;
  v_assignee_user uuid;
  v_project_name text;
  v_title text;
  v_body text;
BEGIN
  FOR r IN
    SELECT t.id, t.title, t.deadline, t.assignee_id, t.project_id, t.owner_id
    FROM public.crm_tasks t
    WHERE t.deadline IS NOT NULL
      AND t.deadline > now() + interval '23 hours'
      AND t.deadline < now() + interval '25 hours'
      AND t.stage NOT IN ('Завершена', 'Принята', 'Возвращена')
      AND t.archived_at IS NULL
      AND t.assignee_id IS NOT NULL
  LOOP
    SELECT owner_id INTO v_assignee_user FROM public.team_members WHERE id = r.assignee_id;
    IF v_assignee_user IS NULL THEN CONTINUE; END IF;

    v_project_name := NULL;
    IF r.project_id IS NOT NULL THEN
      SELECT name INTO v_project_name FROM public.projects WHERE id = r.project_id;
    END IF;

    v_title := '⏰ Дедлайн через 24 часа: ' || r.title;
    v_body := 'Срок: ' || to_char(r.deadline AT TIME ZONE 'Europe/Moscow', 'DD.MM.YYYY HH24:MI')
              || COALESCE('. Проект: ' || v_project_name, '');

    IF NOT EXISTS (
      SELECT 1 FROM public.notifications
      WHERE user_id = v_assignee_user
        AND title = v_title
        AND created_at > now() - interval '25 hours'
    ) THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (v_assignee_user, COALESCE(r.project_id, r.owner_id), v_title, v_body);
    END IF;
  END LOOP;
END;
$$;

-- 3. Блокировка закрытия задачи при наличии открытых подзадач
CREATE OR REPLACE FUNCTION public.prevent_close_with_open_subtasks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_open_count int;
BEGIN
  IF NEW.stage IN ('Завершена', 'Принята') AND OLD.stage NOT IN ('Завершена', 'Принята') THEN
    SELECT COUNT(*) INTO v_open_count
    FROM public.subtasks
    WHERE task_id = NEW.id AND COALESCE(is_done, false) = false;

    IF v_open_count > 0 THEN
      RAISE EXCEPTION 'Нельзя закрыть задачу: есть % открытых подзадач', v_open_count
        USING HINT = 'Сначала закройте все подзадачи';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_close_with_open_subtasks ON public.crm_tasks;
CREATE TRIGGER trg_prevent_close_with_open_subtasks
BEFORE UPDATE ON public.crm_tasks
FOR EACH ROW
EXECUTE FUNCTION public.prevent_close_with_open_subtasks();

-- 4. Прогресс по подзадачам
CREATE OR REPLACE FUNCTION public.get_subtask_progress(p_task_id uuid)
RETURNS TABLE(total int, done int, percent int)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE COALESCE(is_done, false) = true)::int AS done,
    CASE WHEN COUNT(*) = 0 THEN 0
         ELSE (COUNT(*) FILTER (WHERE COALESCE(is_done, false) = true) * 100 / COUNT(*))::int
    END AS percent
  FROM public.subtasks
  WHERE task_id = p_task_id;
$$;
