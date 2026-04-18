
-- Clients
CREATE TABLE public.finance_clients (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage finance_clients" ON public.finance_clients
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view finance_clients" ON public.finance_clients
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_finance_clients_updated BEFORE UPDATE ON public.finance_clients
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Payments
CREATE TABLE public.finance_payments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  client_id UUID REFERENCES public.finance_clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT '',
  service TEXT NOT NULL DEFAULT '',
  contract_amount NUMERIC NOT NULL DEFAULT 0,
  paid_amount NUMERIC NOT NULL DEFAULT 0,
  next_payment_date DATE,
  status TEXT NOT NULL DEFAULT 'unpaid', -- paid | partial | unpaid | overdue
  recurrence TEXT NOT NULL DEFAULT 'once', -- once | weekly | monthly
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_payments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage finance_payments" ON public.finance_payments
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view finance_payments" ON public.finance_payments
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_finance_payments_updated BEFORE UPDATE ON public.finance_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Invoices
CREATE TABLE public.finance_invoices (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  invoice_number TEXT NOT NULL,
  client_id UUID REFERENCES public.finance_clients(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL DEFAULT '',
  services JSONB NOT NULL DEFAULT '[]'::jsonb,
  amount NUMERIC NOT NULL DEFAULT 0,
  issued_at DATE NOT NULL DEFAULT CURRENT_DATE,
  due_at DATE,
  status TEXT NOT NULL DEFAULT 'draft', -- draft | sent | paid | overdue
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_invoices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage finance_invoices" ON public.finance_invoices
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view finance_invoices" ON public.finance_invoices
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_finance_invoices_updated BEFORE UPDATE ON public.finance_invoices
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Expenses
CREATE TABLE public.finance_expenses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  category TEXT NOT NULL DEFAULT 'other', -- salary | ads | tools | taxes | other
  amount NUMERIC NOT NULL DEFAULT 0,
  expense_date DATE NOT NULL DEFAULT CURRENT_DATE,
  comment TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.finance_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage finance_expenses" ON public.finance_expenses
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view finance_expenses" ON public.finance_expenses
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_finance_expenses_updated BEFORE UPDATE ON public.finance_expenses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Taxes (USN quarters)
CREATE TABLE public.finance_taxes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  year INTEGER NOT NULL,
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),
  amount NUMERIC NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- paid | pending | future
  paid_at DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(owner_id, year, quarter)
);
ALTER TABLE public.finance_taxes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Owners manage finance_taxes" ON public.finance_taxes
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);
CREATE POLICY "Admins view finance_taxes" ON public.finance_taxes
  FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'::app_role));
CREATE TRIGGER trg_finance_taxes_updated BEFORE UPDATE ON public.finance_taxes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Indexes
CREATE INDEX idx_finance_payments_owner ON public.finance_payments(owner_id);
CREATE INDEX idx_finance_invoices_owner ON public.finance_invoices(owner_id);
CREATE INDEX idx_finance_expenses_owner_date ON public.finance_expenses(owner_id, expense_date);
CREATE INDEX idx_finance_taxes_owner_year ON public.finance_taxes(owner_id, year);
