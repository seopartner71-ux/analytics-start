-- ============================================================
-- 1. ENUMS
-- ============================================================
DO $$ BEGIN
  CREATE TYPE public.task_priority AS ENUM ('low', 'medium', 'high');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_status AS ENUM ('new', 'pending', 'in_progress', 'awaiting_control', 'completed', 'deferred');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.task_member_role AS ENUM ('accomplice', 'auditor');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- 2. EXTEND crm_tasks
-- ============================================================
ALTER TABLE public.crm_tasks ALTER COLUMN priority DROP DEFAULT;
ALTER TABLE public.crm_tasks
  ALTER COLUMN priority TYPE public.task_priority
  USING (CASE WHEN priority IN ('low','medium','high')
              THEN priority::public.task_priority
              ELSE 'medium'::public.task_priority END);
ALTER TABLE public.crm_tasks ALTER COLUMN priority SET DEFAULT 'medium'::public.task_priority;

ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS status public.task_status NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS requires_approval boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS is_expired boolean NOT NULL DEFAULT false;

-- Helper for on-the-fly expiry calc (immutable inputs only inside expression)
CREATE OR REPLACE FUNCTION public.task_is_expired(_deadline timestamptz, _status public.task_status)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT _deadline IS NOT NULL
     AND _deadline < now()
     AND _status NOT IN ('completed'::public.task_status, 'deferred'::public.task_status);
$$;

-- Trigger maintains is_expired on writes
CREATE OR REPLACE FUNCTION public.maintain_task_is_expired()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.is_expired := (
    NEW.deadline IS NOT NULL
    AND NEW.deadline < now()
    AND NEW.status NOT IN ('completed'::public.task_status, 'deferred'::public.task_status)
  );
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_maintain_task_is_expired ON public.crm_tasks;
CREATE TRIGGER trg_maintain_task_is_expired
BEFORE INSERT OR UPDATE OF deadline, status ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.maintain_task_is_expired();

-- ============================================================
-- 3. SYNC stage <-> status
-- ============================================================
CREATE OR REPLACE FUNCTION public.sync_task_stage_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE
  v_status_from_stage public.task_status;
  v_stage_from_status text;
BEGIN
  IF TG_OP = 'INSERT' OR NEW.stage IS DISTINCT FROM COALESCE(OLD.stage, '') THEN
    v_status_from_stage := CASE NEW.stage
      WHEN 'Новые'       THEN 'new'::public.task_status
      WHEN 'В работе'    THEN 'in_progress'::public.task_status
      WHEN 'На проверке' THEN 'awaiting_control'::public.task_status
      WHEN 'Возвращена'  THEN 'in_progress'::public.task_status
      WHEN 'Принята'     THEN 'completed'::public.task_status
      WHEN 'Завершена'   THEN 'completed'::public.task_status
      ELSE NULL
    END;
    IF v_status_from_stage IS NOT NULL
       AND (TG_OP = 'INSERT' OR NEW.status IS NOT DISTINCT FROM OLD.status) THEN
      NEW.status := v_status_from_stage;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.status IS DISTINCT FROM OLD.status
     AND NEW.stage IS NOT DISTINCT FROM OLD.stage THEN
    v_stage_from_status := CASE NEW.status
      WHEN 'new'              THEN 'Новые'
      WHEN 'pending'          THEN 'Новые'
      WHEN 'in_progress'      THEN 'В работе'
      WHEN 'awaiting_control' THEN 'На проверке'
      WHEN 'completed'        THEN 'Завершена'
      WHEN 'deferred'         THEN 'Возвращена'
      ELSE NEW.stage
    END;
    NEW.stage := v_stage_from_status;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_task_stage_status ON public.crm_tasks;
CREATE TRIGGER trg_sync_task_stage_status
BEFORE INSERT OR UPDATE OF stage, status ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.sync_task_stage_status();

UPDATE public.crm_tasks SET status = CASE stage
  WHEN 'Новые'       THEN 'new'::public.task_status
  WHEN 'В работе'    THEN 'in_progress'::public.task_status
  WHEN 'На проверке' THEN 'awaiting_control'::public.task_status
  WHEN 'Возвращена'  THEN 'in_progress'::public.task_status
  WHEN 'Принята'     THEN 'completed'::public.task_status
  WHEN 'Завершена'   THEN 'completed'::public.task_status
  ELSE 'new'::public.task_status
