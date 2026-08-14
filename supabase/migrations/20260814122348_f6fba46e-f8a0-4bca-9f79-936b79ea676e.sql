ALTER TABLE public.financial_clients
  ADD COLUMN IF NOT EXISTS short_name text,
  ADD COLUMN IF NOT EXISTS management_name text,
  ADD COLUMN IF NOT EXISTS org_status text,
  ADD COLUMN IF NOT EXISTS okved text,
  ADD COLUMN IF NOT EXISTS okved_name text;