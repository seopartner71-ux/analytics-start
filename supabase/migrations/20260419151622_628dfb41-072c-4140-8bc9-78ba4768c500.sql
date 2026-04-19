
-- 1. Новая таблица onboarding_tasks (хранит конкретные задачи проекта по периодам)
CREATE TABLE IF NOT EXISTS public.onboarding_tasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.onboarding_task_templates(id) ON DELETE SET NULL,
  period integer NOT NULL CHECK (period BETWEEN 1 AND 3),
  week integer NOT NULL CHECK (week BETWEEN 1 AND 12),
  sort_order integer NOT NULL DEFAULT 0,
  title text NOT NULL,
  assignee_role text NOT NULL DEFAULT 'seo',
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  status text NOT NULL DEFAULT 'not_started', -- not_started | in_progress | done | overdue
  checked boolean NOT NULL DEFAULT false,
  comment text,
  due_date date,
  completed_at timestamptz,
  completed_by uuid,
  completed_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_project ON public.onboarding_tasks(project_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_onboarding ON public.onboarding_tasks(onboarding_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_tasks_period ON public.onboarding_tasks(project_id, period, sort_order);

ALTER TABLE public.onboarding_tasks ENABLE ROW LEVEL SECURITY;

-- Admin полный доступ
CREATE POLICY "Admins manage onboarding_tasks"
  ON public.onboarding_tasks FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Project owner полный доступ
CREATE POLICY "Project owners manage onboarding_tasks"
  ON public.onboarding_tasks FOR ALL
  USING (EXISTS (SELECT 1 FROM projects p WHERE p.id = onboarding_tasks.project_id AND p.owner_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM projects p WHERE p.id = onboarding_tasks.project_id AND p.owner_id = auth.uid()));

-- Manager (SEO/account) видит и обновляет задачи назначенных проектов
CREATE POLICY "Managers manage onboarding_tasks on assigned projects"
  ON public.onboarding_tasks FOR ALL TO authenticated
  USING (
    has_role(auth.uid(), 'manager'::app_role) AND EXISTS (
      SELECT 1 FROM projects p
      JOIN team_members tm ON (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
      WHERE p.id = onboarding_tasks.project_id AND tm.owner_id = auth.uid()
    )
  );

-- updated_at trigger
CREATE TRIGGER trg_onboarding_tasks_updated_at
  BEFORE UPDATE ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Заменяем onboarding_task_templates: чистим и наполняем 37 задачами (период, неделя, sort_order)
DELETE FROM public.onboarding_task_templates;

INSERT INTO public.onboarding_task_templates (month, week, title, assignee_role, sort_order, is_active) VALUES
-- Период 1 (Месяц 1)
(1, 1, 'Проверка доступов', 'seo', 1, true),
(1, 1, 'Сбор семантического ядра, кластеризация (согласно приоритетам)', 'seo', 2, true),
(1, 1, 'Сбор конкурентов по тематике проекта в ПС', 'seo', 3, true),
(1, 1, 'Технический аудит сайта', 'seo', 4, true),
(1, 2, 'Аудит скорости загрузки', 'seo', 5, true),
(1, 2, 'Анализ Яндекс Вебмастер', 'seo', 6, true),
(1, 2, 'Анализ Google Search Console', 'seo', 7, true),
(1, 2, 'Аудит структуры макетов страниц', 'seo', 8, true),
(1, 3, 'On-Page оптимизация страниц', 'seo', 9, true),
(1, 3, 'Подготовка ТЗ на тексты по результатам On-Page', 'seo', 10, true),
(1, 4, 'Написание текстов, размещение, оформление', 'seo', 11, true),
(1, 4, 'Контрольный съём позиций', 'seo', 12, true),
-- Период 2 (Месяц 2)
(2, 5, 'Контроль реализации ТЗ по аудитам', 'seo', 13, true),
(2, 5, 'Аудит ссылочной массы', 'seo', 14, true),
(2, 5, 'Юзабилити аудит', 'seo', 15, true),
(2, 6, 'Коммерческий аудит', 'seo', 16, true),
(2, 6, 'Написание ТЗ на основе проведённых аудитов', 'seo', 17, true),
(2, 6, 'On-Page оптимизация страниц', 'seo', 18, true),
(2, 7, 'Подготовка ТЗ на тексты по результатам On-Page', 'seo', 19, true),
(2, 7, 'Сбор тем для написания информационных статей', 'seo', 20, true),
(2, 7, 'Проверка сайта по чек-листу для ИИ', 'seo', 21, true),
(2, 8, 'Публикация статей', 'seo', 22, true),
(2, 8, 'Проверка и внедрение микроразметки', 'seo', 23, true),
(2, 8, 'Аналитика результатов', 'seo', 24, true),
-- Период 3 (Месяц 3)
(3, 9, 'Аудит скорости загрузки', 'seo', 25, true),
(3, 9, 'On-Page оптимизация страниц', 'seo', 26, true),
(3, 9, 'Доработки по сайту', 'seo', 27, true),
(3, 10, 'Подготовка ТЗ на тексты по результатам On-Page', 'seo', 28, true),
(3, 10, 'Написание текстов, размещение', 'seo', 29, true),
(3, 10, 'Создание новых страниц (по необходимости)', 'seo', 30, true),
(3, 11, 'Внедрение коммерческих факторов ранжирования', 'seo', 31, true),
(3, 11, 'Внедрение юзабилити факторов', 'seo', 32, true),
(3, 11, 'Контроль работоспособности всех форм заявок', 'seo', 33, true),
(3, 12, 'Отбор доноров для закупки ссылок', 'seo', 34, true),
(3, 12, 'Закупка ссылочной массы', 'seo', 35, true),
(3, 12, 'Контрольный съём позиций', 'seo', 36, true),
(3, 12, 'Аналитика результатов', 'seo', 37, true);

-- 3. Чистим старые автозадачи онбординга из crm_tasks
DELETE FROM public.crm_tasks
WHERE description LIKE 'Автозадача онбординга%';

-- 4. Бэкфилл: для существующих онбордингов создаём 37 onboarding_tasks
INSERT INTO public.onboarding_tasks (
  onboarding_id, project_id, template_id, period, week, sort_order, title, assignee_role, assignee_id, due_date
)
SELECT
  o.id,
  o.project_id,
  t.id,
  t.month,
  t.week,
  t.sort_order,
  t.title,
  t.assignee_role,
  CASE WHEN t.assignee_role = 'seo' THEN p.seo_specialist_id
       WHEN t.assignee_role = 'manager' THEN p.account_manager_id
       ELSE NULL END,
  (o.start_date + ((t.week - 1) * 7) + 6)
FROM public.onboarding_projects o
JOIN public.projects p ON p.id = o.project_id
CROSS JOIN public.onboarding_task_templates t
WHERE t.is_active = true
  AND NOT EXISTS (
    SELECT 1 FROM public.onboarding_tasks ot WHERE ot.onboarding_id = o.id
  );

-- 5. Функция пересчёта прогресса
CREATE OR REPLACE FUNCTION public.recalc_onboarding_progress(p_onboarding_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total int;
  v_done int;
BEGIN
  SELECT COUNT(*), COUNT(*) FILTER (WHERE checked = true OR status = 'done')
  INTO v_total, v_done
  FROM public.onboarding_tasks WHERE onboarding_id = p_onboarding_id;

  UPDATE public.onboarding_projects
  SET progress = CASE WHEN v_total = 0 THEN 0 ELSE ROUND(v_done * 100.0 / v_total) END,
      status = CASE WHEN v_total > 0 AND v_done = v_total THEN 'completed' ELSE status END,
      completed_at = CASE WHEN v_total > 0 AND v_done = v_total THEN COALESCE(completed_at, now()) ELSE completed_at END,
      updated_at = now()
  WHERE id = p_onboarding_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_recalc_onboarding_progress()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.recalc_onboarding_progress(COALESCE(NEW.onboarding_id, OLD.onboarding_id));
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_onboarding_tasks_recalc
  AFTER INSERT OR UPDATE OR DELETE ON public.onboarding_tasks
  FOR EACH ROW EXECUTE FUNCTION public.trg_recalc_onboarding_progress();

-- Бэкфилл прогресса
DO $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT id FROM public.onboarding_projects LOOP
    PERFORM public.recalc_onboarding_progress(r.id);
  END LOOP;
END $$;
