
-- ═══════════════════════════════════════════
-- 1. Companies table
-- ═══════════════════════════════════════════
CREATE TABLE public.companies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  logo TEXT,
  type TEXT NOT NULL DEFAULT 'Клиент',
  industry TEXT,
  website TEXT,
  phone TEXT,
  email TEXT,
  address TEXT,
  inn TEXT,
  description TEXT,
  employee_count INTEGER DEFAULT 0,
  responsible_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own companies"
  ON public.companies FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can view all companies"
  ON public.companies FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════
-- 2. Deals table (linked to companies)
-- ═══════════════════════════════════════════
CREATE TABLE public.deals (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id UUID NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL DEFAULT 'Новая сделка',
  amount NUMERIC DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'Новый',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own deals"
  ON public.deals FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- ═══════════════════════════════════════════
-- 3. CRM Tasks table
-- ═══════════════════════════════════════════
CREATE TABLE public.crm_tasks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  description TEXT,
  stage TEXT NOT NULL DEFAULT 'Новые',
  stage_color TEXT DEFAULT '#3b82f6',
  stage_progress INTEGER DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'medium',
  deadline TIMESTAMP WITH TIME ZONE,
  creator_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  assignee_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.crm_tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage own tasks"
  ON public.crm_tasks FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Admins can view all tasks"
  ON public.crm_tasks FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- ═══════════════════════════════════════════
-- 4. Task Comments (Chat messages)
-- ═══════════════════════════════════════════
CREATE TABLE public.task_comments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id UUID NOT NULL REFERENCES public.crm_tasks(id) ON DELETE CASCADE,
  author_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  is_system BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.task_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Task owners manage comments"
  ON public.task_comments FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.crm_tasks
      WHERE crm_tasks.id = task_comments.task_id
        AND crm_tasks.owner_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════
-- 5. Add status field to team_members for online/offline
-- ═══════════════════════════════════════════
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS department TEXT DEFAULT 'Общий',
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'offline',
  ADD COLUMN IF NOT EXISTS last_active TIMESTAMP WITH TIME ZONE DEFAULT now();

-- ═══════════════════════════════════════════
-- 6. Add company_id to projects
-- ═══════════════════════════════════════════
ALTER TABLE public.projects
  ADD COLUMN IF NOT EXISTS company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS efficiency INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'Закрытый';

-- ═══════════════════════════════════════════
-- 7. Realtime for task comments (chat)
-- ═══════════════════════════════════════════
ALTER PUBLICATION supabase_realtime ADD TABLE public.task_comments;

-- ═══════════════════════════════════════════
-- 8. Updated_at triggers
-- ═══════════════════════════════════════════
CREATE TRIGGER update_companies_updated_at
  BEFORE UPDATE ON public.companies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_deals_updated_at
  BEFORE UPDATE ON public.deals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_crm_tasks_updated_at
  BEFORE UPDATE ON public.crm_tasks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
