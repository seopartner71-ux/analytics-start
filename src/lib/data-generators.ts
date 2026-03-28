import { differenceInDays, format } from "date-fns";

/**
 * Deterministic hash from a string — produces consistent numbers for the same input.
 */
function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = ((h << 5) - h + s.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Deterministic pseudo-random from seed. Returns value in [0, 1).
 */
function seededRandom(seed: number): number {
  const x = Math.sin(seed * 9301 + 49297) * 49297;
  return x - Math.floor(x);
}

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Generate a base daily visits value for a specific date.
 * Produces consistent values for the same date, with realistic weekly patterns.
 */
function dailyBaseVisits(date: Date): number {
  const dayOfWeek = date.getDay();
  const seed = hashStr(format(date, "yyyy-MM-dd"));
  const base = 500 + seededRandom(seed) * 400; // 500–900 base
  // Weekends get 60-80% traffic
  const weekendFactor = (dayOfWeek === 0 || dayOfWeek === 6) ? 0.6 + seededRandom(seed + 1) * 0.2 : 1;
  return Math.round(base * weekendFactor);
}

/**
 * Generate daily visits array for a date range.
 */
export function generateDailyVisits(range: DateRange): { date: Date; dateStr: string; visits: number }[] {
  const days = differenceInDays(range.to, range.from) + 1;
  const result = [];
  for (let i = 0; i < days; i++) {
    const date = new Date(range.from);
    date.setDate(date.getDate() + i);
    result.push({
      date,
      dateStr: format(date, "dd.MM"),
      visits: dailyBaseVisits(date),
    });
  }
  return result;
}

/**
 * Compute aggregate KPIs from daily visits.
 */
export function computeKpis(dailyVisits: { visits: number }[]) {
  const totalVisits = dailyVisits.reduce((s, d) => s + d.visits, 0);
  const totalVisitors = Math.round(totalVisits * 0.72);
  const bounceRate = Math.round((25 + (totalVisits % 13)) * 10) / 10;
  const conversions = Math.round(totalVisits * 0.034);
  return { totalVisits, totalVisitors, bounceRate, conversions };
}

/**
 * Generate pages data deterministically based on date range.
 */
/**
 * Generate pages based on the project URL to avoid showing irrelevant data.
 */
function getPagesForProject(projectUrl?: string) {
  const domain = projectUrl ? projectUrl.replace(/https?:\/\//, "").replace(/\/$/, "") : "";

  if (domain.includes("linguala") || domain.includes("lingua")) {
    return [
      { url: "/", title: "Главная", baseVisits: 3800, baseBounce: 30.2, baseTime: 170 },
      { url: "/courses", title: "Курсы", baseVisits: 2950, baseBounce: 18.5, baseTime: 260 },
      { url: "/courses/english", title: "Английский язык", baseVisits: 2100, baseBounce: 16.3, baseTime: 285 },
      { url: "/courses/german", title: "Немецкий язык", baseVisits: 1200, baseBounce: 20.1, baseTime: 240 },
      { url: "/courses/french", title: "Французский язык", baseVisits: 980, baseBounce: 21.7, baseTime: 230 },
      { url: "/prices", title: "Цены", baseVisits: 1800, baseBounce: 32.0, baseTime: 130 },
      { url: "/online", title: "Онлайн-обучение", baseVisits: 1500, baseBounce: 22.4, baseTime: 200 },
      { url: "/teachers", title: "Преподаватели", baseVisits: 1100, baseBounce: 25.8, baseTime: 190 },
      { url: "/contacts", title: "Контакты", baseVisits: 750, baseBounce: 40.5, baseTime: 85 },
      { url: "/blog", title: "Блог", baseVisits: 620, baseBounce: 14.2, baseTime: 320 },
    ];
  }

  if (domain.includes("souzcvettorg") || domain.includes("cvet")) {
    return [
      { url: "/", title: "Главная страница", baseVisits: 4250, baseBounce: 28.5, baseTime: 185 },
      { url: "/catalog", title: "Каталог цветов", baseVisits: 2830, baseBounce: 22.1, baseTime: 240 },
      { url: "/delivery", title: "Доставка", baseVisits: 1920, baseBounce: 35.2, baseTime: 120 },
      { url: "/bouquets/roses", title: "Букеты из роз", baseVisits: 1650, baseBounce: 19.8, baseTime: 195 },
      { url: "/corporate", title: "Корпоративным клиентам", baseVisits: 980, baseBounce: 31.0, baseTime: 165 },
      { url: "/blog/spring-flowers", title: "Весенние цветы: гид", baseVisits: 870, baseBounce: 15.3, baseTime: 310 },
      { url: "/contacts", title: "Контакты", baseVisits: 750, baseBounce: 42.1, baseTime: 85 },
      { url: "/about", title: "О нас", baseVisits: 620, baseBounce: 38.7, baseTime: 130 },
      { url: "/blog/wedding-bouquets", title: "Свадебные букеты", baseVisits: 540, baseBounce: 12.8, baseTime: 280 },
      { url: "/promo", title: "Акции", baseVisits: 480, baseBounce: 25.4, baseTime: 150 },
    ];
  }

  // Generic fallback based on domain seed
  const s = hashStr(domain || "default");
  const sections = ["services", "about", "contacts", "blog", "prices", "portfolio", "team", "faq", "reviews"];
  const titles = ["Услуги", "О компании", "Контакты", "Блог", "Цены", "Портфолио", "Команда", "FAQ", "Отзывы"];
  const result = [{ url: "/", title: "Главная", baseVisits: 3500, baseBounce: 29.0, baseTime: 170 }];
  for (let i = 0; i < sections.length; i++) {
    result.push({
      url: `/${sections[i]}`,
      title: titles[i],
      baseVisits: Math.round(2500 - i * 200 + seededRandom(s + i) * 400),
      baseBounce: Math.round((18 + seededRandom(s + i + 50) * 25) * 10) / 10,
      baseTime: Math.round(100 + seededRandom(s + i + 80) * 220),
    });
  }
  return result;
}

export function generatePagesData(range: DateRange, projectUrl?: string) {
  const days = differenceInDays(range.to, range.from) + 1;
  const seed = hashStr(format(range.from, "yyyy-MM-dd") + format(range.to, "yyyy-MM-dd"));
  const scaleFactor = days / 30;
  const pages = getPagesForProject(projectUrl);

  return pages.map((p, i) => {
    const variance = 0.85 + seededRandom(seed + i) * 0.3;
    const visits = Math.round(p.baseVisits * scaleFactor * variance);
    const bounceRate = Math.round((p.baseBounce + (seededRandom(seed + i + 100) - 0.5) * 8) * 10) / 10;
    const avgTime = Math.round(p.baseTime * (0.9 + seededRandom(seed + i + 200) * 0.2));
    const growth = Math.round((seededRandom(seed + i + 300) * 60 - 10) * 10) / 10;
    return { url: p.url, title: p.title, visits, bounceRate, avgTime, growth };
  });
}

/**
 * Compute comparison delta percentage.
 */
export function calcDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}