END;

UPDATE public.crm_tasks
SET is_expired = (deadline IS NOT NULL AND deadline < now()
                  AND status NOT IN ('completed'::public.task_status,'deferred'::public.task_status));

-- ============================================================
-- 4. DEADLINE <= PROJECT DEADLINE
-- ============================================================
CREATE OR REPLACE FUNCTION public.validate_task_deadline()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE v_project_deadline timestamptz;
BEGIN
  IF NEW.deadline IS NULL OR NEW.project_id IS NULL THEN RETURN NEW; END IF;
  SELECT deadline INTO v_project_deadline FROM public.projects WHERE id = NEW.project_id;
  IF v_project_deadline IS NOT NULL AND NEW.deadline > v_project_deadline THEN
    RAISE EXCEPTION 'Срок задачи (%) не может быть позже срока проекта (%)',
      NEW.deadline, v_project_deadline USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validate_task_deadline ON public.crm_tasks;
CREATE TRIGGER trg_validate_task_deadline
BEFORE INSERT OR UPDATE OF deadline, project_id ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.validate_task_deadline();

-- ============================================================
-- 5. STATE-MACHINE HELPERS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_task_responsible(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_tasks t
    JOIN public.team_members tm ON tm.id = t.assignee_id
    WHERE t.id = _task_id AND tm.owner_id = _user_id
  );
$$;

CREATE OR REPLACE FUNCTION public.is_task_creator(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.crm_tasks t
    WHERE t.id = _task_id
      AND ( t.owner_id = _user_id
         OR EXISTS (SELECT 1 FROM public.team_members tm
                    WHERE tm.id = t.creator_id AND tm.owner_id = _user_id))
  );
$$;

-- ============================================================
-- 6. TASK MEMBERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.task_members (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  team_member_id uuid NOT NULL REFERENCES public.team_members(id) ON DELETE CASCADE,
  role public.task_member_role NOT NULL,
  added_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (task_id, team_member_id, role)
);
CREATE INDEX IF NOT EXISTS idx_task_members_task ON public.task_members(task_id);
CREATE INDEX IF NOT EXISTS idx_task_members_member ON public.task_members(team_member_id);
ALTER TABLE public.task_members ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_task_accomplice(_task_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.task_members tm
    JOIN public.team_members m ON m.id = tm.team_member_id
    WHERE tm.task_id = _task_id
      AND tm.role = 'accomplice'::public.task_member_role
      AND m.owner_id = _user_id
  );
$$;

DROP POLICY IF EXISTS "Admins manage all task_members" ON public.task_members;
CREATE POLICY "Admins manage all task_members" ON public.task_members
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Task creator/owner manage task_members" ON public.task_members;
CREATE POLICY "Task creator/owner manage task_members" ON public.task_members
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.crm_tasks t WHERE t.id = task_members.task_id AND t.owner_id = auth.uid())
    OR public.is_task_creator(task_members.task_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.crm_tasks t WHERE t.id = task_members.task_id AND t.owner_id = auth.uid())
    OR public.is_task_creator(task_members.task_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can view own task_members" ON public.task_members;
CREATE POLICY "Members can view own task_members" ON public.task_members
  FOR SELECT TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.team_members tm
            WHERE tm.id = task_members.team_member_id AND tm.owner_id = auth.uid())
    OR EXISTS (SELECT 1 FROM public.crm_tasks t
               WHERE t.id = task_members.task_id AND t.owner_id = auth.uid())
  );

