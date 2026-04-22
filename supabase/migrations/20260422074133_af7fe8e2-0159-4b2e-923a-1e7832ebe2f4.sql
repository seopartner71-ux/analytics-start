
-- Добавляем диапазон дат периода
ALTER TABLE public.project_periods
  ADD COLUMN IF NOT EXISTS start_date date,
  ADD COLUMN IF NOT EXISTS end_date date;

-- Заполняем существующие записи на основе year/month (полный месяц)
UPDATE public.project_periods
SET start_date = make_date(year, month, 1),
    end_date = (make_date(year, month, 1) + interval '1 month - 1 day')::date
WHERE start_date IS NULL;

-- Связь задачи периода с задачей CRM
ALTER TABLE public.period_tasks
  ADD COLUMN IF NOT EXISTS crm_task_id uuid REFERENCES public.crm_tasks(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_period_tasks_crm_task ON public.period_tasks(crm_task_id);

-- Двусторонняя синхронизация completed: если crm-задача переходит в финальную стадию,
-- помечаем period_task как выполненную
CREATE OR REPLACE FUNCTION public.sync_period_task_from_crm()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.stage IN ('Завершена', 'Принята') AND (TG_OP = 'INSERT' OR OLD.stage IS DISTINCT FROM NEW.stage) THEN
    UPDATE public.period_tasks
       SET completed = true,
           completed_at = COALESCE(completed_at, now())
     WHERE crm_task_id = NEW.id AND completed = false;
  ELSIF NEW.stage NOT IN ('Завершена', 'Принята') AND TG_OP = 'UPDATE' AND OLD.stage IN ('Завершена', 'Принята') THEN
    UPDATE public.period_tasks
       SET completed = false,
           completed_at = NULL
     WHERE crm_task_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_period_task_from_crm ON public.crm_tasks;
CREATE TRIGGER trg_sync_period_task_from_crm
AFTER INSERT OR UPDATE OF stage ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_period_task_from_crm();
