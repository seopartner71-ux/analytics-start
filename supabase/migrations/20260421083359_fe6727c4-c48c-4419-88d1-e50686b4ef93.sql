-- 1. Добавить user_id в существующую таблицу
ALTER TABLE public.project_members ADD COLUMN IF NOT EXISTS user_id uuid;
CREATE INDEX IF NOT EXISTS idx_project_members_user_id ON public.project_members(user_id);

-- 2. Helper: глобальный доступ ко всем проектам (admin/director)
CREATE OR REPLACE FUNCTION public.has_all_projects_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = _user_id AND ur.role IN ('admin'::app_role, 'director'::app_role)
  ) OR EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = _user_id AND p.all_projects_access = true
  );
$$;

-- 3. Helper: видимость конкретного проекта
CREATE OR REPLACE FUNCTION public.can_view_project(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT
    public.has_all_projects_access(_user_id)
    OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = _project_id AND p.owner_id = _user_id)
    OR EXISTS (SELECT 1 FROM public.project_members pm WHERE pm.project_id = _project_id AND pm.user_id = _user_id)
    OR public.is_project_participant(_project_id, _user_id);
$$;

-- 4. Helper: статус активный
CREATE OR REPLACE FUNCTION public.is_active_user(_user_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.user_id = _user_id AND p.status = 'active');
$$;

-- 5. Триггер регистрации
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_user_count int;
BEGIN
  SELECT COUNT(*) INTO v_user_count FROM public.profiles;

  IF v_user_count = 0 THEN
    INSERT INTO public.profiles (user_id, email, full_name, status, confirmed_at)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'active', now());
    INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.profiles (user_id, email, full_name, status)
    VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), 'pending');

    INSERT INTO public.notifications (user_id, title, body, kind)
    SELECT ur.user_id,
           '🟡 Новый пользователь ждёт подтверждения',
           COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email) || ' зарегистрировался(ась).',
           'user_pending'
    FROM public.user_roles ur
    WHERE ur.role = 'admin';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. Политика на project_members для видимости пользователю своих привязок
DROP POLICY IF EXISTS "Users see own project_members rows" ON public.project_members;
CREATE POLICY "Users see own project_members rows"
ON public.project_members FOR SELECT
USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin') OR public.has_all_projects_access(auth.uid()));

DROP POLICY IF EXISTS "Admins manage project_members user attach" ON public.project_members;
CREATE POLICY "Admins manage project_members user attach"
ON public.project_members FOR ALL
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));