export interface WorkTask {
  id: string;
  text: string;
  link: string;
  done: boolean;
  month: number;
  year: number;
  createdAt: number;
}

export interface ProjectData {
  id: string;
  name: string;
  url: string;
  description: string;
  services: {
    yandexMetrika: boolean;
    ga4: boolean;
    webmaster: boolean;
  };
  tasks: WorkTask[];
}

export const demoProjects: ProjectData[] = [
  {
    id: "1",
    name: "TechStart",
    url: "techstart.io",
    description: "Tech startup landing page",
    services: { yandexMetrika: true, ga4: true, webmaster: false },
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
    services: { yandexMetrika: true, ga4: false, webmaster: true },
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
    services: { yandexMetrika: false, ga4: true, webmaster: false },
    tasks: [],
  },
  {
    id: "4",
    name: "FinTrack",
    url: "fintrack.app",
    description: "Financial tracking app",
    services: { yandexMetrika: true, ga4: true, webmaster: true },
    tasks: [
      { id: "t8", text: "Редизайн лендинга", link: "", done: true, month: 10, year: 2025, createdAt: 1 },
    ],
  },
  {
    id: "5",
    name: "EduPlatform",
    url: "eduplatform.org",
    description: "Educational platform",
    services: { yandexMetrika: false, ga4: false, webmaster: false },
    tasks: [],
  },
];

export const trafficData = [
  { name: "1", visitors: 420 },
  { name: "5", visitors: 680 },
  { name: "10", visitors: 590 },
  { name: "15", visitors: 870 },
  { name: "20", visitors: 1020 },
  { name: "25", visitors: 940 },
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
