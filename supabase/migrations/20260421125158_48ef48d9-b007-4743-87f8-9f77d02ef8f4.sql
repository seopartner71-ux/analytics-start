-- Добавляем ИНН клиентам для надёжного матчинга банковских поступлений
ALTER TABLE public.financial_clients ADD COLUMN IF NOT EXISTS inn TEXT;
CREATE INDEX IF NOT EXISTS idx_financial_clients_inn ON public.financial_clients(inn) WHERE inn IS NOT NULL;