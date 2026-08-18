CREATE OR REPLACE FUNCTION public.invoice_status_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_paid numeric;
  v_rest numeric;
  v_tx uuid;
BEGIN
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    PERFORM set_config('app.skip_invoice_recalc', '1', true);

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

    PERFORM set_config('app.skip_invoice_recalc', '0', true);
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.recalc_invoice_from_payments()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inv public.invoices%ROWTYPE;
  v_paid numeric;
  v_over numeric;
  v_new_status text;
  v_skip boolean;
BEGIN
  v_skip := COALESCE(current_setting('app.skip_invoice_recalc', true), '0') = '1';

  SELECT * INTO v_inv FROM public.invoices WHERE id = COALESCE(NEW.invoice_id, OLD.invoice_id);
  IF v_inv.id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;

  SELECT COALESCE(SUM(CASE WHEN kind = 'payment' THEN amount ELSE -amount END), 0)
    INTO v_paid
  FROM public.invoice_payments
  WHERE invoice_id = v_inv.id AND reversed_at IS NULL;

  v_over := GREATEST(0, v_paid - v_inv.amount);

  IF NOT v_skip THEN
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
  END IF;

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