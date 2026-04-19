
-- 1. Удалить старое
DROP TRIGGER IF EXISTS trg_onboarding_auto_task ON public.project_onboarding;
DROP FUNCTION IF EXISTS public.onboarding_auto_create_task() CASCADE;
DROP TABLE IF EXISTS public.project_onboarding CASCADE;

-- 2. Тарифы (справочник)
CREATE TABLE public.tariffs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  description text,
  price_max numeric NOT NULL DEFAULT 0,
  is_custom boolean NOT NULL DEFAULT false,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.tariffs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read tariffs" ON public.tariffs
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tariffs" ON public.tariffs
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_tariffs_updated BEFORE UPDATE ON public.tariffs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.tariffs (code, name, description, price_max, is_custom, sort_order) VALUES
  ('basic',    '🥉 Базовый',         'до 30 000₽/мес',   30000, false, 1),
  ('standard', '🥈 Стандарт',        'до 60 000₽/мес',   60000, false, 2),
  ('premium',  '🥇 Премиум',         'до 100 000₽/мес', 100000, false, 3),
  ('custom',   '💎 Индивидуальный',  'своя сумма',           0, true,  4);

-- 3. Онбординг проектов
CREATE TABLE public.onboarding_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  tariff_id uuid REFERENCES public.tariffs(id),
  tariff_code text NOT NULL,
  contract_budget numeric NOT NULL DEFAULT 0,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  first_payment_date date,
  payment_recurrence text NOT NULL DEFAULT 'monthly', -- monthly | quarterly
  contact_name text,
  contact_phone text,
  contact_email text,
  contact_telegram text,
  contact_preferred text,
  status text NOT NULL DEFAULT 'new', -- new | in_progress | completed | archived
  progress int NOT NULL DEFAULT 0,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onb_projects_status ON public.onboarding_projects(status);
CREATE INDEX idx_onb_projects_project ON public.onboarding_projects(project_id);

ALTER TABLE public.onboarding_projects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage onboarding_projects" ON public.onboarding_projects
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_onb_projects_updated BEFORE UPDATE ON public.onboarding_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 4. Чеклист пунктов конкретного онбординга
CREATE TABLE public.onboarding_checklist_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.onboarding_projects(id) ON DELETE CASCADE,
  section text NOT NULL,           -- documents | access | technical | analytics | communication
  title text NOT NULL,
  assignee_role text NOT NULL,     -- seo | manager
  assignee_id uuid REFERENCES public.team_members(id),
  due_day int NOT NULL DEFAULT 1,
  due_date date,
  sort_order int NOT NULL DEFAULT 0,
  checked boolean NOT NULL DEFAULT false,
  completed_by uuid,
  completed_by_name text,
  completed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_onb_items_onboarding ON public.onboarding_checklist_items(onboarding_id);

ALTER TABLE public.onboarding_checklist_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage onboarding_checklist_items" ON public.onboarding_checklist_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_onb_items_updated BEFORE UPDATE ON public.onboarding_checklist_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 5. Шаблон задач (читают все, правит admin)
CREATE TABLE public.onboarding_task_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  month int NOT NULL,
  week int NOT NULL,
  title text NOT NULL,
  assignee_role text NOT NULL, -- seo | manager
  description text,
  sort_order int NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.onboarding_task_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read onboarding_task_templates" ON public.onboarding_task_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage onboarding_task_templates" ON public.onboarding_task_templates
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER trg_onb_task_templates_updated BEFORE UPDATE ON public.onboarding_task_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 6. Сидим Месяц 1 — 6 задач
INSERT INTO public.onboarding_task_templates (month, week, title, assignee_role, sort_order) VALUES
  (1, 1, 'Технический аудит сайта',          'seo',     1),
  (1, 1, 'Сбор семантического ядра',         'seo',     2),
  (1, 2, 'Анализ конкурентов',                'seo',     3),
  (1, 2, 'Составление стратегии продвижения', 'seo',     4),
  (1, 3, 'Исправление критических ошибок',    'seo',     5),
  (1, 4, 'Первый отчёт клиенту',              'manager', 6);

-- 7. Шаблон чеклиста (хранится как rows в settings-стиле — используем app_settings JSON для читаемости)
INSERT INTO public.app_settings (key, value)
VALUES (
  'onboarding_checklist_template',
  '[
    {"section":"documents","title":"Договор подписан","assignee_role":"manager","due_day":1,"sort_order":1},
    {"section":"documents","title":"Счёт выставлен","assignee_role":"manager","due_day":1,"sort_order":2},
    {"section":"documents","title":"Счёт оплачен","assignee_role":"manager","due_day":3,"sort_order":3},
    {"section":"documents","title":"Бриф клиента заполнен","assignee_role":"manager","due_day":2,"sort_order":4},
    {"section":"access","title":"Доступ к сайту (FTP/CMS)","assignee_role":"seo","due_day":2,"sort_order":5},
    {"section":"access","title":"Доступ к Яндекс Вебмастер","assignee_role":"seo","due_day":2,"sort_order":6},
    {"section":"access","title":"Доступ к Google Search Console","assignee_role":"seo","due_day":2,"sort_order":7},
    {"section":"access","title":"Доступ к Яндекс Метрике","assignee_role":"seo","due_day":2,"sort_order":8},
    {"section":"access","title":"Доступ к Google Analytics","assignee_role":"seo","due_day":2,"sort_order":9},
    {"section":"technical","title":"Сайт добавлен в StatPulse","assignee_role":"seo","due_day":3,"sort_order":10},
    {"section":"technical","title":"Технический аудит запущен","assignee_role":"seo","due_day":3,"sort_order":11},
    {"section":"technical","title":"Robots.txt проверен","assignee_role":"seo","due_day":3,"sort_order":12},
    {"section":"technical","title":"Sitemap.xml проверен","assignee_role":"seo","due_day":3,"sort_order":13},
    {"section":"technical","title":"Счётчики аналитики проверены","assignee_role":"seo","due_day":3,"sort_order":14},
    {"section":"analytics","title":"Базовые позиции зафиксированы","assignee_role":"seo","due_day":5,"sort_order":15},
    {"section":"analytics","title":"Конкуренты определены","assignee_role":"seo","due_day":5,"sort_order":16},
    {"section":"analytics","title":"Семантическое ядро собрано","assignee_role":"seo","due_day":7,"sort_order":17},
    {"section":"communication","title":"Клиент добавлен в чат проекта","assignee_role":"manager","due_day":1,"sort_order":18},
    {"section":"communication","title":"Формат отчётности согласован","assignee_role":"manager","due_day":3,"sort_order":19},
    {"section":"communication","title":"Созвон-знакомство проведён","assignee_role":"manager","due_day":5,"sort_order":20}
  ]'
)
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now();
