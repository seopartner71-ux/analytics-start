-- ============== MESSENGER SCHEMA ==============

-- Conversations (direct, group, project, company)
CREATE TABLE IF NOT EXISTS public.conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  type text NOT NULL CHECK (type IN ('direct','group','project','company')),
  title text,
  project_id uuid REFERENCES public.projects(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  last_message_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_conversations_type ON public.conversations(type);
CREATE INDEX IF NOT EXISTS idx_conversations_project ON public.conversations(project_id);
CREATE INDEX IF NOT EXISTS idx_conversations_last_msg ON public.conversations(last_message_at DESC);

-- Participants
CREATE TABLE IF NOT EXISTS public.conversation_participants (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  joined_at timestamptz NOT NULL DEFAULT now(),
  last_read_at timestamptz NOT NULL DEFAULT now(),
  muted boolean NOT NULL DEFAULT false,
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_conv_part_user ON public.conversation_participants(user_id);

-- Messages
CREATE TABLE IF NOT EXISTS public.dm_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  body text NOT NULL DEFAULT '',
  attachments jsonb NOT NULL DEFAULT '[]'::jsonb,
  is_system boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_dm_messages_conv ON public.dm_messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_messages_user ON public.dm_messages(user_id);

-- Online presence
CREATE TABLE IF NOT EXISTS public.user_presence (
  user_id uuid PRIMARY KEY,
  last_seen_at timestamptz NOT NULL DEFAULT now(),
  is_online boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Trigger: bump conversation last_message_at on new message
CREATE OR REPLACE FUNCTION public.bump_conversation_last_message()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE public.conversations SET last_message_at = NEW.created_at, updated_at = now() WHERE id = NEW.conversation_id;
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS trg_bump_conversation_last_message ON public.dm_messages;
CREATE TRIGGER trg_bump_conversation_last_message
AFTER INSERT ON public.dm_messages
FOR EACH ROW EXECUTE FUNCTION public.bump_conversation_last_message();

-- Helper: is participant
CREATE OR REPLACE FUNCTION public.is_conversation_participant(_conv_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.conversation_participants
    WHERE conversation_id = _conv_id AND user_id = _user_id
  );
$$;

-- Helper: get or create direct conversation between two users
CREATE OR REPLACE FUNCTION public.get_or_create_direct_conversation(_other_user uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF v_me = _other_user THEN RAISE EXCEPTION 'cannot DM self'; END IF;

  SELECT c.id INTO v_conv
  FROM public.conversations c
  WHERE c.type = 'direct'
    AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c.id AND user_id = v_me)
    AND EXISTS (SELECT 1 FROM public.conversation_participants WHERE conversation_id = c.id AND user_id = _other_user)
    AND (SELECT count(*) FROM public.conversation_participants WHERE conversation_id = c.id) = 2
  LIMIT 1;

  IF v_conv IS NOT NULL THEN RETURN v_conv; END IF;

  INSERT INTO public.conversations (type, created_by) VALUES ('direct', v_me) RETURNING id INTO v_conv;
  INSERT INTO public.conversation_participants (conversation_id, user_id) VALUES (v_conv, v_me), (v_conv, _other_user);
  RETURN v_conv;
END; $$;

-- Helper: get or create company-wide conversation
CREATE OR REPLACE FUNCTION public.get_or_create_company_conversation()
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conv uuid;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;

  SELECT id INTO v_conv FROM public.conversations WHERE type='company' LIMIT 1;
  IF v_conv IS NULL THEN
    INSERT INTO public.conversations (type, title, created_by) VALUES ('company', 'Общий чат', v_me) RETURNING id INTO v_conv;
  END IF;

  -- Ensure caller is a participant
  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv, v_me) ON CONFLICT DO NOTHING;

  RETURN v_conv;
END; $$;

-- Helper: get or create project conversation
CREATE OR REPLACE FUNCTION public.get_or_create_project_conversation(_project_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_me uuid := auth.uid();
  v_conv uuid;
  v_project_name text;
BEGIN
  IF v_me IS NULL THEN RAISE EXCEPTION 'not authenticated'; END IF;
  IF NOT public.can_view_project(_project_id, v_me) THEN
    RAISE EXCEPTION 'no access to project';
  END IF;

  SELECT id INTO v_conv FROM public.conversations WHERE type='project' AND project_id = _project_id LIMIT 1;
  IF v_conv IS NULL THEN
    SELECT name INTO v_project_name FROM public.projects WHERE id = _project_id;
    INSERT INTO public.conversations (type, title, project_id, created_by) VALUES ('project', v_project_name, _project_id, v_me) RETURNING id INTO v_conv;
  END IF;

  INSERT INTO public.conversation_participants (conversation_id, user_id)
  VALUES (v_conv, v_me) ON CONFLICT DO NOTHING;

  RETURN v_conv;
END; $$;

-- Mark conversation as read
CREATE OR REPLACE FUNCTION public.mark_conversation_read(_conv_id uuid)
RETURNS void LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE public.conversation_participants
  SET last_read_at = now()
  WHERE conversation_id = _conv_id AND user_id = auth.uid();
$$;

-- Update presence
CREATE OR REPLACE FUNCTION public.touch_user_presence()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_me uuid := auth.uid();
BEGIN
  IF v_me IS NULL THEN RETURN; END IF;
  INSERT INTO public.user_presence (user_id, last_seen_at, is_online, updated_at)
  VALUES (v_me, now(), true, now())
  ON CONFLICT (user_id) DO UPDATE SET last_seen_at = now(), is_online = true, updated_at = now();
END; $$;

-- ============== RLS ==============
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dm_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_presence ENABLE ROW LEVEL SECURITY;

-- conversations
CREATE POLICY "View conversations user is in" ON public.conversations FOR SELECT TO authenticated
USING (public.is_conversation_participant(id, auth.uid()) OR type='company');

CREATE POLICY "Authenticated can create conversations" ON public.conversations FOR INSERT TO authenticated
WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators or admins can update conversations" ON public.conversations FOR UPDATE TO authenticated
USING (created_by = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- participants
CREATE POLICY "View participants of own conversations" ON public.conversation_participants FOR SELECT TO authenticated
USING (
  user_id = auth.uid()
  OR public.is_conversation_participant(conversation_id, auth.uid())
);

CREATE POLICY "Insert participants if member or company" ON public.conversation_participants FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  OR public.is_conversation_participant(conversation_id, auth.uid())
  OR public.has_role(auth.uid(),'admin')
);

CREATE POLICY "Update own participation" ON public.conversation_participants FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Leave conversations" ON public.conversation_participants FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- messages
CREATE POLICY "View messages in own conversations" ON public.dm_messages FOR SELECT TO authenticated
USING (public.is_conversation_participant(conversation_id, auth.uid())
       OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.type='company'));

CREATE POLICY "Send messages in own conversations" ON public.dm_messages FOR INSERT TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND (
    public.is_conversation_participant(conversation_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.conversations c WHERE c.id = conversation_id AND c.type='company')
  )
);

CREATE POLICY "Edit own messages" ON public.dm_messages FOR UPDATE TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Delete own messages or admin" ON public.dm_messages FOR DELETE TO authenticated
USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- presence
CREATE POLICY "Anyone authenticated can view presence" ON public.user_presence FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users update own presence" ON public.user_presence FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own presence row" ON public.user_presence FOR UPDATE TO authenticated USING (user_id = auth.uid());

-- Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.dm_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
ALTER PUBLICATION supabase_realtime ADD TABLE public.conversation_participants;
ALTER PUBLICATION supabase_realtime ADD TABLE public.user_presence;

-- Storage bucket for messenger attachments
INSERT INTO storage.buckets (id, name, public) VALUES ('messenger', 'messenger', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Messenger files public read" ON storage.objects FOR SELECT
USING (bucket_id = 'messenger');

CREATE POLICY "Authenticated upload messenger files" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id = 'messenger' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "Owner deletes messenger files" ON storage.objects FOR DELETE TO authenticated
USING (bucket_id = 'messenger' AND auth.uid()::text = (storage.foldername(name))[1]);