-- ============================================================
-- 7. STATE MACHINE TRIGGER
-- ============================================================
CREATE OR REPLACE FUNCTION public.enforce_task_status_transition()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid uuid := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RETURN NEW; END IF;
  IF NEW.status IS NOT DISTINCT FROM OLD.status THEN RETURN NEW; END IF;
  IF public.is_admin_or_director(v_uid) THEN RETURN NEW; END IF;

  IF NEW.status = 'in_progress'::public.task_status THEN
    IF NOT (public.is_task_responsible(NEW.id, v_uid)
         OR public.is_task_accomplice(NEW.id, v_uid)
         OR public.is_task_creator(NEW.id, v_uid)) THEN
      RAISE EXCEPTION 'Только ответственный или соисполнитель может взять задачу в работу'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF NEW.status IN ('awaiting_control'::public.task_status, 'completed'::public.task_status)
     AND OLD.status = 'in_progress'::public.task_status THEN
    IF NEW.status = 'completed'::public.task_status
       AND NEW.requires_approval = true
       AND NOT public.is_task_creator(NEW.id, v_uid) THEN
      RAISE EXCEPTION 'Задача требует подтверждения: используйте статус "На проверке"'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
    IF NEW.status = 'awaiting_control'::public.task_status
       AND NOT (public.is_task_responsible(NEW.id, v_uid)
            OR public.is_task_creator(NEW.id, v_uid)) THEN
      RAISE EXCEPTION 'Только ответственный может отправить задачу на проверку'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  IF OLD.status = 'awaiting_control'::public.task_status THEN
    IF NEW.status IN ('completed'::public.task_status, 'in_progress'::public.task_status)
       AND NOT public.is_task_creator(NEW.id, v_uid) THEN
      RAISE EXCEPTION 'Только создатель задачи может принять работу или вернуть на доработку'
        USING ERRCODE = 'insufficient_privilege';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_enforce_task_status_transition ON public.crm_tasks;
CREATE TRIGGER trg_enforce_task_status_transition
BEFORE UPDATE OF status ON public.crm_tasks
FOR EACH ROW EXECUTE FUNCTION public.enforce_task_status_transition();

-- ============================================================
-- 8. CHECKLISTS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.checklists (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id uuid NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  text text NOT NULL,
  is_completed boolean NOT NULL DEFAULT false,
  assigned_to uuid REFERENCES public.team_members(id) ON DELETE SET NULL,
  sort_order integer NOT NULL DEFAULT 0,
  completed_at timestamptz,
  completed_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_checklists_task ON public.checklists(task_id);
CREATE INDEX IF NOT EXISTS idx_checklists_assigned ON public.checklists(assigned_to) WHERE assigned_to IS NOT NULL;

DROP TRIGGER IF EXISTS trg_checklists_updated_at ON public.checklists;
CREATE TRIGGER trg_checklists_updated_at
BEFORE UPDATE ON public.checklists
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins manage all checklists" ON public.checklists;
CREATE POLICY "Admins manage all checklists" ON public.checklists
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

DROP POLICY IF EXISTS "Task owner manage checklists" ON public.checklists;
CREATE POLICY "Task owner manage checklists" ON public.checklists
  FOR ALL TO authenticated
  USING (
    EXISTS (SELECT 1 FROM public.crm_tasks t WHERE t.id = checklists.task_id AND t.owner_id = auth.uid())
    OR public.is_task_creator(checklists.task_id, auth.uid())
    OR public.is_task_responsible(checklists.task_id, auth.uid())
  )
  WITH CHECK (
    EXISTS (SELECT 1 FROM public.crm_tasks t WHERE t.id = checklists.task_id AND t.owner_id = auth.uid())
    OR public.is_task_creator(checklists.task_id, auth.uid())
    OR public.is_task_responsible(checklists.task_id, auth.uid())
  );

DROP POLICY IF EXISTS "Members can view checklist items" ON public.checklists;
CREATE POLICY "Members can view checklist items" ON public.checklists
  FOR SELECT TO authenticated
  USING (
    public.is_task_accomplice(checklists.task_id, auth.uid())
    OR EXISTS (SELECT 1 FROM public.team_members tm
               WHERE tm.id = checklists.assigned_to AND tm.owner_id = auth.uid())
  );

-- ============================================================
-- 9. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_crm_tasks_status ON public.crm_tasks(status);
CREATE INDEX IF NOT EXISTS idx_crm_tasks_parent ON public.crm_tasks(parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_deadline ON public.crm_tasks(deadline) WHERE deadline IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_creator ON public.crm_tasks(creator_id) WHERE creator_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_crm_tasks_expired ON public.crm_tasks(is_expired) WHERE is_expired = true;