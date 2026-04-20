
-- 1. Add finance_access flag to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS finance_access boolean NOT NULL DEFAULT false;

-- 2. Security definer: can user access finance?
CREATE OR REPLACE FUNCTION public.has_finance_access(_user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = 'admin'
  ) OR EXISTS (
    SELECT 1 FROM public.profiles WHERE user_id = _user_id AND finance_access = true
  )
$$;

-- 3. financial_clients (rename + extend)
CREATE TABLE IF NOT EXISTS public.financial_clients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  email text,
  phone text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.financial_clients (id, name, email, phone, notes, created_at, updated_at)
SELECT id, name, email, phone, notes, created_at, updated_at FROM public.finance_clients
ON CONFLICT (id) DO NOTHING;

-- 4. financial_payments
CREATE TABLE IF NOT EXISTS public.financial_payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid REFERENCES public.financial_clients(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  service text NOT NULL DEFAULT '',
  contract_amount numeric NOT NULL DEFAULT 0,
  paid_amount numeric NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending', -- pending|paid|partial|overdue
  recurrence text NOT NULL DEFAULT 'monthly', -- none|monthly|quarterly|yearly
  next_payment_date date,
  due_date date,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.financial_payments (id, client_id, client_name, service, contract_amount, paid_amount, status, recurrence, next_payment_date, comment, created_at, updated_at)
SELECT id, client_id, client_name, service, contract_amount, paid_amount, status, recurrence, next_payment_date, comment, created_at, updated_at FROM public.finance_payments
ON CONFLICT (id) DO NOTHING;

-- 5. financial_payment_history
CREATE TABLE IF NOT EXISTS public.financial_payment_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES public.financial_payments(id) ON DELETE CASCADE,
  amount numeric NOT NULL,
  paid_at timestamptz NOT NULL DEFAULT now(),
  note text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 6. financial_invoices
CREATE TABLE IF NOT EXISTS public.financial_invoices (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invoice_number text NOT NULL UNIQUE,
  client_id uuid REFERENCES public.financial_clients(id) ON DELETE SET NULL,
  client_name text NOT NULL DEFAULT '',
  services jsonb NOT NULL DEFAULT '[]'::jsonb,
  amount numeric NOT NULL DEFAULT 0,
  vat_rate numeric NOT NULL DEFAULT 0,
  vat_included boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'draft', -- draft|sent|paid|overdue
  issued_at date NOT NULL DEFAULT CURRENT_DATE,
  due_at date,
  comment text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.financial_invoices (id, invoice_number, client_id, client_name, services, amount, status, issued_at, due_at, created_at, updated_at)
SELECT id, invoice_number, client_id, client_name, services, amount, status, issued_at::date, due_at::date, created_at, updated_at FROM public.finance_invoices
ON CONFLICT (id) DO NOTHING;

-- 7. financial_expenses
CREATE TABLE IF NOT EXISTS public.financial_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category text NOT NULL DEFAULT 'other',
  amount numeric NOT NULL DEFAULT 0,
  expense_date date NOT NULL DEFAULT CURRENT_DATE,
  comment text,
  receipt_url text,
  added_by uuid,
  added_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.financial_expenses (id, category, amount, expense_date, comment, created_at, updated_at)
SELECT id, category, amount, expense_date::date, comment, created_at, updated_at FROM public.finance_expenses
ON CONFLICT (id) DO NOTHING;

-- 8. financial_taxes
CREATE TABLE IF NOT EXISTS public.financial_taxes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tax_type text NOT NULL DEFAULT 'usn', -- usn|insurance_fixed|insurance_extra
  year int NOT NULL,
  quarter int, -- nullable for yearly insurance
  income_base numeric NOT NULL DEFAULT 0,
  amount numeric NOT NULL DEFAULT 0,
  rate numeric NOT NULL DEFAULT 6,
  due_date date,
  status text NOT NULL DEFAULT 'pending', -- pending|paid
  paid_at date,
  paid_amount numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.financial_taxes (id, year, quarter, amount, status, paid_at, created_at, updated_at)
SELECT id, year, quarter, amount, status, paid_at::date, created_at, updated_at FROM public.finance_taxes
ON CONFLICT (id) DO NOTHING;

-- 9. company_requisites (single row per workspace; we keep it simple)
CREATE TABLE IF NOT EXISTS public.company_requisites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  legal_name text NOT NULL DEFAULT '',
  inn text,
  kpp text,
  ogrn text,
  account_number text,
  bank_name text,
  bik text,
  correspondent_account text,
  legal_address text,
  director_name text,
  logo_url text,
  email text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- triggers for updated_at
DO $$ BEGIN
  CREATE TRIGGER trg_financial_clients_updated BEFORE UPDATE ON public.financial_clients
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_payments_updated BEFORE UPDATE ON public.financial_payments
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_invoices_updated BEFORE UPDATE ON public.financial_invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_expenses_updated BEFORE UPDATE ON public.financial_expenses
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_financial_taxes_updated BEFORE UPDATE ON public.financial_taxes
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TRIGGER trg_company_requisites_updated BEFORE UPDATE ON public.company_requisites
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- Trigger: on payment paid → create history + recurring next payment + notification
CREATE OR REPLACE FUNCTION public.handle_payment_paid()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_admin RECORD;
  v_next_date date;
  v_paid_delta numeric;
BEGIN
  -- Track delta only when paid_amount increased
  v_paid_delta := COALESCE(NEW.paid_amount, 0) - COALESCE(OLD.paid_amount, 0);

  IF v_paid_delta > 0 THEN
    INSERT INTO public.financial_payment_history (payment_id, amount, note)
    VALUES (NEW.id, v_paid_delta, 'Платёж зарегистрирован');

    -- Notify all admins and finance-access users
    FOR v_admin IN
      SELECT DISTINCT p.user_id FROM public.profiles p
      LEFT JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.finance_access = true OR ur.role = 'admin'
    LOOP
      INSERT INTO public.notifications (user_id, project_id, title, body)
      VALUES (
        v_admin.user_id,
        v_admin.user_id,
        '💰 Оплата получена',
        NEW.client_name || ' (' || NEW.service || ') оплатил ' || v_paid_delta::text || '₽'
      );
    END LOOP;
  END IF;

  -- If status became 'paid' and payment is recurring → create next
  IF NEW.status = 'paid' AND OLD.status <> 'paid' AND NEW.recurrence <> 'none' THEN
    v_next_date := CASE NEW.recurrence
      WHEN 'monthly' THEN COALESCE(NEW.next_payment_date, CURRENT_DATE) + INTERVAL '1 month'
      WHEN 'quarterly' THEN COALESCE(NEW.next_payment_date, CURRENT_DATE) + INTERVAL '3 months'
      WHEN 'yearly' THEN COALESCE(NEW.next_payment_date, CURRENT_DATE) + INTERVAL '1 year'
      ELSE NULL
    END;

    IF v_next_date IS NOT NULL THEN
      INSERT INTO public.financial_payments (
        client_id, client_name, service, contract_amount, paid_amount,
        status, recurrence, next_payment_date, due_date, comment
      ) VALUES (
        NEW.client_id, NEW.client_name, NEW.service, NEW.contract_amount, 0,
        'pending', NEW.recurrence, v_next_date, v_next_date, NEW.comment
      );

      -- Update current payment's next_payment_date to reflect new schedule
      NEW.next_payment_date := v_next_date;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_payment_paid ON public.financial_payments;
CREATE TRIGGER trg_payment_paid
  BEFORE UPDATE ON public.financial_payments
  FOR EACH ROW EXECUTE FUNCTION public.handle_payment_paid();

-- Enable RLS on all financial tables
ALTER TABLE public.financial_clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_payment_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.financial_taxes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_requisites ENABLE ROW LEVEL SECURITY;

-- RLS policies — only finance access users
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'financial_clients','financial_payments','financial_payment_history',
    'financial_invoices','financial_expenses','financial_taxes','company_requisites'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "finance_select" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "finance_insert" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "finance_update" ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS "finance_delete" ON public.%I', t);

    EXECUTE format('CREATE POLICY "finance_select" ON public.%I FOR SELECT USING (public.has_finance_access(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "finance_insert" ON public.%I FOR INSERT WITH CHECK (public.has_finance_access(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "finance_update" ON public.%I FOR UPDATE USING (public.has_finance_access(auth.uid()))', t);
    EXECUTE format('CREATE POLICY "finance_delete" ON public.%I FOR DELETE USING (public.has_finance_access(auth.uid()))', t);
  END LOOP;
END $$;

-- Storage bucket for receipts and company logo
INSERT INTO storage.buckets (id, name, public)
VALUES ('finance-files', 'finance-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "finance_files_read" ON storage.objects;
CREATE POLICY "finance_files_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'finance-files');

DROP POLICY IF EXISTS "finance_files_write" ON storage.objects;
CREATE POLICY "finance_files_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'finance-files' AND public.has_finance_access(auth.uid()));

DROP POLICY IF EXISTS "finance_files_update" ON storage.objects;
CREATE POLICY "finance_files_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'finance-files' AND public.has_finance_access(auth.uid()));

DROP POLICY IF EXISTS "finance_files_delete" ON storage.objects;
CREATE POLICY "finance_files_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'finance-files' AND public.has_finance_access(auth.uid()));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_financial_payments_client ON public.financial_payments(client_id);
CREATE INDEX IF NOT EXISTS idx_financial_payments_status ON public.financial_payments(status);
CREATE INDEX IF NOT EXISTS idx_financial_payments_next ON public.financial_payments(next_payment_date);
CREATE INDEX IF NOT EXISTS idx_financial_history_payment ON public.financial_payment_history(payment_id);
CREATE INDEX IF NOT EXISTS idx_financial_invoices_status ON public.financial_invoices(status);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_date ON public.financial_expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_financial_expenses_category ON public.financial_expenses(category);
CREATE INDEX IF NOT EXISTS idx_financial_taxes_year_q ON public.financial_taxes(year, quarter);
