
-- 1. task_comments: parent_id + updated_at
ALTER TABLE public.task_comments
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS updated_at timestamptz NOT NULL DEFAULT now();

CREATE INDEX IF NOT EXISTS idx_task_comments_parent ON public.task_comments(parent_id);

-- 2. task_attachments
CREATE TABLE IF NOT EXISTS public.task_attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  file_name text NOT NULL,
  file_url text NOT NULL,
  file_path text NOT NULL,
  file_size integer NOT NULL,
  file_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_attachments_task ON public.task_attachments(task_id);
ALTER TABLE public.task_attachments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read attachments"
  ON public.task_attachments FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert own attachments"
  ON public.task_attachments FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Owner deletes own attachments"
  ON public.task_attachments FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- 3. task_mentions
CREATE TABLE IF NOT EXISTS public.task_mentions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  comment_id uuid REFERENCES public.task_comments(id) ON DELETE CASCADE,
  mentioned_user_id uuid NOT NULL,
  mentioner_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_mentions_user ON public.task_mentions(mentioned_user_id);
CREATE INDEX IF NOT EXISTS idx_task_mentions_task ON public.task_mentions(task_id);
ALTER TABLE public.task_mentions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read mentions"
  ON public.task_mentions FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert mentions"
  ON public.task_mentions FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = mentioner_id);

-- 4. task_activity_log
CREATE TABLE IF NOT EXISTS public.task_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  user_id uuid,
  action text NOT NULL,
  field_name text,
  old_value text,
  new_value text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_task_activity_task ON public.task_activity_log(task_id, created_at DESC);
ALTER TABLE public.task_activity_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read activity"
  ON public.task_activity_log FOR SELECT
  TO authenticated USING (true);

CREATE POLICY "Authenticated insert activity"
  ON public.task_activity_log FOR INSERT
  TO authenticated WITH CHECK (true);

-- 5. Триггер на crm_tasks: лог изменений stage / assignee_id / deadline / priority
CREATE OR REPLACE FUNCTION public.log_crm_task_changes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.stage IS DISTINCT FROM OLD.stage THEN
      INSERT INTO public.task_activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'stage_changed', 'stage', OLD.stage, NEW.stage);
    END IF;
    IF NEW.assignee_id IS DISTINCT FROM OLD.assignee_id THEN
      INSERT INTO public.task_activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'assignee_changed', 'assignee_id',
        OLD.assignee_id::text, NEW.assignee_id::text);
    END IF;
    IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
      INSERT INTO public.task_activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'deadline_changed', 'deadline',
        OLD.deadline::text, NEW.deadline::text);
    END IF;
    IF NEW.priority IS DISTINCT FROM OLD.priority THEN
      INSERT INTO public.task_activity_log (task_id, user_id, action, field_name, old_value, new_value)
      VALUES (NEW.id, auth.uid(), 'priority_changed', 'priority',
        OLD.priority::text, NEW.priority::text);
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_log_crm_task_changes ON public.crm_tasks;
CREATE TRIGGER trg_log_crm_task_changes
AFTER UPDATE ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.log_crm_task_changes();

-- 6. Storage bucket
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'task-attachments',
  'task-attachments',
  false,
  10485760,
  ARRAY[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/png','image/jpeg','image/webp'
  ]
)
ON CONFLICT (id) DO UPDATE SET
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "Auth read task-attachments"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'task-attachments');

CREATE POLICY "Auth upload task-attachments"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'task-attachments');

CREATE POLICY "Auth delete own task-attachments"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'task-attachments' AND owner = auth.uid());
