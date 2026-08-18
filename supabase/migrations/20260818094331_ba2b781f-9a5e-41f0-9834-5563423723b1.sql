ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS paid_personally boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS reimbursed_at timestamptz;