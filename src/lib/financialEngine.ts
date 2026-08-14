/**
 * ЕДИНЫЙ ФИНАНСОВЫЙ ДВИЖОК.
 *
 * Единственный источник финансовых формул в приложении.
 * Ни один компонент не имеет права считать прибыль, налог, дебиторку
 * или распределяемую прибыль самостоятельно.
 *
 * Словарь показателей:
 *  cashPosition        — деньги на счетах СЕЙЧАС (без периода)
 *  cashFlow            — движение денег за период (приход − расход, без переводов)
 *  revenue             — начисленный доход: счета, выставленные в периоде
 *  received            — фактически полученные деньги от клиентов за период
 *  expenses            — операционные расходы за период
 *  taxAccrued/Paid     — налог начислен / уплачен (накопительно)
 *  taxReserve          — начислено − уплачено (деньги компании, но не её)
 *  profit              — начисленная прибыль периода (revenue − expenses − налог периода)
 *  cashProfit          — денежная прибыль периода (received − expenses − налог периода)
 *  receivable          — дебиторка: неоплаченные остатки счетов
 *  payable             — обязательства к оплате
 *  customerCredit      — переплаты и авансы клиентов (наш долг перед ними)
 *  partnerAccrued/Paid — начислено / выплачено партнёрам (накопительно)
 *  partnerUnpaid       — начислено, но не выплачено
 *  retainedProfit      — накопленная прибыль − накопленные начисления партнёрам
 *  distributableProfit — сколько реально можно распределить сейчас
 */
import { addDays, differenceInCalendarDays, isAfter, isBefore, parseISO } from "date-fns";
import { inPeriod, type Period } from "./finance";

/* ───────────────────────── типы данных ───────────────────────── */

export type Account = {
  id: string; name: string; kind: string; balance: number; currency: string; is_active: boolean;
};

export type Tx = {
  id: string; account_id: string | null; type: "income" | "expense" | "transfer";
  amount: number; date: string; category: string | null; description: string | null;
  client_id: string | null; invoice_id: string | null;
};

export type Invoice = {
  id: string; invoice_number: string; client_id: string | null; client_name: string;
  service: string | null; amount: number; status: string;
  date_created: string; date_paid: string | null; due_date: string | null; expected_date: string | null;
  comment: string | null; paid_to_account_id: string | null;
};

export type InvoicePayment = {
  id: string; invoice_id: string; transaction_id: string | null;
  amount: number; paid_at: string; kind: "payment" | "refund";
  reversed_at: string | null; comment: string | null;
};

export type Obligation = {
  id: string; title: string; category: string | null; counterparty: string | null;
  amount: number; due_date: string | null; status: string; comment: string | null;
  paid_at: string | null; recurring_id: string | null; occurrence_date: string | null;
};

export type CustomerCredit = {
  id: string; client_id: string | null; client_name: string | null; invoice_id: string | null;
  amount: number; reason: string; status: string;
};

export type TaxLiability = {
  id: string; period: string; period_start: string; period_end: string;
  taxable_base: number; rate: number; accrued: number; paid: number; due_date: string | null;
};

export type PartnerLedgerEntry = {
  id: string; partner_id: string; entry_type: "accrual" | "payout";
  amount: number; period: string | null; entry_date: string;
  reversed_at: string | null; distribution_id: string | null;
};

export type FinancialPeriod = {
  id: string; period: string; period_start: string; period_end: string;
  status: "open" | "closed"; closing_profit: number | null;
};

export type RecurringOperation = {
  id: string; title: string; direction: "income" | "expense"; category: string | null;
  counterparty: string | null; amount: number; amount_valid_from: string;
  frequency: "monthly" | "quarterly" | "yearly"; day_of_month: number; month_of_year: number | null;
  started_at: string; ended_at: string | null; is_active: boolean; account_id: string | null;
};

export type RecurringOccurrence = {
  id: string; recurring_id: string; occurrence_date: string; amount: number;
  status: "planned" | "materialized" | "skipped";
};

export type EngineSettings = {
  taxRate: number;
  safetyBuffer: number;
  partner1Id: string | null;
  partner2Id: string | null;
  partner1Share: number;
  partner2Share: number;
};

export const DEFAULT_SETTINGS: EngineSettings = {
  taxRate: 0.06,
  safetyBuffer: 0,
  partner1Id: null,
  partner2Id: null,
  partner1Share: 50,
  partner2Share: 50,
};

