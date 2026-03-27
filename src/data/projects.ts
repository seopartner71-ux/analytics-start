export interface WorkTask {
  id: string;
  text: string;
  link: string;
  done: boolean;
  month: number;
  year: number;
  createdAt: number;
}

export interface Integration {
  key: string;
  connected: boolean;
  lastSync?: string;
  apiKey?: string;
  projectId?: string;
}

export interface ProjectData {
  id: string;
  name: string;
  url: string;
  description: string;
  integrations: Integration[];
  tasks: WorkTask[];
}

export const defaultIntegrations: Integration[] = [
  { key: "yandexMetrika", connected: false },
  { key: "yandexWebmaster", connected: false },
  { key: "googleSearchConsole", connected: false },
  { key: "topvisor", connected: false },
];

export const demoProjects: ProjectData[] = [
  {
    id: "1",
    name: "TechStart",
    url: "techstart.io",
    description: "Tech startup landing page",
    integrations: [
      { key: "yandexMetrika", connected: true, lastSync: "2025-10-28T14:30:00Z" },
      { key: "yandexWebmaster", connected: false },
      { key: "googleSearchConsole", connected: true, lastSync: "2025-10-28T12:00:00Z" },
      { key: "topvisor", connected: true, lastSync: "2025-10-27T09:00:00Z", apiKey: "tv_***hidden***", projectId: "123456" },
    ],
    tasks: [
      { id: "t1", text: "Аудит сайта и сбор семантического ядра", link: "https://docs.google.com/document/d/example1", done: true, month: 9, year: 2025, createdAt: 1 },
      { id: "t2", text: "Оптимизация мета-тегов на главных страницах", link: "", done: true, month: 9, year: 2025, createdAt: 2 },
      { id: "t3", text: "Написание и публикация 5 SEO-статей", link: "https://docs.google.com/document/d/example2", done: true, month: 9, year: 2025, createdAt: 3 },
      { id: "t4", text: "Настройка целей в Яндекс Метрике", link: "", done: false, month: 10, year: 2025, createdAt: 4 },
      { id: "t5", text: "Анализ конкурентов и корректировка стратегии", link: "https://docs.google.com/spreadsheets/d/example3", done: false, month: 10, year: 2025, createdAt: 5 },
    ],
  },
  {
    id: "2",
    name: "GreenShop",
    url: "greenshop.ru",
    description: "Eco-friendly online shop",
    integrations: [
      { key: "yandexMetrika", connected: true, lastSync: "2025-10-28T10:00:00Z" },
      { key: "yandexWebmaster", connected: true, lastSync: "2025-10-28T10:00:00Z" },
      { key: "googleSearchConsole", connected: false },
      { key: "topvisor", connected: false },
    ],
    tasks: [
      { id: "t6", text: "Техническая оптимизация скорости загрузки", link: "", done: true, month: 9, year: 2025, createdAt: 1 },
      { id: "t7", text: "Создание карточек товаров с уникальными описаниями", link: "", done: true, month: 10, year: 2025, createdAt: 2 },
    ],
  },
  {
    id: "3",
    name: "MediaFlow",
    url: "mediaflow.com",
    description: "Media analytics platform",
    integrations: [
      { key: "yandexMetrika", connected: false },
      { key: "yandexWebmaster", connected: false },
      { key: "googleSearchConsole", connected: true, lastSync: "2025-10-27T18:00:00Z" },
      { key: "topvisor", connected: false },
    ],
    tasks: [],
  },
  {
    id: "4",
    name: "FinTrack",
    url: "fintrack.app",
    description: "Financial tracking app",
    integrations: [
      { key: "yandexMetrika", connected: true, lastSync: "2025-10-28T08:00:00Z" },
      { key: "yandexWebmaster", connected: true, lastSync: "2025-10-28T08:00:00Z" },
      { key: "googleSearchConsole", connected: true, lastSync: "2025-10-28T08:00:00Z" },
      { key: "topvisor", connected: true, lastSync: "2025-10-28T08:00:00Z", apiKey: "tv_***hidden***", projectId: "789012" },
    ],
    tasks: [
      { id: "t8", text: "Редизайн лендинга", link: "", done: true, month: 10, year: 2025, createdAt: 1 },
    ],
  },
  {
    id: "5",
    name: "EduPlatform",
    url: "eduplatform.org",
    description: "Educational platform",
    integrations: [...defaultIntegrations],
    tasks: [],
  },
];

