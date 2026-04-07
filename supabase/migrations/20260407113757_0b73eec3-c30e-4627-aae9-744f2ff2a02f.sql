
CREATE TABLE public.subtasks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  title text NOT NULL,
  is_done boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.subtasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task owners manage subtasks"
  ON public.subtasks FOR ALL
  USING (EXISTS (
    SELECT 1 FROM public.crm_tasks
    WHERE crm_tasks.id = subtasks.task_id AND crm_tasks.owner_id = auth.uid()
  ));

CREATE POLICY "Admins manage all subtasks"
  ON public.subtasks FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));
