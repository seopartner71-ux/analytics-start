-- ============ ЭТАП 1: Handoff-статусы и автоматические уведомления ============

-- 1) Триггер: уведомлять исполнителя при назначении/смене assignee
CREATE OR REPLACE FUNCTION public.notify_task_assigned()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_assignee_owner uuid;
  v_project_id uuid;
  v_project_name text;
BEGIN
  -- Только если assignee_id изменился и не NULL
  IF NEW.assignee_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;

  -- Получаем owner_id из team_members (это user_id для notifications)
  SELECT tm.owner_id INTO v_assignee_owner
  FROM public.team_members tm
  WHERE tm.id = NEW.assignee_id;

  IF v_assignee_owner IS NULL THEN
    RETURN NEW;
  END IF;

  v_project_id := NEW.project_id;
  IF v_project_id IS NOT NULL THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = v_project_id;
  END IF;

  -- Не уведомляем самого создателя если он же исполнитель
  IF v_assignee_owner = NEW.owner_id THEN
    RETURN NEW;
  END IF;

  INSERT INTO public.notifications (user_id, project_id, title, body)
  VALUES (
    v_assignee_owner,
    COALESCE(v_project_id, NEW.owner_id),
    'Вам назначена задача: ' || NEW.title,
    COALESCE('Проект: ' || v_project_name, 'Без проекта')
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_assigned ON public.crm_tasks;
CREATE TRIGGER trg_notify_task_assigned
AFTER INSERT OR UPDATE OF assignee_id ON public.crm_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_assigned();

-- 2) Триггер: уведомлять при смене этапа (handoff)
CREATE OR REPLACE FUNCTION public.notify_task_stage_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_account_owner uuid;
  v_assignee_owner uuid;
  v_project_id uuid;
  v_account_id uuid;
BEGIN
  IF OLD.stage IS NOT DISTINCT FROM NEW.stage THEN
    RETURN NEW;
  END IF;

  v_project_id := NEW.project_id;

  -- Уведомление аккаунт-менеджеру при "На проверке"
  IF NEW.stage = 'На проверке' AND v_project_id IS NOT NULL THEN
    SELECT account_manager_id INTO v_account_id FROM public.projects WHERE id = v_project_id;
    IF v_account_id IS NOT NULL THEN
      SELECT owner_id INTO v_account_owner FROM public.team_members WHERE id = v_account_id;
      IF v_account_owner IS NOT NULL THEN
        INSERT INTO public.notifications (user_id, project_id, title, body)
        VALUES (v_account_owner, v_project_id,
          'Задача на проверку: ' || NEW.title,
          'Исполнитель завершил работу. Требуется проверка.');
      END IF;
    END IF;
  END IF;

  -- Уведомление исполнителю при возврате на доработку
  IF NEW.stage = 'Возвращена' AND NEW.assignee_id IS NOT NULL THEN
    SELECT owner_id INTO v_assignee_owner FROM public.team_members WHERE id = NEW.assignee_id;
    IF v_assignee_owner IS NOT NULL THEN
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (v_assignee_owner, COALESCE(v_project_id, NEW.owner_id),
        'Задача возвращена: ' || NEW.title,
        'Аккаунт-менеджер вернул задачу на доработку.');
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_task_stage_change ON public.crm_tasks;
CREATE TRIGGER trg_notify_task_stage_change
AFTER UPDATE OF stage ON public.crm_tasks
FOR EACH ROW
EXECUTE FUNCTION public.notify_task_stage_change();

-- 3) Функция для проверки просроченных задач (вызывается через pg_cron или вручную)
CREATE OR REPLACE FUNCTION public.notify_overdue_tasks()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  r RECORD;
  v_user_id uuid;
BEGIN
  -- Задачи которые стали просроченными за последние 24 часа и не уведомлены
  FOR r IN
    SELECT t.id, t.title, t.deadline, t.assignee_id, t.project_id, t.owner_id, t.stage
    FROM public.crm_tasks t
    WHERE t.deadline < now()
      AND t.deadline > now() - interval '24 hours'
      AND t.stage NOT IN ('Завершена', 'Принята')
  LOOP
    -- Уведомляем исполнителя
    IF r.assignee_id IS NOT NULL THEN
      SELECT owner_id INTO v_user_id FROM public.team_members WHERE id = r.assignee_id;
      IF v_user_id IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM public.notifications
        WHERE user_id = v_user_id
          AND title = 'Задача просрочена: ' || r.title
          AND created_at > now() - interval '25 hours'
      ) THEN
        INSERT INTO public.notifications (user_id, project_id, title, body)
        VALUES (v_user_id, COALESCE(r.project_id, r.owner_id),
          'Задача просрочена: ' || r.title,
          'Дедлайн прошёл. Срочно завершите задачу.');
      END IF;
    END IF;
  END LOOP;
END;
$$;