// ---- Demo data for analytics widgets ----

export const trafficData = [
  { name: "1", visitors: 420 },
  { name: "3", visitors: 510 },
  { name: "5", visitors: 680 },
  { name: "7", visitors: 620 },
  { name: "10", visitors: 590 },
  { name: "12", visitors: 730 },
  { name: "15", visitors: 870 },
  { name: "17", visitors: 810 },
  { name: "20", visitors: 1020 },
  { name: "22", visitors: 960 },
  { name: "25", visitors: 940 },
  { name: "27", visitors: 1080 },
  { name: "30", visitors: 1150 },
];

export const sourcesData = [
  { name: "organic", value: 4500 },
  { name: "direct", value: 2100 },
  { name: "social", value: 1800 },
  { name: "referral", value: 900 },
];

export const kpiData = {
  visits: { value: 12450, change: 18.5 },
  bounceRate: { value: 32.1, change: -4.2 },
  depth: { value: 3.8, change: 12.0 },
  positions: { value: 14.2, change: -22.0 },
};

// Metrika widget data
export const metrikaVisitsData = [
  { day: "1", visits: 380 }, { day: "3", visits: 420 }, { day: "5", visits: 510 },
  { day: "7", visits: 490 }, { day: "9", visits: 580 }, { day: "11", visits: 620 },
  { day: "13", visits: 550 }, { day: "15", visits: 710 }, { day: "17", visits: 680 },
  { day: "19", visits: 740 }, { day: "21", visits: 820 }, { day: "23", visits: 790 },
  { day: "25", visits: 850 }, { day: "27", visits: 910 }, { day: "30", visits: 980 },
];

export const metrikaKpis = {
  bounceRate: 32.1,
  pageDepth: 3.8,
  avgTime: "2:45",
};

// Webmaster widget data
export const webmasterErrors = [
  { id: "e1", type: "critical", message: "Страница /products/old-item возвращает 404", date: "2025-10-27" },
  { id: "e2", type: "critical", message: "Дублирование title на 12 страницах", date: "2025-10-26" },
  { id: "e3", type: "critical", message: "Robots.txt блокирует /api/ раздел", date: "2025-10-25" },
];
export const webmasterPagesInSearch = 1847;

// GSC widget data
export const gscQueries = [
  { query: "купить эко товары", clicks: 342, impressions: 8200, position: 4.2 },
  { query: "экологичные продукты", clicks: 218, impressions: 5600, position: 6.8 },
  { query: "натуральная косметика", clicks: 187, impressions: 4100, position: 3.1 },
  { query: "зеленый магазин москва", clicks: 156, impressions: 2900, position: 2.4 },
  { query: "органические продукты доставка", clicks: 134, impressions: 3800, position: 7.5 },
];

// Topvisor widget data
export const topvisorPositions = [
  { name: "top3", value: 28 },
  { name: "top10", value: 45 },
  { name: "top30", value: 67 },
  { name: "outside", value: 34 },
];

export const topvisorGrowth = [
  { keyword: "купить эко товары", from: 18, to: 4, change: -14 },
  { keyword: "натуральная косметика москва", from: 25, to: 8, change: -17 },
  { keyword: "зеленый магазин", from: 12, to: 3, change: -9 },
  { keyword: "органические продукты", from: 30, to: 11, change: -19 },
  { keyword: "экологичная бытовая химия", from: 42, to: 22, change: -20 },
];
