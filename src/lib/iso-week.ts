// ISO-неделя (понедельник = старт). Используется в недельных отчётах.

export interface IsoWeek {
  year: number;
  week: number;
  start: Date;
  end: Date;
}

export function getIsoWeek(d: Date = new Date()): IsoWeek {
  const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((date.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  const start = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  start.setUTCDate(start.getUTCDate() - (day - 1));
  const end = new Date(start);
  end.setUTCDate(start.getUTCDate() + 6);
  return { year: date.getUTCFullYear(), week, start, end };
}

export function shiftWeeks(iso: IsoWeek, delta: number): IsoWeek {
  const d = new Date(iso.start);
  d.setUTCDate(d.getUTCDate() + delta * 7);
  return getIsoWeek(d);
}

const MONTHS = ["янв","фев","мар","апр","мая","июн","июл","авг","сен","окт","ноя","дек"];

export function formatWeekRange(start: Date | string, end: Date | string): string {
  const s = typeof start === "string" ? new Date(start) : start;
  const e = typeof end === "string" ? new Date(end) : end;
  return `${s.getUTCDate()} ${MONTHS[s.getUTCMonth()]} — ${e.getUTCDate()} ${MONTHS[e.getUTCMonth()]} ${e.getUTCFullYear()}`;
}

const toDateOnly = (d: Date) =>
  `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;

const shortLabel = (d: Date) => `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;

export interface WeekOption {
  week_number: number;
  week_year: number;
  start: string; // YYYY-MM-DD
  end: string;   // YYYY-MM-DD
  label: string;
}

/**
 * Возвращает список ISO-недель (понедельник—воскресенье), пересекающихся с диапазоном [from..to].
 * Границы недели НЕ обрезаются датами периода — это полные календарные недели,
 * которые удобно показывать пользователю в селекте «Неделя выполнения».
 */
export function generateWeeksInRange(from: string | Date, to: string | Date): WeekOption[] {
  const start = typeof from === "string" ? new Date(`${from.slice(0, 10)}T00:00:00Z`) : from;
  const end = typeof to === "string" ? new Date(`${to.slice(0, 10)}T00:00:00Z`) : to;
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || start > end) return [];

  // Сдвигаем начало на понедельник недели, в которой лежит start
  const day = start.getUTCDay() || 7;
  const cursor = new Date(start);
  cursor.setUTCDate(cursor.getUTCDate() - (day - 1));

  const result: WeekOption[] = [];
  let guard = 0;
  while (cursor <= end && guard < 200) {
    const wkStart = new Date(cursor);
    const wkEnd = new Date(cursor);
    wkEnd.setUTCDate(wkEnd.getUTCDate() + 6);
    const iso = getIsoWeek(wkStart);
    result.push({
      week_number: iso.week,
      week_year: iso.year,
      start: toDateOnly(wkStart),
      end: toDateOnly(wkEnd),
      label: `Неделя ${iso.week} (${shortLabel(wkStart)} — ${shortLabel(wkEnd)})`,
    });
    cursor.setUTCDate(cursor.getUTCDate() + 7);
    guard++;
  }
  return result;
}

/** Находит неделю в списке, в которую попадает заданная дата (включительно). */
export function findWeekForDate(weeks: WeekOption[], date: string | Date): WeekOption | null {
  const d = typeof date === "string" ? date.slice(0, 10) : toDateOnly(date);
  return weeks.find((w) => d >= w.start && d <= w.end) || null;
}
