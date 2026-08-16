ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS service_name text;
CREATE INDEX IF NOT EXISTS idx_transactions_service_name ON public.transactions (service_name);