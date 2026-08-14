-- ============ ЭТАП 1: CLEANUP ============
SELECT cron.unschedule(jobid) FROM cron.job WHERE jobid <= 9;

DROP TABLE IF EXISTS public.finance_payments CASCADE;
DROP TABLE IF EXISTS public.finance_invoices CASCADE;
DROP TABLE IF EXISTS public.finance_expenses CASCADE;
DROP TABLE IF EXISTS public.finance_taxes CASCADE;
DROP TABLE IF EXISTS public.finance_clients CASCADE;
DROP TABLE IF EXISTS public.financial_payment_history CASCADE;
DROP TABLE IF EXISTS public.financial_payments CASCADE;
DROP TABLE IF EXISTS public.financial_invoices CASCADE;
DROP TABLE IF EXISTS public.financial_expenses CASCADE;
DROP TABLE IF EXISTS public.financial_taxes CASCADE;
DROP TABLE IF EXISTS public.bank_transactions CASCADE;
DROP TABLE IF EXISTS public.bank_accounts CASCADE;
DROP TABLE IF EXISTS public.bank_integrations CASCADE;
DROP TABLE IF EXISTS public.deals CASCADE;

-- ============ ЭТАП 2: INVOICE PAYMENTS ============
ALTER TABLE public.invoices
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS expected_date date;

UPDATE public.invoices SET due_date = (date_created + INTERVAL '7 day')::date WHERE due_date IS NULL;

CREATE TABLE public.invoice_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_id uuid NOT NULL REFERENCES public.invoices(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  amount numeric NOT NULL CHECK (amount > 0),
  paid_at date NOT NULL DEFAULT CURRENT_DATE,
  kind text NOT NULL DEFAULT 'payment' CHECK (kind IN ('payment','refund')),
  reversed_at timestamptz,
  reversal_of uuid REFERENCES public.invoice_payments(id) ON DELETE SET NULL,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_invoice_payments_invoice ON public.invoice_payments(invoice_id);
GRANT SELECT, INSERT, UPDATE ON public.invoice_payments TO authenticated;
GRANT ALL ON public.invoice_payments TO service_role;
ALTER TABLE public.invoice_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage invoice_payments" ON public.invoice_payments
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_invoice_payments_updated BEFORE UPDATE ON public.invoice_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ЭТАП 5: CUSTOMER CREDIT ============
CREATE TABLE public.customer_credit (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.financial_clients(id) ON DELETE SET NULL,
  client_name text,
  invoice_id uuid REFERENCES public.invoices(id) ON DELETE SET NULL,
  amount numeric NOT NULL,
  reason text NOT NULL DEFAULT 'overpayment' CHECK (reason IN ('overpayment','prepayment','cancelled_invoice','manual')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','applied','refunded')),
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.customer_credit TO authenticated;
GRANT ALL ON public.customer_credit TO service_role;
ALTER TABLE public.customer_credit ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage customer_credit" ON public.customer_credit
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_customer_credit_updated BEFORE UPDATE ON public.customer_credit
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- пересчёт статуса счёта по платежам + переплата в customer_credit
CREATE OR REPLACE FUNCTION public.recalc_invoice_from_payments()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_paid numeric;
  v_over numeric;
  v_new_status text;
BEGIN
  SELECT * INTO v_inv FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_inv.id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END), 0)
    INTO v_paid
  FROM public.invoice_payments
  WHERE invoice_id = v_inv.id AND reversed_at IS NULL;

  v_over := GREATEST(0, v_paid - v_inv.amount);

  IF v_inv.status = 'cancelled' THEN
    v_new_status := 'cancelled';
  ELSIF v_paid >= v_inv.amount AND v_inv.amount > 0 THEN
    v_new_status := 'paid';
  ELSIF v_paid > 0 THEN
    v_new_status := 'partial';
  ELSE
    v_new_status := CASE WHEN v_inv.status IN ('paid','partial') THEN 'sent' ELSE v_inv.status END;
  END IF;

  UPDATE public.invoices
     SET status = v_new_status,
         date_paid = CASE WHEN v_new_status = 'paid' THEN COALESCE(v_inv.date_paid, CURRENT_DATE) ELSE NULL END
   WHERE id = v_inv.id
     AND (status IS DISTINCT FROM v_new_status
          OR (v_new_status <> 'paid' AND date_paid IS NOT NULL));

  -- переплата -> обязательство перед клиентом (одна открытая запись на счёт)
  IF v_over > 0 THEN
    IF EXISTS (SELECT 1 FROM public.customer_credit WHERE invoice_id = v_inv.id AND reason = 'overpayment' AND status = 'open') THEN
      UPDATE public.customer_credit SET amount = v_over
       WHERE invoice_id = v_inv.id AND reason = 'overpayment' AND status = 'open';
    ELSE
      INSERT INTO public.customer_credit (client_id, client_name, invoice_id, amount, reason, comment)
      VALUES (v_inv.client_id, v_inv.client_name, v_inv.id, v_over, 'overpayment',
              'Переплата по счёту ' || v_inv.invoice_number);
    END IF;
  ELSE
    DELETE FROM public.customer_credit
     WHERE invoice_id = v_inv.id AND reason = 'overpayment' AND status = 'open';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

CREATE TRIGGER trg_recalc_invoice_from_payments
AFTER INSERT OR UPDATE ON public.invoice_payments
FOR EACH ROW EXECUTE FUNCTION public.recalc_invoice_from_payments();

-- старый триггер: создаёт платёж только на непокрытый остаток, без дублей
CREATE OR REPLACE FUNCTION public.invoice_status_to_transaction()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_paid numeric;
  v_rest numeric;
  v_tx uuid;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END), 0) INTO v_paid
    FROM public.invoice_payments WHERE invoice_id = NEW.id AND reversed_at IS NULL;

    v_rest := NEW.amount - v_paid;
    IF v_rest > 0 THEN
      IF NEW.paid_to_account_id IS NULL THEN
        RAISE EXCEPTION 'Укажите счёт зачисления перед оплатой';
      END IF;
      INSERT INTO public.transactions (account_id, type, amount, date, category, description, client_id, invoice_id)
      VALUES (NEW.paid_to_account_id, 'income', v_rest, COALESCE(NEW.date_paid, CURRENT_DATE), 'invoice',
              'Оплата счёта ' || NEW.invoice_number || ' · ' || NEW.client_name, NEW.client_id, NEW.id)
      RETURNING id INTO v_tx;

      INSERT INTO public.invoice_payments (invoice_id, transaction_id, amount, paid_at, kind, comment)
      VALUES (NEW.id, v_tx, v_rest, COALESCE(NEW.date_paid, CURRENT_DATE), 'payment', 'Полная оплата счёта');
    END IF;
    IF NEW.date_paid IS NULL THEN NEW.date_paid := CURRENT_DATE; END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- ============ ЭТАП 4: TAX LIABILITY ============
