
-- Create team_members table
CREATE TABLE public.team_members (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  role TEXT NOT NULL DEFAULT 'seo' CHECK (role IN ('seo', 'account_manager')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- RLS policy: owners manage their own team members
CREATE POLICY "Owners manage team_members" ON public.team_members
  FOR ALL TO public
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

-- Add trigger for updated_at
CREATE TRIGGER update_team_members_updated_at
  BEFORE UPDATE ON public.team_members
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add foreign key columns to projects for linking team members
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS seo_specialist_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;
ALTER TABLE public.projects ADD COLUMN IF NOT EXISTS account_manager_id UUID REFERENCES public.team_members(id) ON DELETE SET NULL;
