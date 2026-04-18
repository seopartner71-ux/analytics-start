
-- 1. Таблица интеграций с банками
CREATE TABLE public.bank_integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL,
  provider text NOT NULL CHECK (provider IN ('tochka','tinkoff','sber','modulbank','alfa','other')),
  display_name text NOT NULL DEFAULT '',
  access_token text,
  refresh_token text,
  expires_at timestamptz,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','active','expired','error','disconnected')),
  error_message text,
  last_sync_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.bank_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages bank_integrations"
  ON public.bank_integrations FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_bank_integrations_owner ON public.bank_integrations(owner_id);

CREATE TRIGGER bank_integrations_updated_at
  BEFORE UPDATE ON public.bank_integrations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 2. Таблица счетов
CREATE TABLE public.bank_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  integration_id uuid NOT NULL REFERENCES public.bank_integrations(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  account_number text NOT NULL,
  bank_name text NOT NULL DEFAULT '',
  bik text,
  currency text NOT NULL DEFAULT 'RUB',
  balance numeric NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  last_sync_at timestamptz,
  meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (integration_id, account_number)
);

ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages bank_accounts"
  ON public.bank_accounts FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_bank_accounts_owner ON public.bank_accounts(owner_id);
CREATE INDEX idx_bank_accounts_integration ON public.bank_accounts(integration_id);

CREATE TRIGGER bank_accounts_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- 3. Таблица операций
CREATE TABLE public.bank_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL,
  external_id text,
  operation_date date NOT NULL,
  amount numeric NOT NULL,
  direction text NOT NULL CHECK (direction IN ('in','out')),
  counterparty text NOT NULL DEFAULT '',
  counterparty_inn text,
  purpose text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  linked_invoice_id uuid REFERENCES public.finance_invoices(id) ON DELETE SET NULL,
  linked_expense_id uuid REFERENCES public.finance_expenses(id) ON DELETE SET NULL,
  raw_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (account_id, external_id)
);

ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "owner manages bank_transactions"
  ON public.bank_transactions FOR ALL
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);

CREATE INDEX idx_bank_transactions_owner ON public.bank_transactions(owner_id);
CREATE INDEX idx_bank_transactions_account_date ON public.bank_transactions(account_id, operation_date DESC);
CREATE INDEX idx_bank_transactions_invoice ON public.bank_transactions(linked_invoice_id) WHERE linked_invoice_id IS NOT NULL;
