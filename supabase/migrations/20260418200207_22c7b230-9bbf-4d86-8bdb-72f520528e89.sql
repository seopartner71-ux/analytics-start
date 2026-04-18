-- Time tracking for CRM tasks
CREATE TABLE public.task_time_entries (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at TIMESTAMPTZ,
  duration_minutes INTEGER NOT NULL DEFAULT 0,
  comment TEXT,
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_tte_user_date ON public.task_time_entries(user_id, entry_date DESC);
CREATE INDEX idx_tte_task ON public.task_time_entries(task_id);
CREATE INDEX idx_tte_project_date ON public.task_time_entries(project_id, entry_date DESC);

ALTER TABLE public.task_time_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own time entries"
ON public.task_time_entries FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins view all time entries"
ON public.task_time_entries FOR SELECT
TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Project owners view project time entries"
ON public.task_time_entries FOR SELECT
TO authenticated
USING (
  project_id IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.projects p
    WHERE p.id = task_time_entries.project_id AND p.owner_id = auth.uid()
  )
);

CREATE TRIGGER trg_tte_updated_at
BEFORE UPDATE ON public.task_time_entries
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-calculate duration when ended_at is set
CREATE OR REPLACE FUNCTION public.calc_time_entry_duration()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.ended_at IS NOT NULL AND NEW.started_at IS NOT NULL THEN
    NEW.duration_minutes := GREATEST(0, EXTRACT(EPOCH FROM (NEW.ended_at - NEW.started_at))::int / 60);
  END IF;
  NEW.entry_date := COALESCE(NEW.entry_date, (NEW.started_at AT TIME ZONE 'UTC')::date);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_tte_calc_duration
BEFORE INSERT OR UPDATE ON public.task_time_entries
FOR EACH ROW EXECUTE FUNCTION public.calc_time_entry_duration();