export interface EngineInput {
  period: Period;
  accounts: Account[];
  transactions: Tx[];
  invoices: Invoice[];
  invoicePayments: InvoicePayment[];
  obligations: Obligation[];
  customerCredits: CustomerCredit[];
  taxes: TaxLiability[];
  partnerLedger: PartnerLedgerEntry[];
  periods: FinancialPeriod[];
  recurring: RecurringOperation[];
  occurrences: RecurringOccurrence[];
  settings: EngineSettings;
}

/* ───────────────────────── категории ───────────────────────── */

/** Категории, которые НЕ являются операционными расходами компании. */
export const NON_OPEX = ["cash_reserve", "owner_withdrawal", "partner_payout", "tax", "transfer_out", "refund"];
/** Категории прихода, которые НЕ являются выручкой (внутренние движения). */
export const NON_REVENUE_INCOME = ["cash_reserve", "transfer_in", "transfer", "partner_contribution"];

export const isOpex = (t: Tx) => t.type === "expense" && !NON_OPEX.includes(t.category || "");
export const isRealIncome = (t: Tx) => t.type === "income" && !NON_REVENUE_INCOME.includes(t.category || "");

const num = (v: unknown) => Number(v) || 0;
const d = (v: string | Date) => (typeof v === "string" ? parseISO(v) : v);

/* ───────────────────────── счета и платежи ───────────────────────── */

export interface InvoiceState {
  invoice: Invoice;
  paidTotal: number;
  outstanding: number;
  overpaid: number;
  dueDate: Date;
  overdueDays: number;
  isClosed: boolean;
}

/** Состояние одного счёта с учётом всех платежей, возвратов и сторно. */
export function invoiceState(inv: Invoice, payments: InvoicePayment[], today = new Date()): InvoiceState {
  const rows = payments.filter((p) => p.invoice_id === inv.id && !p.reversed_at);
  const paidTotal = rows.reduce((s, p) => s + (p.kind === "payment" ? num(p.amount) : -num(p.amount)), 0);
  const amount = num(inv.amount);
  const cancelled = inv.status === "cancelled";
  const outstanding = cancelled ? 0 : Math.max(0, amount - paidTotal);
  const overpaid = Math.max(0, paidTotal - amount);
  const dueDate = inv.due_date ? d(inv.due_date) : addDays(d(inv.date_created), 7);
  const overdueDays = outstanding > 0 ? Math.max(0, differenceInCalendarDays(today, dueDate)) : 0;
  return { invoice: inv, paidTotal, outstanding, overpaid, dueDate, overdueDays, isClosed: outstanding <= 0 };
}

export function invoiceStates(invoices: Invoice[], payments: InvoicePayment[], today = new Date()) {
  return invoices.map((i) => invoiceState(i, payments, today));
}

/* ───────────────────────── налог ───────────────────────── */

export interface TaxState {
  accrued: number;
  paid: number;
  reserve: number;
  duePeriods: TaxLiability[];
}

/**
 * Налог — накопительное обязательство, а не «6% на лету».
 * Если явных записей нет, база считается по фактически полученным деньгам
 * (УСН — кассовый метод), но это всё равно накопительная величина.
 */
export function taxState(taxes: TaxLiability[], transactions: Tx[], rate: number): TaxState {
  if (taxes.length) {
    const accrued = taxes.reduce((s, t) => s + num(t.accrued), 0);
    const paid = taxes.reduce((s, t) => s + num(t.paid), 0);
    return { accrued, paid, reserve: Math.max(0, accrued - paid), duePeriods: taxes.filter((t) => num(t.accrued) > num(t.paid)) };
  }
  const base = transactions.filter(isRealIncome).reduce((s, t) => s + num(t.amount), 0);
  const accrued = base * rate;
  const paid = transactions.filter((t) => t.type === "expense" && t.category === "tax").reduce((s, t) => s + num(t.amount), 0);
  return { accrued, paid, reserve: Math.max(0, accrued - paid), duePeriods: [] };
}

/* ───────────────────────── партнёры ───────────────────────── */

export interface PartnerState {
  partnerId: string;
  accrued: number;
  paid: number;
  unpaid: number;
}