CREATE TABLE public.tax_liability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL,
  period_start date NOT NULL,
  period_end date NOT NULL,
  taxable_base numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 0.06,
  accrued numeric NOT NULL DEFAULT 0,
  paid numeric NOT NULL DEFAULT 0,
  due_date date,
  payment_transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.tax_liability TO authenticated;
GRANT ALL ON public.tax_liability TO service_role;
ALTER TABLE public.tax_liability ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage tax_liability" ON public.tax_liability
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_tax_liability_updated BEFORE UPDATE ON public.tax_liability
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ ЭТАП 6: PARTNER LEDGER ============
ALTER TABLE public.partner_distributions
  ADD COLUMN IF NOT EXISTS profit_base numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS distributed_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS retained_amount numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS approval_status text NOT NULL DEFAULT 'draft',
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by uuid;

CREATE TABLE public.partner_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  distribution_id uuid REFERENCES public.partner_distributions(id) ON DELETE SET NULL,
  partner_id uuid NOT NULL,
  entry_type text NOT NULL CHECK (entry_type IN ('accrual','payout')),
  amount numeric NOT NULL CHECK (amount > 0),
  share_pct numeric,
  period text,
  entry_date date NOT NULL DEFAULT CURRENT_DATE,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  reversed_at timestamptz,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_partner_ledger_partner ON public.partner_ledger(partner_id);
GRANT SELECT, INSERT, UPDATE ON public.partner_ledger TO authenticated;
GRANT ALL ON public.partner_ledger TO service_role;
ALTER TABLE public.partner_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage partner_ledger" ON public.partner_ledger
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

CREATE OR REPLACE FUNCTION public.check_partner_payout_limit()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_accrued numeric; v_paid numeric;
BEGIN
  IF NEW.entry_type = 'payout' THEN
    SELECT COALESCE(SUM(amount),0) INTO v_accrued FROM public.partner_ledger
      WHERE partner_id = NEW.partner_id AND entry_type = 'accrual' AND reversed_at IS NULL;
    SELECT COALESCE(SUM(amount),0) INTO v_paid FROM public.partner_ledger
      WHERE partner_id = NEW.partner_id AND entry_type = 'payout' AND reversed_at IS NULL AND id <> NEW.id;
    IF v_paid + NEW.amount > v_accrued + 0.01 THEN
      RAISE EXCEPTION 'Выплата превышает начисленное партнёру: начислено %, уже выплачено %, попытка %', v_accrued, v_paid, NEW.amount;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_partner_payout_limit BEFORE INSERT OR UPDATE ON public.partner_ledger
  FOR EACH ROW EXECUTE FUNCTION public.check_partner_payout_limit();

