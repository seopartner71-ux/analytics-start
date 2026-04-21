-- Триггер: при смене статуса на 'paid' автоматически создаём income-транзакцию
CREATE OR REPLACE FUNCTION public.invoice_status_to_transaction()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Только при переходе в paid
  IF NEW.status = 'paid' AND (OLD.status IS DISTINCT FROM 'paid') THEN
    IF NEW.paid_to_account_id IS NULL THEN
      RAISE EXCEPTION 'Укажите счёт зачисления (paid_to_account_id) перед оплатой';
    END IF;
    -- Создаём приходную транзакцию (баланс счёта обновится триггером apply_transaction_balance)
    INSERT INTO public.transactions (account_id, type, amount, date, category, description)
    VALUES (
      NEW.paid_to_account_id,
      'income',
      NEW.amount,
      COALESCE(NEW.date_paid, CURRENT_DATE),
      'invoice',
      'Оплата счёта ' || NEW.invoice_number || ' · ' || NEW.client_name
    );
    -- Проставим дату оплаты, если пустая
    IF NEW.date_paid IS NULL THEN
      NEW.date_paid := CURRENT_DATE;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_invoice_paid ON public.invoices;
CREATE TRIGGER trg_invoice_paid
BEFORE UPDATE ON public.invoices
FOR EACH ROW
EXECUTE FUNCTION public.invoice_status_to_transaction();