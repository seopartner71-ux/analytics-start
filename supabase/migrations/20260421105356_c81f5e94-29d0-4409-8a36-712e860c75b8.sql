-- Add soft-delete columns to team_members
ALTER TABLE public.team_members
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS archived_by uuid;

CREATE INDEX IF NOT EXISTS idx_team_members_archived_at ON public.team_members(archived_at);