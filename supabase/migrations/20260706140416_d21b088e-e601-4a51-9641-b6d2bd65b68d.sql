CREATE OR REPLACE FUNCTION public.sync_period_task_from_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IN ('Завершена', 'Принята', 'Выполнено') AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    UPDATE public.period_tasks
       SET completed = true,
           completed_at = COALESCE(completed_at, now())
     WHERE crm_task_id = NEW.id AND completed = false;
  ELSIF NEW.stage NOT IN ('Завершена', 'Принята', 'Выполнено') AND TG_OP = 'UPDATE' AND OLD.stage IN ('Завершена', 'Принята', 'Выполнено') THEN
    UPDATE public.period_tasks
       SET completed = false,
           completed_at = NULL
     WHERE crm_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- Догоняем уже закрытые «Выполнено» задачи, которые ранее не синхронизировались
UPDATE public.period_tasks pt
   SET completed = true,
       completed_at = COALESCE(pt.completed_at, now())
  FROM public.crm_tasks ct
 WHERE ct.id = pt.crm_task_id
   AND ct.stage IN ('Завершена', 'Принята', 'Выполнено')
   AND pt.completed = false;