
CREATE OR REPLACE FUNCTION public.prevent_close_with_open_subtasks()
RETURNS trigger
LANGUAGE plpgsql
SET search_path TO 'public'
AS $$
DECLARE
  v_open_count int;
BEGIN
  IF NEW.stage IN ('Завершена', 'Принята', 'Выполнено')
     AND OLD.stage NOT IN ('Завершена', 'Принята', 'Выполнено') THEN
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
