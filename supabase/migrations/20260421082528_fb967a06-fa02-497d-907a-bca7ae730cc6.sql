ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS last_name text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS telegram text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS "position" text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS onboarding_access boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS knowledge_edit_access boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS all_projects_access boolean NOT NULL DEFAULT false;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS confirmed_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS confirmed_by uuid;

UPDATE public.profiles
SET status = 'active', confirmed_at = COALESCE(confirmed_at, created_at)
WHERE status = 'pending'
  AND profiles.user_id IN (SELECT ur.user_id FROM public.user_roles ur);

CREATE INDEX IF NOT EXISTS idx_profiles_status ON public.profiles(status);