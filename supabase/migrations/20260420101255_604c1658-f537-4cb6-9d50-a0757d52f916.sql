-- Таблица участников проекта
CREATE TABLE IF NOT EXISTS public.project_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'SEO специалист',
  notifications_enabled boolean NOT NULL DEFAULT true,
  added_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, team_member_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project ON public.project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_member ON public.project_members(team_member_id);

ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;

-- Админы — полный доступ
CREATE POLICY "Admins manage all project members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Владелец проекта — полный доступ к участникам своего проекта
CREATE POLICY "Project owners manage their project members"
  ON public.project_members
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.projects p
      WHERE p.id = project_members.project_id AND p.owner_id = auth.uid()
    )
  );

-- Сотрудники проекта могут видеть список участников
CREATE POLICY "Project participants can view members"
  ON public.project_members
  FOR SELECT
  TO authenticated
  USING (public.is_project_participant(project_id, auth.uid()));

-- Триггер обновления updated_at
CREATE TRIGGER trg_project_members_updated_at
BEFORE UPDATE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Триггер: автодобавление системного сообщения в чат проекта
CREATE OR REPLACE FUNCTION public.notify_project_member_added_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    SELECT full_name INTO v_name FROM public.team_members WHERE id = NEW.team_member_id;
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (NEW.project_id, 'Система', COALESCE(v_name, 'Участник') || ' добавлен(а) в проект как «' || NEW.role || '»', true);
  ELSIF TG_OP = 'DELETE' THEN
    SELECT full_name INTO v_name FROM public.team_members WHERE id = OLD.team_member_id;
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (OLD.project_id, 'Система', COALESCE(v_name, 'Участник') || ' удалён(а) из проекта', true);
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_project_members_chat_notify
AFTER INSERT OR DELETE ON public.project_members
FOR EACH ROW EXECUTE FUNCTION public.notify_project_member_added_chat();