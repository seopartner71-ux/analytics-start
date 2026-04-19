-- ============================================
-- Project Chat: tables, RLS, triggers, storage
-- ============================================

-- 1. Messages table
CREATE TABLE public.project_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID,
  user_name TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  is_system BOOLEAN NOT NULL DEFAULT false,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_mime TEXT,
  mentions UUID[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_messages_project_created ON public.project_messages(project_id, created_at DESC);
CREATE INDEX idx_project_messages_search ON public.project_messages USING gin(to_tsvector('russian', body));

-- 2. Read receipts (per user, per project)
CREATE TABLE public.project_message_reads (
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  last_read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (project_id, user_id)
);

-- 3. Helper function: is user a participant of the project?
CREATE OR REPLACE FUNCTION public.is_project_participant(_project_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = _project_id
      AND (
        p.owner_id = _user_id
        OR EXISTS (
          SELECT 1 FROM public.team_members tm
          WHERE tm.owner_id = _user_id
            AND (tm.id = p.seo_specialist_id OR tm.id = p.account_manager_id)
        )
      )
  )
$$;

-- 4. RLS
ALTER TABLE public.project_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_message_reads ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view project messages"
  ON public.project_messages FOR SELECT
  USING (public.is_project_participant(project_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Participants can insert messages"
  ON public.project_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND is_system = false
    AND public.is_project_participant(project_id, auth.uid())
  );

CREATE POLICY "Authors can delete own messages"
  ON public.project_messages FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "Users manage own read receipts"
  ON public.project_message_reads FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 5. Realtime
ALTER TABLE public.project_messages REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_messages;

-- 6. Trigger: system message on participant change
CREATE OR REPLACE FUNCTION public.notify_project_member_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_old_seo uuid;
  v_new_seo uuid;
  v_old_acc uuid;
  v_new_acc uuid;
  v_name text;
BEGIN
  v_old_seo := CASE WHEN TG_OP = 'UPDATE' THEN OLD.seo_specialist_id ELSE NULL END;
  v_new_seo := NEW.seo_specialist_id;
  v_old_acc := CASE WHEN TG_OP = 'UPDATE' THEN OLD.account_manager_id ELSE NULL END;
  v_new_acc := NEW.account_manager_id;

  -- SEO specialist added
  IF v_new_seo IS NOT NULL AND v_new_seo IS DISTINCT FROM v_old_seo THEN
    SELECT full_name INTO v_name FROM public.team_members WHERE id = v_new_seo;
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (NEW.id, 'Система', COALESCE(v_name, 'SEO-специалист') || ' добавлен(а) в проект', true);
  END IF;

  -- SEO specialist removed
  IF v_old_seo IS NOT NULL AND v_old_seo IS DISTINCT FROM v_new_seo THEN
    SELECT full_name INTO v_name FROM public.team_members WHERE id = v_old_seo;
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (NEW.id, 'Система', COALESCE(v_name, 'SEO-специалист') || ' удалён(а) из проекта', true);
  END IF;

  -- Account manager added
  IF v_new_acc IS NOT NULL AND v_new_acc IS DISTINCT FROM v_old_acc THEN
    SELECT full_name INTO v_name FROM public.team_members WHERE id = v_new_acc;
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (NEW.id, 'Система', COALESCE(v_name, 'Аккаунт-менеджер') || ' добавлен(а) в проект', true);
  END IF;

  -- Account manager removed
  IF v_old_acc IS NOT NULL AND v_old_acc IS DISTINCT FROM v_new_acc THEN
    SELECT full_name INTO v_name FROM public.team_members WHERE id = v_old_acc;
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (NEW.id, 'Система', COALESCE(v_name, 'Аккаунт-менеджер') || ' удалён(а) из проекта', true);
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_project_member_change
AFTER INSERT OR UPDATE OF seo_specialist_id, account_manager_id ON public.projects
FOR EACH ROW EXECUTE FUNCTION public.notify_project_member_change();

-- 7. Trigger: system message on task lifecycle
CREATE OR REPLACE FUNCTION public.notify_task_lifecycle_to_chat()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.project_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.project_messages (project_id, user_name, body, is_system)
    VALUES (NEW.project_id, 'Система', 'Создана задача: ' || NEW.title, true);
  ELSIF TG_OP = 'UPDATE' AND OLD.stage IS DISTINCT FROM NEW.stage THEN
    IF NEW.stage IN ('Завершена', 'Принята') THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', 'Задача завершена: ' || NEW.title, true);
    ELSIF NEW.stage = 'Возвращена' THEN
      INSERT INTO public.project_messages (project_id, user_name, body, is_system)
      VALUES (NEW.project_id, 'Система', 'Задача возвращена на доработку: ' || NEW.title, true);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_task_lifecycle_chat
AFTER INSERT OR UPDATE OF stage ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.notify_task_lifecycle_to_chat();

-- 8. Storage bucket for chat attachments
INSERT INTO storage.buckets (id, name, public)
VALUES ('chat-attachments', 'chat-attachments', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users upload chat attachments"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Public read chat attachments"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "Users delete own chat attachments"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'chat-attachments' AND auth.uid()::text = (storage.foldername(name))[1]);