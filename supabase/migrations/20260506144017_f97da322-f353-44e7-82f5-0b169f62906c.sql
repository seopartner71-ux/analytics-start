-- Validation trigger: cash account cannot go negative
CREATE OR REPLACE FUNCTION public.prevent_cash_negative()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_kind text;
  v_balance numeric;
BEGIN
  SELECT kind, balance INTO v_kind, v_balance
  FROM public.financial_accounts WHERE id = NEW.id;
  IF v_kind = 'cash' AND NEW.balance < 0 THEN
    RAISE EXCEPTION 'Недостаточно средств в кассе';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_prevent_cash_negative ON public.financial_accounts;
CREATE TRIGGER trg_prevent_cash_negative
BEFORE UPDATE OF balance ON public.financial_accounts
FOR EACH ROW EXECUTE FUNCTION public.prevent_cash_negative();