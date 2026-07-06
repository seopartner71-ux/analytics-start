ALTER TABLE public.project_messages
  ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;

CREATE POLICY "Authors can update own messages"
  ON public.project_messages
  FOR UPDATE
  USING (auth.uid() = user_id AND is_system = false)
  WITH CHECK (auth.uid() = user_id AND is_system = false);