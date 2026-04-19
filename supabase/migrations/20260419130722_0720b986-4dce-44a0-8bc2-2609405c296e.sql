-- Reactions table for chat messages
CREATE TABLE public.project_message_reactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid NOT NULL REFERENCES public.project_messages(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  user_name text NOT NULL DEFAULT '',
  emoji text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (message_id, user_id, emoji)
);

CREATE INDEX idx_pmr_message ON public.project_message_reactions(message_id);

ALTER TABLE public.project_message_reactions ENABLE ROW LEVEL SECURITY;

-- View: any project participant can see reactions
CREATE POLICY "Participants view reactions"
ON public.project_message_reactions
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.project_messages m
    WHERE m.id = project_message_reactions.message_id
      AND (public.is_project_participant(m.project_id, auth.uid()) OR public.has_role(auth.uid(), 'admin'::app_role))
  )
);

-- Insert: only as self, only if participant
CREATE POLICY "Participants add own reactions"
ON public.project_message_reactions
FOR INSERT
WITH CHECK (
  auth.uid() = user_id
  AND EXISTS (
    SELECT 1 FROM public.project_messages m
    WHERE m.id = project_message_reactions.message_id
      AND public.is_project_participant(m.project_id, auth.uid())
  )
);

-- Delete: only own
CREATE POLICY "Users delete own reactions"
ON public.project_message_reactions
FOR DELETE
USING (auth.uid() = user_id);

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.project_message_reactions;