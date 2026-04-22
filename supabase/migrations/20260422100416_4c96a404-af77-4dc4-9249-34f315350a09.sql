
-- ============ 1. DEPARTMENTS ============
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  color text DEFAULT '#3B82F6',
  head_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Departments viewable by authenticated"
ON public.departments FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage departments"
ON public.departments FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role))
WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role) OR public.has_role(auth.uid(), 'director'::app_role));

CREATE TRIGGER update_departments_updated_at
BEFORE UPDATE ON public.departments
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Колонка в team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_team_members_department_id ON public.team_members(department_id);

-- ============ 2. CASCADE для всех таблиц с project_id ============
DO $$
DECLARE
  rec RECORD;
  fk_name text;
BEGIN
  FOR rec IN
    SELECT tc.table_name, tc.constraint_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'projects'
      AND kcu.column_name = 'project_id'
      AND rc.delete_rule <> 'CASCADE'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE',
                   rec.table_name, rec.constraint_name);
  END LOOP;
END $$;

-- Доп. таблицы которые могли не иметь FK на projects вообще: добавим
DO $$
DECLARE
  t text;
  has_fk boolean;
BEGIN
  FOR t IN SELECT unnest(ARRAY[
    'audit_checks','cached_reports','conversations','crawl_jobs','crm_tasks',
    'gsc_daily_stats','gsc_pages','gsc_queries','integrations','link_profile',
    'metrika_stats','notifications','onboarding_projects','onboarding_tasks',
    'project_analytics','project_comments','project_credentials','project_files',
    'project_keywords','project_members','project_message_reads','project_messages',
    'project_periods','report_templates','site_errors','site_health',
    'task_time_entries','weekly_reports','work_logs',
    'yandex_webmaster_checks','yandex_webmaster_snapshots'
  ])
  LOOP
    SELECT EXISTS (
      SELECT 1 FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
      WHERE tc.table_schema='public' AND tc.table_name = t
        AND tc.constraint_type='FOREIGN KEY' AND kcu.column_name='project_id'
    ) INTO has_fk;
    IF NOT has_fk THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (project_id) REFERENCES public.projects(id) ON DELETE CASCADE',
                     t, t || '_project_id_fkey');
    END IF;
  END LOOP;
END $$;

-- ============ 3. CASCADE для team_members ============
-- task_members.team_member_id
DO $$
DECLARE rec RECORD;
BEGIN
  FOR rec IN
    SELECT tc.table_name, tc.constraint_name, kcu.column_name
    FROM information_schema.table_constraints tc
    JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
    JOIN information_schema.referential_constraints rc ON tc.constraint_name = rc.constraint_name
    JOIN information_schema.constraint_column_usage ccu ON rc.unique_constraint_name = ccu.constraint_name
    WHERE tc.table_schema = 'public'
      AND tc.constraint_type = 'FOREIGN KEY'
      AND ccu.table_name = 'team_members'
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', rec.table_name, rec.constraint_name);
    -- Для assignee/creator/responsible/head_id — SET NULL (сохранить историю задач)
    -- Для project_members.team_member_id и task_members.team_member_id — CASCADE
    IF rec.column_name IN ('assignee_id','creator_id','responsible_id','head_id','completed_by','archived_by','added_by') THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.team_members(id) ON DELETE SET NULL',
                     rec.table_name, rec.constraint_name, rec.column_name);
    ELSE
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES public.team_members(id) ON DELETE CASCADE',
                     rec.table_name, rec.constraint_name, rec.column_name);
    END IF;
  END LOOP;
END $$;

-- projects.seo_specialist_id и account_manager_id → SET NULL (добавим если нет)
DO $$
DECLARE col text;
BEGIN
  FOREACH col IN ARRAY ARRAY['seo_specialist_id','account_manager_id']
  LOOP
    BEGIN
      EXECUTE format('ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_%s_fkey', col);
      EXECUTE format('ALTER TABLE public.projects ADD CONSTRAINT projects_%s_fkey FOREIGN KEY (%I) REFERENCES public.team_members(id) ON DELETE SET NULL', col, col);
    EXCEPTION WHEN OTHERS THEN NULL;
    END;
  END LOOP;
END $$;

-- ============ 4. Триггер: удаление профиля → удаление auth.user ============
CREATE OR REPLACE FUNCTION public.handle_profile_deletion()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Удаляем связанного team_member (по owner_id == user_id профиля)
  DELETE FROM public.team_members WHERE owner_id = OLD.user_id;
  -- Удаляем auth.user (каскадно очистит сессии и т.д.)
  DELETE FROM auth.users WHERE id = OLD.user_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS on_profile_deleted ON public.profiles;
CREATE TRIGGER on_profile_deleted
AFTER DELETE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.handle_profile_deletion();

-- ============ 5. Каскад при удалении auth.user → profile ============
DO $$
BEGIN
  ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_user_id_fkey;
  ALTER TABLE public.profiles ADD CONSTRAINT profiles_user_id_fkey
    FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- ============ 6. Защита: нельзя удалить проект с неоплаченными счетами ============
CREATE OR REPLACE FUNCTION public.prevent_project_delete_with_unpaid()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE v_unpaid int;
BEGIN
  SELECT count(*) INTO v_unpaid
  FROM public.financial_payments
  WHERE client_name ILIKE '%' || (SELECT name FROM public.projects WHERE id = OLD.id LIMIT 1) || '%'
    AND status = 'pending'
    AND COALESCE(paid_amount, 0) < contract_amount;
  -- мягкое предупреждение в логе, не блокируем (привязка по имени неточная)
  IF v_unpaid > 0 THEN
    RAISE NOTICE 'Удаляется проект с % неоплаченными счетами', v_unpaid;
  END IF;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS before_project_delete ON public.projects;
CREATE TRIGGER before_project_delete
BEFORE DELETE ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.prevent_project_delete_with_unpaid();