-- ============ ЭТАП 8: PERIOD CLOSING ============
CREATE TABLE public.financial_periods (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE,
  period_start date NOT NULL,
  period_end date NOT NULL,
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','closed')),
  closed_at timestamptz,
  closed_by uuid,
  closing_profit numeric,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.financial_periods TO authenticated;
GRANT ALL ON public.financial_periods TO service_role;
ALTER TABLE public.financial_periods ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage financial_periods" ON public.financial_periods
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_financial_periods_updated BEFORE UPDATE ON public.financial_periods
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE OR REPLACE FUNCTION public.is_period_closed(_d date)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.financial_periods
                 WHERE status = 'closed' AND _d BETWEEN period_start AND period_end);
$$;

CREATE OR REPLACE FUNCTION public.protect_closed_period()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF public.is_period_closed(OLD.date) THEN
      RAISE EXCEPTION 'Период закрыт: операцию нельзя удалить, используйте сторно';
    END IF;
    RETURN OLD;
  END IF;
  IF public.is_period_closed(OLD.date) OR public.is_period_closed(NEW.date) THEN
    RAISE EXCEPTION 'Период закрыт: операцию нельзя изменить, используйте сторно';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_transactions_closed_period BEFORE UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.protect_closed_period();

-- ============ ЭТАП 10: RECURRING OPERATIONS ============
CREATE TABLE public.recurring_operations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  direction text NOT NULL DEFAULT 'expense' CHECK (direction IN ('income','expense')),
  category text,
  counterparty text,
  amount numeric NOT NULL CHECK (amount >= 0),
  amount_valid_from date NOT NULL DEFAULT CURRENT_DATE,
  frequency text NOT NULL DEFAULT 'monthly' CHECK (frequency IN ('monthly','quarterly','yearly')),
  day_of_month int NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 31),
  month_of_year int CHECK (month_of_year BETWEEN 1 AND 12),
  started_at date NOT NULL DEFAULT CURRENT_DATE,
  ended_at date,
  is_active boolean NOT NULL DEFAULT true,
  account_id uuid REFERENCES public.financial_accounts(id) ON DELETE SET NULL,
  comment text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_operations TO authenticated;
GRANT ALL ON public.recurring_operations TO service_role;
ALTER TABLE public.recurring_operations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage recurring_operations" ON public.recurring_operations
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_recurring_operations_updated BEFORE UPDATE ON public.recurring_operations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.recurring_amount_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES public.recurring_operations(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  valid_from date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.recurring_amount_history TO authenticated;
GRANT ALL ON public.recurring_amount_history TO service_role;
ALTER TABLE public.recurring_amount_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage recurring_amount_history" ON public.recurring_amount_history
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

CREATE TABLE public.recurring_occurrences (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  recurring_id uuid NOT NULL REFERENCES public.recurring_operations(id) ON DELETE CASCADE,
  occurrence_date date NOT NULL,
  amount numeric NOT NULL,
  status text NOT NULL DEFAULT 'planned' CHECK (status IN ('planned','materialized','skipped')),
  obligation_id uuid REFERENCES public.financial_obligations(id) ON DELETE SET NULL,
  transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
  materialized_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (recurring_id, occurrence_date)
);
GRANT SELECT, INSERT, UPDATE ON public.recurring_occurrences TO authenticated;
GRANT ALL ON public.recurring_occurrences TO service_role;
ALTER TABLE public.recurring_occurrences ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance users manage recurring_occurrences" ON public.recurring_occurrences
  FOR ALL TO authenticated USING (public.has_finance_access(auth.uid())) WITH CHECK (public.has_finance_access(auth.uid()));

ALTER TABLE public.financial_obligations
  ADD COLUMN IF NOT EXISTS recurring_id uuid REFERENCES public.recurring_operations(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS occurrence_date date,
  ADD COLUMN IF NOT EXISTS transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL;

ALTER TABLE public.financial_clients
  ADD COLUMN IF NOT EXISTS monthly_fee numeric NOT NULL DEFAULT 0;