ALTER TABLE public.financial_clients
  ADD COLUMN IF NOT EXISTS client_type text,
  ADD COLUMN IF NOT EXISTS telegram text,
  ADD COLUMN IF NOT EXISTS responsible_id uuid,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS legal_name text,
  ADD COLUMN IF NOT EXISTS kpp text,
  ADD COLUMN IF NOT EXISTS ogrn text,
  ADD COLUMN IF NOT EXISTS legal_address text,
  ADD COLUMN IF NOT EXISTS actual_address text,
  ADD COLUMN IF NOT EXISTS account_number text,
  ADD COLUMN IF NOT EXISTS bank_name text,
  ADD COLUMN IF NOT EXISTS bik text,
  ADD COLUMN IF NOT EXISTS correspondent_account text,
  ADD COLUMN IF NOT EXISTS other_requisites text,
  ADD COLUMN IF NOT EXISTS report_day integer,
  ADD COLUMN IF NOT EXISTS report_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS last_report_date date;

CREATE TABLE IF NOT EXISTS public.client_report_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.financial_clients(id) ON DELETE CASCADE,
  period_year integer NOT NULL,
  period_month integer NOT NULL,
  due_date date NOT NULL,
  completed_at timestamptz,
  completed_by uuid,
  responsible_id uuid,
  note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_year, period_month)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_report_history TO authenticated;
GRANT ALL ON public.client_report_history TO service_role;
ALTER TABLE public.client_report_history ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_select" ON public.client_report_history FOR SELECT TO authenticated USING (public.has_finance_access(auth.uid()));
CREATE POLICY "finance_insert" ON public.client_report_history FOR INSERT TO authenticated WITH CHECK (public.has_finance_access(auth.uid()));
CREATE POLICY "finance_update" ON public.client_report_history FOR UPDATE TO authenticated USING (public.has_finance_access(auth.uid()));
CREATE POLICY "finance_delete" ON public.client_report_history FOR DELETE TO authenticated USING (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_client_report_history_updated BEFORE UPDATE ON public.client_report_history
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE IF NOT EXISTS public.client_report_notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id uuid NOT NULL REFERENCES public.financial_clients(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  due_date date NOT NULL,
  notification_type text NOT NULL,
  channel text NOT NULL,
  status text NOT NULL DEFAULT 'sent',
  error_message text,
  sent_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (client_id, period_key, notification_type, channel)
);

GRANT SELECT ON public.client_report_notifications TO authenticated;
GRANT ALL ON public.client_report_notifications TO service_role;
ALTER TABLE public.client_report_notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_select" ON public.client_report_notifications FOR SELECT TO authenticated USING (public.has_finance_access(auth.uid()));

CREATE TABLE IF NOT EXISTS public.client_report_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  telegram_enabled boolean NOT NULL DEFAULT false,
  telegram_chat_id text,
  email_enabled boolean NOT NULL DEFAULT false,
  email_to text,
  email_from text,
  warn_days integer NOT NULL DEFAULT 3,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.client_report_settings TO authenticated;
GRANT ALL ON public.client_report_settings TO service_role;
ALTER TABLE public.client_report_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "finance_select" ON public.client_report_settings FOR SELECT TO authenticated USING (public.has_finance_access(auth.uid()));
CREATE POLICY "finance_insert" ON public.client_report_settings FOR INSERT TO authenticated WITH CHECK (public.has_finance_access(auth.uid()));
CREATE POLICY "finance_update" ON public.client_report_settings FOR UPDATE TO authenticated USING (public.has_finance_access(auth.uid()));
CREATE TRIGGER trg_client_report_settings_updated BEFORE UPDATE ON public.client_report_settings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.client_report_settings (telegram_enabled, email_enabled, warn_days)
SELECT false, false, 3
WHERE NOT EXISTS (SELECT 1 FROM public.client_report_settings);

CREATE INDEX IF NOT EXISTS idx_client_report_history_client ON public.client_report_history(client_id, due_date DESC);
CREATE INDEX IF NOT EXISTS idx_client_report_notif_client ON public.client_report_notifications(client_id, period_key);