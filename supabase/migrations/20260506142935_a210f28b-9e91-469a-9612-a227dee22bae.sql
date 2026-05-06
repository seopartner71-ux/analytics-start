
CREATE TABLE public.partner_distributions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period text NOT NULL UNIQUE,
  total_profit numeric NOT NULL DEFAULT 0,
  partner1_id uuid,
  partner2_id uuid,
  partner1_share numeric NOT NULL DEFAULT 50,
  partner2_share numeric NOT NULL DEFAULT 50,
  partner1_amount numeric NOT NULL DEFAULT 0,
  partner2_amount numeric NOT NULL DEFAULT 0,
  partner1_paid boolean NOT NULL DEFAULT false,
  partner2_paid boolean NOT NULL DEFAULT false,
  partner1_paid_at timestamptz,
  partner2_paid_at timestamptz,
  partner1_tx_id uuid,
  partner2_tx_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_distributions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "admin_director manage partner_distributions"
ON public.partner_distributions
FOR ALL
TO authenticated
USING (public.is_admin_or_director(auth.uid()))
WITH CHECK (public.is_admin_or_director(auth.uid()));

CREATE TRIGGER trg_partner_distributions_updated
BEFORE UPDATE ON public.partner_distributions
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
