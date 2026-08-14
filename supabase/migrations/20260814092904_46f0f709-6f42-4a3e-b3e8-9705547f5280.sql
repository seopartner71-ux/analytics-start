CREATE TABLE IF NOT EXISTS public.expense_categories (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  label TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_categories TO authenticated;
GRANT ALL ON public.expense_categories TO service_role;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance users read categories" ON public.expense_categories
  FOR SELECT TO authenticated USING (public.has_finance_access(auth.uid()));
CREATE POLICY "Finance users manage categories" ON public.expense_categories
  FOR ALL TO authenticated
  USING (public.has_finance_access(auth.uid()))
  WITH CHECK (public.has_finance_access(auth.uid()));

CREATE TRIGGER update_expense_categories_updated_at
  BEFORE UPDATE ON public.expense_categories
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.expense_categories (code, label, sort_order) VALUES
  ('contractors', 'Подрядчики', 10),
  ('salary', 'Зарплаты', 20),
  ('services', 'Сервисы', 30),
  ('ads', 'Реклама', 40),
  ('hosting', 'Хостинг', 50),
  ('telephony', 'Телефония', 60),
  ('tax', 'Налоги', 70),
  ('office', 'Офис', 80),
  ('equipment', 'Оборудование', 90),
  ('other', 'Прочее', 100)
ON CONFLICT (code) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.financial_obligations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  counterparty TEXT,
  amount NUMERIC NOT NULL DEFAULT 0,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'planned',
  comment TEXT,
  paid_at DATE,
  transaction_id UUID,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.financial_obligations TO authenticated;
GRANT ALL ON public.financial_obligations TO service_role;
ALTER TABLE public.financial_obligations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Finance users manage obligations" ON public.financial_obligations
  FOR ALL TO authenticated
  USING (public.has_finance_access(auth.uid()))
  WITH CHECK (public.has_finance_access(auth.uid()));

CREATE TRIGGER update_financial_obligations_updated_at
  BEFORE UPDATE ON public.financial_obligations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE INDEX IF NOT EXISTS idx_financial_obligations_due ON public.financial_obligations (due_date);
CREATE INDEX IF NOT EXISTS idx_financial_obligations_status ON public.financial_obligations (status);