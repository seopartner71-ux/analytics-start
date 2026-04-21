-- Триггер: автоматическое отчисление 7% от прихода в Кассу
CREATE OR REPLACE FUNCTION public.auto_cash_reserve()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_src_kind text;
  v_cash_id uuid;
  v_reserve numeric;
BEGIN
  -- Только приходы
  IF NEW.type <> 'income' THEN
    RETURN NEW;
  END IF;

  -- Игнорируем служебные категории (переводы и сам резерв)
  IF NEW.category IN ('transfer_in', 'transfer_out', 'cash_reserve') THEN
    RETURN NEW;
  END IF;

  -- Источник должен быть банковским счётом
  SELECT kind INTO v_src_kind FROM public.financial_accounts WHERE id = NEW.account_id;
  IF v_src_kind IS DISTINCT FROM 'bank' THEN
    RETURN NEW;
  END IF;

  -- Находим активный счёт Кассы
  SELECT id INTO v_cash_id
  FROM public.financial_accounts
  WHERE kind = 'cash' AND is_active = true
  ORDER BY sort_order
  LIMIT 1;

  IF v_cash_id IS NULL THEN
    RETURN NEW;
  END IF;

  v_reserve := ROUND(NEW.amount * 0.07);
  IF v_reserve <= 0 THEN
    RETURN NEW;
  END IF;

  -- Списание с банка
  INSERT INTO public.transactions (account_id, type, amount, date, category, description)
  VALUES (NEW.account_id, 'expense', v_reserve, NEW.date, 'cash_reserve',
          'Автоотчисление 7% в Кассу');

  -- Зачисление в Кассу
  INSERT INTO public.transactions (account_id, type, amount, date, category, description)
  VALUES (v_cash_id, 'income', v_reserve, NEW.date, 'cash_reserve',
          'Автоотчисление 7% (резерв на наличные)');

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auto_cash_reserve ON public.transactions;
CREATE TRIGGER trg_auto_cash_reserve
AFTER INSERT ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.auto_cash_reserve();