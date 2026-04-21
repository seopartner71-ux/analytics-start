-- 1. Soft-delete поля
ALTER TABLE public.crm_tasks
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

-- 2. Журнал удалений
CREATE TABLE IF NOT EXISTS public.deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  actor_id uuid NOT NULL,
  actor_email text NOT NULL DEFAULT '',
  actor_name text NOT NULL DEFAULT '',
  entity_type text NOT NULL,            -- 'task' | 'project' | 'employee' | ...
  entity_id uuid,
  entity_name text NOT NULL DEFAULT '',
  context jsonb NOT NULL DEFAULT '{}'::jsonb,  -- доп. поля: project_name, etc.
  action text NOT NULL DEFAULT 'archive'      -- 'archive' | 'hard_delete' | 'restore'
);

CREATE INDEX IF NOT EXISTS idx_deletion_log_created_at ON public.deletion_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deletion_log_actor ON public.deletion_log(actor_id);
CREATE INDEX IF NOT EXISTS idx_deletion_log_entity ON public.deletion_log(entity_type, entity_id);

ALTER TABLE public.deletion_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated insert deletion_log"
  ON public.deletion_log FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = actor_id);

CREATE POLICY "Admins and directors view deletion_log"
  ON public.deletion_log FOR SELECT
  TO authenticated
  USING (public.is_admin_or_director(auth.uid()));

-- 3. Защита суперадмина и self при архивировании profiles
CREATE OR REPLACE FUNCTION public.protect_super_admin_archive()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.archived_at IS NOT NULL AND OLD.archived_at IS NULL THEN
    -- запрет архивации главного админа
    IF NEW.email = 'sinitsin3@yandex.ru' THEN
      RAISE EXCEPTION 'Нельзя удалить главного администратора';
    END IF;
    -- запрет самоархивации
    IF NEW.user_id = auth.uid() THEN
      RAISE EXCEPTION 'Нельзя удалить свой аккаунт';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_super_admin_archive ON public.profiles;
CREATE TRIGGER trg_protect_super_admin_archive
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_super_admin_archive();