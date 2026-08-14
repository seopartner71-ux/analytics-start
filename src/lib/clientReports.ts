import {
  addMonths, differenceInCalendarDays, endOfMonth, format, getDate, isAfter, startOfDay,
} from "date-fns";
import { ru } from "date-fns/locale";

export type ReportStatus = "none" | "normal" | "soon" | "today" | "overdue";

export interface ReportState {
  /** Ближайшая (текущая незакрытая) отчётная дата */
  dueDate: Date | null;
  /** Дней до отчётности (отрицательное — просрочено) */
  daysLeft: number | null;
  status: ReportStatus;
  periodKey: string;
  periodLabel: string;
}

/** Дата отчётности в конкретном месяце с учётом коротких месяцев (31 → 28/29/30). */
export function dueDateInMonth(base: Date, day: number): Date {
  const last = getDate(endOfMonth(base));
  return startOfDay(new Date(base.getFullYear(), base.getMonth(), Math.min(Math.max(day, 1), last)));
}

/** Отчётный период — месяц, ЗА который сдаётся отчёт (предыдущий к дате сдачи). */
export function reportPeriodOf(due: Date) {
  const p = addMonths(due, -1);
  return {
    year: p.getFullYear(),
    month: p.getMonth() + 1,
    key: format(p, "yyyy-MM"),
    label: format(p, "LLLL yyyy", { locale: ru }),
  };
}

/**
 * Рассчитывает ближайшую отчётную дату клиента.
 * lastDoneDue — плановая дата последнего закрытого отчёта.
 */
export function computeReportState(
  reportDay: number | null | undefined,
  lastDoneDue: string | Date | null | undefined,
  today: Date = new Date(),
  warnDays = 3,
): ReportState {
  const empty: ReportState = { dueDate: null, daysLeft: null, status: "none", periodKey: "", periodLabel: "" };
  if (!reportDay) return empty;

  const now = startOfDay(today);
  const done = lastDoneDue ? startOfDay(new Date(lastDoneDue)) : null;

  let due = dueDateInMonth(now, reportDay);
  if (done && !isAfter(due, done)) due = dueDateInMonth(addMonths(now, 1), reportDay);

  const daysLeft = differenceInCalendarDays(due, now);
  const status: ReportStatus =
    daysLeft < 0 ? "overdue" : daysLeft === 0 ? "today" : daysLeft <= warnDays ? "soon" : "normal";

  const p = reportPeriodOf(due);
  return { dueDate: due, daysLeft, status, periodKey: p.key, periodLabel: p.label };
}

export const REPORT_STATUS_LABEL: Record<ReportStatus, string> = {
  none: "Без отчётности",
  normal: "Нормально",
  soon: "Скоро",
  today: "Сегодня",
  overdue: "Просрочено",
};

export const REPORT_STATUS_TONE: Record<ReportStatus, "neutral" | "success" | "warning" | "danger"> = {
  none: "neutral",
  normal: "success",
  soon: "warning",
  today: "warning",
  overdue: "danger",
};

export function daysLeftLabel(daysLeft: number | null): string {
  if (daysLeft === null) return "—";
  if (daysLeft === 0) return "сегодня";
  if (daysLeft < 0) return `просрочено ${plural(Math.abs(daysLeft))}`;
  return plural(daysLeft);
}

export function plural(n: number): string {
  const m10 = n % 10;
  const m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return `${n} день`;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return `${n} дня`;
  return `${n} дней`;
}

export const fmtRu = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "d MMMM yyyy", { locale: ru }) : "—";

export const fmtRuShort = (d: Date | string | null | undefined) =>
  d ? format(new Date(d), "dd.MM.yyyy") : "—";

export const CLIENT_STATUSES = [
  { value: "active", label: "Активен" },
  { value: "paused", label: "На паузе" },
  { value: "archived", label: "Архив" },
] as const;

export const CLIENT_TYPES = [
  { value: "company", label: "Юр. лицо" },
  { value: "ip", label: "ИП" },
  { value: "individual", label: "Физ. лицо" },
] as const;