export function partnerStates(ledger: PartnerLedgerEntry[], partnerIds: string[]): PartnerState[] {
  const live = ledger.filter((e) => !e.reversed_at);
  const ids = Array.from(new Set([...partnerIds.filter(Boolean), ...live.map((e) => e.partner_id)]));
  return ids.map((partnerId) => {
    const rows = live.filter((e) => e.partner_id === partnerId);
    const accrued = rows.filter((e) => e.entry_type === "accrual").reduce((s, e) => s + num(e.amount), 0);
    const paid = rows.filter((e) => e.entry_type === "payout").reduce((s, e) => s + num(e.amount), 0);
    return { partnerId, accrued, paid, unpaid: Math.max(0, accrued - paid) };
  });
}

/* ───────────────────────── снимок ───────────────────────── */

export interface FinancialSnapshot {
  /* сейчас */
  cashPosition: number;
  /* за период */
  cashIn: number;
  cashOut: number;
  cashFlow: number;
  revenue: number;
  received: number;
  expenses: number;
  periodTax: number;
  profit: number;
  cashProfit: number;
  margin: number;
  /* накопительно */
  taxAccrued: number;
  taxPaid: number;
  taxReserve: number;
  receivable: number;
  receivableOverdue: number;
  payable: number;
  payableDue30: number;
  customerCredit: number;
  partnerAccrued: number;
  partnerPaid: number;
  partnerUnpaid: number;
  retainedProfit: number;
  distributableProfit: number;
  distributableLimitedBy: "profit" | "cash";
  safetyBuffer: number;
  /* прогноз */
  forecast30: number;
  forecast90: number;
  forecast365: number;
  /* разрезы */
  partners: PartnerState[];
  invoices: InvoiceState[];
  distributableBreakdown: { label: string; amount: number }[];
}

/** Накопленная прибыль компании за всю историю (начисленный метод по деньгам + счетам). */
export function lifetimeProfit(input: EngineInput): number {
  const closed = input.periods.filter((p) => p.status === "closed" && p.closing_profit !== null);
  if (closed.length) {
    // закрытые периоды зафиксированы, открытые считаем на лету
    const closedSum = closed.reduce((s, p) => s + num(p.closing_profit), 0);
    const closedRanges = closed.map((p) => ({ from: d(p.period_start), to: d(p.period_end) }));
    const inClosed = (date: string) => closedRanges.some((r) => !isBefore(d(date), r.from) && !isAfter(d(date), r.to));
    const openIncome = input.transactions.filter((t) => isRealIncome(t) && !inClosed(t.date)).reduce((s, t) => s + num(t.amount), 0);
    const openExpenses = input.transactions.filter((t) => isOpex(t) && !inClosed(t.date)).reduce((s, t) => s + num(t.amount), 0);
    const openTax = openIncome * input.settings.taxRate;
    return closedSum + openIncome - openExpenses - openTax;
  }
  const income = input.transactions.filter(isRealIncome).reduce((s, t) => s + num(t.amount), 0);
  const expenses = input.transactions.filter(isOpex).reduce((s, t) => s + num(t.amount), 0);
  const tax = taxState(input.taxes, input.transactions, input.settings.taxRate).accrued;
  return income - expenses - tax;
}

