import {
  startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth,
  startOfQuarter, endOfQuarter, startOfYear, endOfYear, subMonths, subDays,
  differenceInCalendarDays, eachDayOfInterval, eachMonthOfInterval, format,
} from "date-fns";
import { ru } from "date-fns/locale";

/** Ставка налогового резерва (УСН 6%) — существующая бизнес-логика компании. */
export const TAX_RATE = 0.06;

/** Категории транзакций, которые не являются операционными расходами компании. */
export const NON_OPEX_CATEGORIES = ["cash_reserve", "owner_withdrawal", "partner_payout", "tax"];

export const money = (n: number, withSign = false) => {
  const v = Math.round(Number(n) || 0);
  const formatted = new Intl.NumberFormat("ru-RU", {
    style: "currency", currency: "RUB", maximumFractionDigits: 0,
  }).format(Math.abs(v));
  if (!withSign) return v < 0 ? `−${formatted}` : formatted;
  return `${v < 0 ? "−" : "+"}${formatted}`;
};

export const compactMoney = (n: number) => {
  const v = Math.abs(Number(n) || 0);
  const sign = n < 0 ? "−" : "";
  if (v >= 1_000_000) return `${sign}${(v / 1_000_000).toFixed(1)} млн`;
  if (v >= 1_000) return `${sign}${Math.round(v / 1000)} тыс`;
  return `${sign}${Math.round(v)}`;
};

export const pct = (a: number, b: number) => {
  if (!b) return a > 0 ? 100 : 0;
  return ((a - b) / Math.abs(b)) * 100;
};

export type PeriodKey = "today" | "week" | "month" | "quarter" | "half" | "year" | "custom";

export interface Period { from: Date; to: Date }

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  today: "Сегодня",
  week: "Неделя",
  month: "Месяц",
  quarter: "Квартал",
  half: "Полугодие",
  year: "Год",
  custom: "Период",
};

export function periodFor(key: PeriodKey, base = new Date()): Period {
  switch (key) {
    case "today": return { from: startOfDay(base), to: endOfDay(base) };
    case "week": return { from: startOfWeek(base, { weekStartsOn: 1 }), to: endOfWeek(base, { weekStartsOn: 1 }) };
    case "quarter": return { from: startOfQuarter(base), to: endOfQuarter(base) };
    case "half": return { from: startOfMonth(subMonths(base, 5)), to: endOfMonth(base) };
    case "year": return { from: startOfYear(base), to: endOfYear(base) };
    case "month":
    default: return { from: startOfMonth(base), to: endOfMonth(base) };
  }
}

/** Предыдущий сопоставимый период той же длины. */
export function previousPeriod(p: Period): Period {
  const days = differenceInCalendarDays(p.to, p.from) + 1;
  return { from: subDays(p.from, days), to: subDays(p.to, days) };
}

export const inPeriod = (date: string | Date | null | undefined, p: Period) => {
  if (!date) return false;
  const d = typeof date === "string" ? new Date(date) : date;
  return d >= startOfDay(p.from) && d <= endOfDay(p.to);
};

export const fmtDate = (d: string | Date | null | undefined) =>
  d ? format(typeof d === "string" ? new Date(d) : d, "d MMM yyyy", { locale: ru }) : "—";

export const fmtPeriodLabel = (p: Period) =>
  `${format(p.from, "d MMM", { locale: ru })} — ${format(p.to, "d MMM yyyy", { locale: ru })}`;

/** Точки оси X для графика: дни для коротких периодов, месяцы для длинных. */
export function buildBuckets(p: Period) {
  const days = differenceInCalendarDays(p.to, p.from) + 1;
  if (days <= 62) {
    return eachDayOfInterval({ start: p.from, end: p.to }).map((d) => ({
      key: format(d, "yyyy-MM-dd"),
      label: format(d, "d MMM", { locale: ru }),
      from: startOfDay(d),
      to: endOfDay(d),
    }));
  }
  return eachMonthOfInterval({ start: p.from, end: p.to }).map((d) => ({
    key: format(d, "yyyy-MM"),
    label: format(d, "LLL yy", { locale: ru }),
    from: startOfMonth(d),
    to: endOfMonth(d),
  }));
}

export const INVOICE_STATUS: Record<string, { label: string; tone: "neutral" | "warning" | "success" | "danger" }> = {
  draft: { label: "Выставлено", tone: "neutral" },
  sent: { label: "Ожидает оплаты", tone: "warning" },
  partial: { label: "Частично оплачено", tone: "warning" },
  paid: { label: "Оплачено", tone: "success" },
  overdue: { label: "Просрочено", tone: "danger" },
  cancelled: { label: "Отменено", tone: "neutral" },
};

/** Срок оплаты счёта: 7 дней с даты выставления (внутренний регламент). */
export const INVOICE_TERM_DAYS = 7;

export const EXPENSE_TYPE: Record<string, string> = {
  fixed: "Постоянный",
  variable: "Переменный",
  onetime: "Разовый",
};
