/**
 * ПРОГНОЗ ДЕНЕЖНОГО ПОТОКА.
 *
 * ProjectedCash(T) = CashPosition + ExpectedReceipts(T) − ExpectedPayments(T)
 *
 * Защита от двойного счёта:
 *  · счета берутся только по непокрытому остатку (outstanding), оплаченные дают 0;
 *  · обязательства со статусом paid/cancelled и обязательства, у которых есть
 *    связанная транзакция, исключены;
 *  · регулярная операция не порождает событие, если её оккуренция уже
 *    материализована (стала обязательством или транзакцией) либо пропущена;
 *  · переводы между собственными счетами игнорируются полностью;
 *  · невыплаченные начисления партнёрам учитываются один раз.
 */
import {
  addDays, addMonths, addYears, endOfMonth, format, isAfter, isBefore, parseISO, startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";
import type {
  EngineInput, FinancialSnapshot, RecurringOccurrence, RecurringOperation,
} from "./financialEngine";
import { invoiceStates } from "./financialEngine";

export type ForecastKind = "invoice" | "obligation" | "recurring" | "tax" | "partner";

export interface ForecastEvent {
  id: string;
  date: Date;
  amount: number;              // + поступление, − выплата
  kind: ForecastKind;
  title: string;
  subtitle?: string;
  certain: boolean;            // подтверждённое событие или оценка
}

const num = (v: unknown) => Number(v) || 0;
const d = (v: string | Date) => (typeof v === "string" ? parseISO(v) : v);

/** Дата события внутри месяца с учётом коротких месяцев (31 → 28/30). */
function clampDay(base: Date, day: number) {
  const last = endOfMonth(base).getDate();
  const dt = new Date(base.getFullYear(), base.getMonth(), Math.min(day, last));
  return startOfDay(dt);
}

/**
 * Виртуальные оккуренции регулярной операции в интервале.
 * Материализованные и пропущенные даты исключаются по ключу
 * идемпотентности `recurring_id + occurrence_date`.
 */
export function recurringEvents(
  op: RecurringOperation,
  occurrences: RecurringOccurrence[],
  from: Date,
  to: Date,
): ForecastEvent[] {
  if (!op.is_active) return [];
  const started = d(op.started_at);
  const ended = op.ended_at ? d(op.ended_at) : null;
  const taken = new Set(
    occurrences
      .filter((o) => o.recurring_id === op.id && o.status !== "planned")
      .map((o) => o.occurrence_date),
  );

  const step = op.frequency === "monthly" ? 1 : op.frequency === "quarterly" ? 3 : 12;
  const events: ForecastEvent[] = [];
  let cursor = clampDay(from, op.day_of_month);
  if (isBefore(cursor, from)) cursor = clampDay(addMonths(from, 1), op.day_of_month);

  // выравнивание годовых операций по месяцу
  if (op.frequency === "yearly" && op.month_of_year) {
    let y = from.getFullYear();
    cursor = clampDay(new Date(y, op.month_of_year - 1, 1), op.day_of_month);
    if (isBefore(cursor, from)) cursor = addYears(cursor, 1);
  }

  let guard = 0;
  while (!isAfter(cursor, to) && guard++ < 400) {
    const key = format(cursor, "yyyy-MM-dd");
    const active = !isBefore(cursor, started) && (!ended || !isAfter(cursor, ended));
    if (active && !taken.has(key)) {
      // сумма действует с amount_valid_from — история не переписывается
      const amount = num(op.amount);
      events.push({
        id: `rec-${op.id}-${key}`,
        date: cursor,
        amount: op.direction === "income" ? amount : -amount,
        kind: "recurring",
        title: op.title,
        subtitle: op.counterparty || undefined,
        certain: false,
      });
    }
    cursor = op.frequency === "yearly" ? addYears(cursor, 1) : clampDay(addMonths(cursor, step), op.day_of_month);
  }
  return events;
}

/** Все ожидаемые денежные события от сегодня до горизонта. */
export function buildForecastEvents(input: EngineInput, horizonDays: number, today = new Date()): ForecastEvent[] {
  const from = startOfDay(today);
  const to = addDays(from, horizonDays);
  const events: ForecastEvent[] = [];

  /* 1. Неоплаченные счета — только непокрытый остаток */
  invoiceStates(input.invoices, input.invoicePayments, today).forEach((st) => {
    if (st.outstanding <= 0) return;
    const when = st.invoice.expected_date ? d(st.invoice.expected_date) : st.dueDate;
    const date = isBefore(when, from) ? from : when;   // просрочку ждём «уже сегодня»
    if (isAfter(date, to)) return;
    events.push({
      id: `inv-${st.invoice.id}`,
      date,
      amount: st.outstanding,
      kind: "invoice",
      title: `Счёт ${st.invoice.invoice_number}`,
      subtitle: st.invoice.client_name,
      certain: st.overdueDays === 0,
    });
  });

  /* 2. Обязательства — без уже оплаченных и без уже проведённых транзакцией */
  input.obligations.forEach((o) => {
    if (o.status === "paid" || o.status === "cancelled") return;
    if ((o as { transaction_id?: string | null }).transaction_id) return;
    if (!o.due_date) return;
    const when = d(o.due_date);
    const date = isBefore(when, from) ? from : when;
    if (isAfter(date, to)) return;
    events.push({
      id: `obl-${o.id}`,
      date,
      amount: -num(o.amount),
      kind: "obligation",
      title: o.title,
      subtitle: o.counterparty || undefined,
      certain: true,
    });
  });

  /* 3. Регулярные операции — исключая материализованные оккуренции.
        Обязательство, порождённое регулярной операцией, уже учтено в п.2,
        поэтому его оккуренция помечена materialized и сюда не попадёт. */
  input.recurring.forEach((op) => {
    events.push(...recurringEvents(op, input.occurrences, from, to));
  });

  /* 4. Налог — неуплаченный остаток по срокам */
  input.taxes.forEach((t) => {
    const rest = num(t.accrued) - num(t.paid);
    if (rest <= 0 || !t.due_date) return;
    const when = d(t.due_date);
    const date = isBefore(when, from) ? from : when;
    if (isAfter(date, to)) return;
    events.push({
      id: `tax-${t.id}`,
      date,
      amount: -rest,
      kind: "tax",
      title: `Налог за ${t.period}`,
      certain: true,
    });
  });

  /* 5. Невыплаченные начисления партнёрам — один раз, на ближайшую дату */
  const unpaid = input.partnerLedger
    .filter((e) => !e.reversed_at)
    .reduce((acc, e) => acc + (e.entry_type === "accrual" ? num(e.amount) : -num(e.amount)), 0);
  if (unpaid > 0.5) {
    events.push({
      id: "partner-unpaid",
      date: addDays(from, 1),
      amount: -unpaid,
      kind: "partner",
      title: "Выплаты партнёрам",
      subtitle: "начислено, но не выплачено",
      certain: true,
    });
  }

  return events.sort((a, b) => a.date.getTime() - b.date.getTime());
}

export interface ForecastPoint {
  date: string;
  label: string;
  fact: number | null;
  projected: number | null;
}

export interface ForecastResult {
  events: ForecastEvent[];
  projected30: number;
  projected90: number;
  projected365: number;
  series: ForecastPoint[];
  expectedReceipts30: number;
  expectedPayments30: number;
  lowestPoint: { date: Date; value: number } | null;
}

export function buildForecast(
  input: EngineInput,
  snapshot: Pick<FinancialSnapshot, "cashPosition">,
  today = new Date(),
): ForecastResult {
  const from = startOfDay(today);
  const events = buildForecastEvents(input, 365, today);

  const at = (days: number) =>
    snapshot.cashPosition +
    events.filter((e) => !isAfter(e.date, addDays(from, days))).reduce((s, e) => s + e.amount, 0);

  // дневная кривая на 90 дней
  const series: ForecastPoint[] = [];
  let running = snapshot.cashPosition;
  let lowest: { date: Date; value: number } | null = null;
  for (let i = 0; i <= 90; i++) {
    const day = addDays(from, i);
    const key = format(day, "yyyy-MM-dd");
    running += events
      .filter((e) => format(e.date, "yyyy-MM-dd") === key)
      .reduce((s, e) => s + e.amount, 0);
    if (!lowest || running < lowest.value) lowest = { date: day, value: running };
    series.push({
      date: key,
      label: format(day, "d MMM", { locale: ru }),
      fact: i === 0 ? snapshot.cashPosition : null,
      projected: Math.round(running),
    });
  }

  const in30 = events.filter((e) => !isAfter(e.date, addDays(from, 30)));
  return {
    events,
    projected30: at(30),
    projected90: at(90),
    projected365: at(365),
    series,
    expectedReceipts30: in30.filter((e) => e.amount > 0).reduce((s, e) => s + e.amount, 0),
    expectedPayments30: -in30.filter((e) => e.amount < 0).reduce((s, e) => s + e.amount, 0),
    lowestPoint: lowest,
  };
}