export function computeFinancials(input: EngineInput, today = new Date()): FinancialSnapshot {
  const { period, settings } = input;

  /* ── Cash Position ── */
  const cashPosition = input.accounts.reduce((s, a) => s + num(a.balance), 0);

  /* ── Cash Flow за период (переводы исключены — они не меняют общий кэш) ── */
  const inPer = (t: Tx) => inPeriod(t.date, period);
  const cashIn = input.transactions.filter((t) => t.type === "income" && inPer(t)).reduce((s, t) => s + num(t.amount), 0);
  const cashOut = input.transactions.filter((t) => t.type === "expense" && inPer(t)).reduce((s, t) => s + num(t.amount), 0);
  const cashFlow = cashIn - cashOut;

  /* ── Revenue (начислено) — счета, выставленные в периоде, кроме отменённых ── */
  const revenue = input.invoices
    .filter((i) => i.status !== "cancelled" && inPeriod(i.date_created, period))
    .reduce((s, i) => s + num(i.amount), 0);

  /* ── Received (получено) — платежи по счетам в периоде + прочий реальный приход ── */
  const paymentsInPeriod = input.invoicePayments
    .filter((p) => !p.reversed_at && inPeriod(p.paid_at, period))
    .reduce((s, p) => s + (p.kind === "payment" ? num(p.amount) : -num(p.amount)), 0);
  const nonInvoiceIncome = input.transactions
    .filter((t) => isRealIncome(t) && inPer(t) && t.category !== "invoice")
    .reduce((s, t) => s + num(t.amount), 0);
  const received = paymentsInPeriod + nonInvoiceIncome;

  /* ── Expenses (OPEX) ── */
  const expenses = input.transactions.filter((t) => isOpex(t) && inPer(t)).reduce((s, t) => s + num(t.amount), 0);

  /* ── Налог ── */
  const tax = taxState(input.taxes, input.transactions, settings.taxRate);
  const periodTaxRows = input.taxes.filter((t) => inPeriod(t.period_start, period));
  const periodTax = periodTaxRows.length
    ? periodTaxRows.reduce((s, t) => s + num(t.accrued), 0)
    : received * settings.taxRate;

  /* ── Прибыль ── */
  const profit = revenue - expenses - (revenue * settings.taxRate);
  const cashProfit = received - expenses - periodTax;
  const margin = revenue ? (profit / revenue) * 100 : 0;

  /* ── Дебиторка ── */
  const states = invoiceStates(input.invoices, input.invoicePayments, today);
  const receivable = states.reduce((s, st) => s + st.outstanding, 0);
  const receivableOverdue = states.filter((st) => st.overdueDays > 0).reduce((s, st) => s + st.outstanding, 0);

  /* ── Обязательства ── */
  const openObligations = input.obligations.filter((o) => o.status !== "paid" && o.status !== "cancelled");
  const payable = openObligations.reduce((s, o) => s + num(o.amount), 0);
  const horizon30 = addDays(today, 30);
  const payableDue30 = openObligations
    .filter((o) => o.due_date && !isAfter(d(o.due_date), horizon30))
    .reduce((s, o) => s + num(o.amount), 0);

  /* ── Долг перед клиентами ── */
  const customerCredit = input.customerCredits.filter((c) => c.status === "open").reduce((s, c) => s + num(c.amount), 0);

  /* ── Партнёры ── */
  const partners = partnerStates(input.partnerLedger, [settings.partner1Id || "", settings.partner2Id || ""]);
  const partnerAccrued = partners.reduce((s, p) => s + p.accrued, 0);
  const partnerPaid = partners.reduce((s, p) => s + p.paid, 0);
  const partnerUnpaid = partners.reduce((s, p) => s + p.unpaid, 0);

  /* ── Retained / Distributable ──
   * A (прибыльная граница) = накопленная прибыль − всё начисленное партнёрам
   * B (денежная граница)   = кэш − налоговый резерв − обязательства
   *                          − невыплаченные начисления партнёрам − буфер − долг клиентам
   * Partner Accrual вычитается по одному разу в каждой границе:
   *   в A — всё начисленное (уже выплаченное ушло деньгами и в кэше его нет),
   *   в B — только невыплаченное (выплаченное уже списано со счетов).
   */
  const totalProfit = lifetimeProfit(input);
  const retainedProfit = totalProfit - partnerAccrued;
  const cashAvailable =
    cashPosition - tax.reserve - payable - partnerUnpaid - settings.safetyBuffer - customerCredit;
  const distributableProfit = Math.max(0, Math.min(retainedProfit, cashAvailable));
  const distributableLimitedBy = retainedProfit <= cashAvailable ? "profit" : "cash";

  const distributableBreakdown = [
    { label: "Деньги на счетах", amount: cashPosition },
    { label: "Налоговый резерв", amount: -tax.reserve },
    { label: "Обязательства", amount: -payable },
    { label: "Начислено партнёрам, не выплачено", amount: -partnerUnpaid },
    { label: "Резерв компании", amount: -settings.safetyBuffer },
    { label: "Долг перед клиентами", amount: -customerCredit },
  ];

  return {
    cashPosition,
    cashIn, cashOut, cashFlow,
    revenue, received, expenses, periodTax, profit, cashProfit, margin,
    taxAccrued: tax.accrued, taxPaid: tax.paid, taxReserve: tax.reserve,
    receivable, receivableOverdue, payable, payableDue30, customerCredit,
    partnerAccrued, partnerPaid, partnerUnpaid,
    retainedProfit, distributableProfit, distributableLimitedBy,
    safetyBuffer: settings.safetyBuffer,
    forecast30: 0, forecast90: 0, forecast365: 0,
    partners, invoices: states, distributableBreakdown,
  };
}
