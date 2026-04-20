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
