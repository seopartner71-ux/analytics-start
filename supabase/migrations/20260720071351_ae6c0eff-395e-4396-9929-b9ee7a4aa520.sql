
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS avatar_url TEXT,
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Позволяем создателю видеть только что созданную беседу (даже до добавления участников)
DROP POLICY IF EXISTS "View conversations user is in" ON public.conversations;
CREATE POLICY "View conversations user is in"
ON public.conversations FOR SELECT
USING (
  is_conversation_participant(id, auth.uid())
  OR type = 'company'
  OR created_by = auth.uid()
  OR has_role(auth.uid(), 'admin'::app_role)
);
