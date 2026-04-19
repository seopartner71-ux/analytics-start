
-- Onboarding checklist per project
CREATE TABLE public.project_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  item_key text NOT NULL,
  checked boolean NOT NULL DEFAULT false,
  assignee_id uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  completed_by uuid,
  completed_by_name text,
  completed_at timestamptz,
  task_id uuid REFERENCES public.crm_tasks(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, item_key)
);

ALTER TABLE public.project_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Project owners manage onboarding"
ON public.project_onboarding FOR ALL
USING (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_onboarding.project_id AND p.owner_id = auth.uid()))
WITH CHECK (EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_onboarding.project_id AND p.owner_id = auth.uid()));

CREATE POLICY "Admins view all onboarding"
ON public.project_onboarding FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Participants view onboarding"
ON public.project_onboarding FOR SELECT TO authenticated
USING (is_project_participant(project_id, auth.uid()));

CREATE POLICY "Participants update onboarding"
ON public.project_onboarding FOR UPDATE TO authenticated
USING (is_project_participant(project_id, auth.uid()));

CREATE POLICY "Participants insert onboarding"
ON public.project_onboarding FOR INSERT TO authenticated
WITH CHECK (is_project_participant(project_id, auth.uid()) OR EXISTS (SELECT 1 FROM public.projects p WHERE p.id = project_onboarding.project_id AND p.owner_id = auth.uid()));

CREATE TRIGGER trg_onboarding_updated
BEFORE UPDATE ON public.project_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create crm_task when assignee is set
CREATE OR REPLACE FUNCTION public.onboarding_auto_create_task()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_owner uuid;
  v_task_id uuid;
  v_label text;
BEGIN
  IF NEW.assignee_id IS NULL OR NEW.task_id IS NOT NULL THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' AND OLD.assignee_id IS NOT DISTINCT FROM NEW.assignee_id THEN
    RETURN NEW;
  END IF;

  SELECT owner_id INTO v_owner FROM public.projects WHERE id = NEW.project_id;
  IF v_owner IS NULL THEN
    RETURN NEW;
  END IF;

  v_label := 'Онбординг: ' || NEW.item_key;

  INSERT INTO public.crm_tasks (owner_id, project_id, title, description, assignee_id, stage, priority)
  VALUES (v_owner, NEW.project_id, v_label, 'Автоматическая задача из чеклиста онбординга', NEW.assignee_id, 'Новые', 'medium')
  RETURNING id INTO v_task_id;

  NEW.task_id := v_task_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_onboarding_auto_task
BEFORE INSERT OR UPDATE OF assignee_id ON public.project_onboarding
FOR EACH ROW EXECUTE FUNCTION public.onboarding_auto_create_task();
