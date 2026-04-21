-- ============ FINANCE V2: чистая структура ============

-- 1) Таблица счетов (банки + Касса)
CREATE TABLE IF NOT EXISTS public.financial_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  kind text NOT NULL DEFAULT 'bank', -- bank | cash | virtual
  balance numeric NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'RUB',
  is_active boolean NOT NULL DEFAULT true,
  sort_order int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2) Транзакции
CREATE TABLE IF NOT EXISTS public.transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id uuid NOT NULL REFERENCES public.financial_accounts(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('income','expense','transfer')),
  amount numeric NOT NULL CHECK (amount > 0),
  date date NOT NULL DEFAULT CURRENT_DATE,
  description text NOT NULL DEFAULT '',
  category text NOT NULL DEFAULT 'other',
  related_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  invoice_id uuid,
  client_id uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) Счета клиентам
CREATE TABLE IF NOT EXISTS public.invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL,
  client_id uuid,
  client_name text NOT NULL DEFAULT '',
  service text NOT NULL DEFAULT 'SEO-продвижение',
  amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','sent','paid','cancelled')),
  date_created date NOT NULL DEFAULT CURRENT_DATE,
  date_paid date,
  paid_to_account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_transactions_account ON public.transactions(account_id);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON public.transactions(type);
CREATE INDEX IF NOT EXISTS idx_invoices_status ON public.invoices(status);
CREATE INDEX IF NOT EXISTS idx_invoices_client ON public.invoices(client_id);

-- updated_at триггеры
DROP TRIGGER IF EXISTS trg_financial_accounts_updated ON public.financial_accounts;
CREATE TRIGGER trg_financial_accounts_updated BEFORE UPDATE ON public.financial_accounts
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS trg_invoices_updated ON public.invoices;
CREATE TRIGGER trg_invoices_updated BEFORE UPDATE ON public.invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Включаем RLS
ALTER TABLE public.financial_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

-- RLS: только admin и director (используем существующий is_admin_or_director)
CREATE POLICY "admin_director manage financial_accounts"
  ON public.financial_accounts FOR ALL TO authenticated
  USING (public.is_admin_or_director(auth.uid()))
  WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE POLICY "admin_director manage transactions"
  ON public.transactions FOR ALL TO authenticated
  USING (public.is_admin_or_director(auth.uid()))
  WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE POLICY "admin_director manage invoices"
  ON public.invoices FOR ALL TO authenticated
  USING (public.is_admin_or_director(auth.uid()))
  WITH CHECK (public.is_admin_or_director(auth.uid()));

-- Триггер: автоматическая корректировка баланса счетов при транзакциях
CREATE OR REPLACE FUNCTION public.apply_transaction_balance()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      UPDATE public.financial_accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'expense' THEN
      UPDATE public.financial_accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
    ELSIF NEW.type = 'transfer' THEN
      UPDATE public.financial_accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      IF NEW.related_account_id IS NOT NULL THEN
        UPDATE public.financial_accounts SET balance = balance + NEW.amount WHERE id = NEW.related_account_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      UPDATE public.financial_accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'expense' THEN
      UPDATE public.financial_accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
    ELSIF OLD.type = 'transfer' THEN
      UPDATE public.financial_accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      IF OLD.related_account_id IS NOT NULL THEN
        UPDATE public.financial_accounts SET balance = balance - OLD.amount WHERE id = OLD.related_account_id;
      END IF;
    END IF;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_transactions_balance ON public.transactions;
CREATE TRIGGER trg_transactions_balance
AFTER INSERT OR DELETE ON public.transactions
FOR EACH ROW EXECUTE FUNCTION public.apply_transaction_balance();

-- Сидируем счета по умолчанию
INSERT INTO public.financial_accounts (name, kind, sort_order) VALUES
  ('Точка', 'bank', 1),
  ('Тинькофф', 'bank', 2),
  ('Касса', 'cash', 3)
ON CONFLICT DO NOTHING;