// CRM Mock Data — all Russian

export interface Company {
  id: string;
  name: string;
  logo: string;
  type: "Клиент" | "Партнёр" | "Лид";
  industry: string;
  website: string;
  phone: string;
  email: string;
  address: string;
  inn: string;
  deals: { count: number; status: string; amount: string };
  responsible: { name: string; avatar: string };
  createdAt: string;
  description: string;
  employees: number;
}

export interface Employee {
  id: string;
  name: string;
  role: string;
  department: string;
  email: string;
  phone: string;
  avatar: string;
  lastActive: string;
  status: "online" | "offline" | "away";
}

export interface CrmTask {
  id: string;
  title: string;
  stage: string;
  stageColor: string;
  stageProgress: number;
  deadline: string;
  overdue: boolean;
  creator: { name: string; avatar: string };
  assignee: { name: string; avatar: string };
  projectName: string;
  priority: "high" | "medium" | "low";
  tags: string[];
  chatMessages: ChatMessage[];
}

export interface ChatMessage {
  id: string;
  author: string;
  avatar: string;
  text: string;
  date: string;
  isSystem?: boolean;
}

export interface CrmProject {
  id: string;
  name: string;
  domain: string;
  client: string;
  trafficGrowth: number;
  tasksTotal: number;
  tasksCompleted: number;
  leader: { name: string; avatar: string };
  members: { name: string; avatar: string }[];
  efficiency: number;
  lastActivity: string;
  privacy: "Закрытый" | "Открытый";
  role: string;
}

const avatars = [
  "АС", "ВС", "ЛШ", "ДК", "ЕП", "МИ", "НВ", "ОР",
];

function av(initials: string) {
  return initials;
}

export const COMPANIES: Company[] = [
  {
    id: "c1", name: "KAT-Lubricants", logo: "KL", type: "Клиент", industry: "Нефтехимия",
    website: "kat-lubricants.ru", phone: "+7 (495) 123-45-67", email: "info@kat-lubricants.ru",
    address: "г. Москва, ул. Ленина, 42", inn: "7701234567",
    deals: { count: 3, status: "В работе", amount: "2 450 000 ₽" },
    responsible: { name: "Алиса Синицына", avatar: av("АС") },
    createdAt: "2024-03-15", description: "Крупный производитель промышленных смазочных материалов. Основной клиент по SEO-продвижению.", employees: 120,
  },
  {
    id: "c2", name: "ТехноСтрой Групп", logo: "ТС", type: "Клиент", industry: "Строительство",
    website: "tehnostroy.ru", phone: "+7 (812) 987-65-43", email: "contact@tehnostroy.ru",
    address: "г. Санкт-Петербург, пр. Невский, 88", inn: "7801234567",
    deals: { count: 1, status: "Согласование", amount: "780 000 ₽" },
    responsible: { name: "Владимир Синицын", avatar: av("ВС") },
    createdAt: "2024-06-20", description: "Строительная компания полного цикла.", employees: 85,
  },
  {
    id: "c3", name: "ЭкоФарм Плюс", logo: "ЭФ", type: "Лид", industry: "Фармацевтика",
    website: "ecofarm.ru", phone: "+7 (343) 111-22-33", email: "hello@ecofarm.ru",
    address: "г. Екатеринбург, ул. Мира, 15", inn: "6601234567",
    deals: { count: 0, status: "Новый", amount: "—" },
    responsible: { name: "Лейсан Шагинова", avatar: av("ЛШ") },
    createdAt: "2025-01-10", description: "Сеть аптек и фармацевтический дистрибьютор.", employees: 200,
  },
  {
    id: "c4", name: "АвтоЛогистик", logo: "АЛ", type: "Клиент", industry: "Логистика",
    website: "autologistic.ru", phone: "+7 (383) 444-55-66", email: "info@autologistic.ru",
    address: "г. Новосибирск, ул. Кирова, 33", inn: "5401234567",
    deals: { count: 2, status: "В работе", amount: "1 200 000 ₽" },
    responsible: { name: "Алиса Синицына", avatar: av("АС") },
    createdAt: "2024-09-05", description: "Транспортная компания, грузоперевозки по России.", employees: 350,
  },
  {
    id: "c5", name: "СпортМастер Про", logo: "СМ", type: "Партнёр", industry: "Спорт и фитнес",
    website: "sportmasterpro.ru", phone: "+7 (495) 777-88-99", email: "partner@sportmasterpro.ru",
    address: "г. Москва, ул. Спортивная, 7", inn: "7701987654",
    deals: { count: 1, status: "Закрыта", amount: "450 000 ₽" },
    responsible: { name: "Дмитрий Козлов", avatar: av("ДК") },
    createdAt: "2023-11-28", description: "Партнёр по реферальной программе, сеть фитнес-клубов.", employees: 500,
  },
];

export const EMPLOYEES: Employee[] = [
  { id: "e1", name: "Алиса Синицына", role: "SEO-специалист", department: "SEO отдел", email: "a.sinitsyna@statpulse.ru", phone: "+7 (903) 111-22-33", avatar: av("АС"), lastActive: "2025-04-07 09:15", status: "online" },
  { id: "e2", name: "Владимир Синицын", role: "Руководитель проектов", department: "Управление", email: "v.sinitsyn@statpulse.ru", phone: "+7 (903) 222-33-44", avatar: av("ВС"), lastActive: "2025-04-07 08:40", status: "online" },
  { id: "e3", name: "Лейсан Шагинова", role: "SEO-специалист", department: "SEO отдел", email: "l.shaginova@statpulse.ru", phone: "+7 (903) 333-44-55", avatar: av("ЛШ"), lastActive: "2025-04-06 18:20", status: "offline" },
  { id: "e4", name: "Дмитрий Козлов", role: "Аккаунт-менеджер", department: "Клиентский отдел", email: "d.kozlov@statpulse.ru", phone: "+7 (903) 444-55-66", avatar: av("ДК"), lastActive: "2025-04-07 09:00", status: "online" },
  { id: "e5", name: "Елена Петрова", role: "Контент-менеджер", department: "Контент", email: "e.petrova@statpulse.ru", phone: "+7 (903) 555-66-77", avatar: av("ЕП"), lastActive: "2025-04-07 07:30", status: "away" },
  { id: "e6", name: "Максим Иванов", role: "Линкбилдер", department: "SEO отдел", email: "m.ivanov@statpulse.ru", phone: "+7 (903) 666-77-88", avatar: av("МИ"), lastActive: "2025-04-05 15:10", status: "offline" },
  { id: "e7", name: "Наталья Волкова", role: "Аналитик", department: "Аналитика", email: "n.volkova@statpulse.ru", phone: "+7 (903) 777-88-99", avatar: av("НВ"), lastActive: "2025-04-07 09:10", status: "online" },
  { id: "e8", name: "Олег Романов", role: "Технический директор", department: "Управление", email: "o.romanov@statpulse.ru", phone: "+7 (903) 888-99-00", avatar: av("ОР"), lastActive: "2025-04-07 08:55", status: "online" },
];

export const CRM_TASKS: CrmTask[] = [
  {
    id: "t1", title: "Отчетный период 10: (7 Января – 7 Февраля)", stage: "Новые", stageColor: "hsl(200, 80%, 50%)", stageProgress: 20,
    deadline: "2026-02-09", overdue: true,
    creator: { name: "Владимир Синицын", avatar: av("ВС") },
    assignee: { name: "Лейсан Шагинова", avatar: av("ЛШ") },
    projectName: "vertex-pro.ru", priority: "high", tags: ["отчёт", "SEO"],
    chatMessages: [
      { id: "m1", author: "Владимир Синицын", avatar: av("ВС"), text: "Коллеги, подготовьте отчёт за январь-февраль. Включите данные по позициям и трафику.", date: "2026-01-14 12:38" },
      { id: "m2", author: "Лейсан Шагинова", avatar: av("ЛШ"), text: "Анализ Яндекс Вебмастера готов. Обнаружены фатальные ошибки: 5 проблем с безопасностью, ошибки DNS.", date: "2026-02-02 13:35" },
      { id: "m3", author: "Система", avatar: "", text: "Лейсан Шагинова, задача почти просрочена. Крайний срок 9 февраля 2026, 19:00", date: "2026-02-08 19:03", isSystem: true },
      { id: "m4", author: "Система", avatar: "", text: "Задача просрочена 9 февраля 2026, 19:00. Завершите её как можно скорее или измените крайний срок.", date: "2026-02-09 19:13", isSystem: true },
    ],
  },
  {
    id: "t2", title: "Создание страницы llm-info на основе ТЗ «Страница для LLM»", stage: "Новые", stageColor: "hsl(200, 80%, 50%)", stageProgress: 15,
    deadline: "2026-01-30", overdue: true,
    creator: { name: "Владимир Синицын", avatar: av("ВС") },
    assignee: { name: "Владимир Синицын", avatar: av("ВС") },
    projectName: "vertex-pro.ru", priority: "medium", tags: ["контент", "LLM"],
    chatMessages: [
      { id: "m5", author: "Владимир Синицын", avatar: av("ВС"), text: "Нужно создать посадочную страницу для LLM-оптимизации по ТЗ.", date: "2026-01-15 10:00" },
    ],
  },
  {
    id: "t3", title: "Технический аудит сайта kat-lubricants.ru", stage: "В работе", stageColor: "hsl(38, 92%, 50%)", stageProgress: 60,
    deadline: "2026-04-15", overdue: false,
    creator: { name: "Алиса Синицына", avatar: av("АС") },
    assignee: { name: "Алиса Синицына", avatar: av("АС") },
    projectName: "kat-lubricants.ru", priority: "high", tags: ["аудит", "техническое SEO"],
    chatMessages: [
      { id: "m6", author: "Алиса Синицына", avatar: av("АС"), text: "Начала аудит. Обнаружено 47 страниц с дублями Title.", date: "2026-04-01 09:30" },
      { id: "m7", author: "Алиса Синицына", avatar: av("АС"), text: "Проверка скорости загрузки: мобильная версия — 3.8с (нужно < 2.5с).", date: "2026-04-03 14:15" },
    ],
  },
  {
    id: "t4", title: "Закупка ссылок — пакет «Премиум»", stage: "Ждёт выполнения", stageColor: "hsl(280, 65%, 60%)", stageProgress: 40,
    deadline: "2026-04-20", overdue: false,
    creator: { name: "Владимир Синицын", avatar: av("ВС") },
    assignee: { name: "Максим Иванов", avatar: av("МИ") },
    projectName: "tehnostroy.ru", priority: "medium", tags: ["ссылки", "линкбилдинг"],
    chatMessages: [],
  },
  {
    id: "t5", title: "Анализ Google Search Console за Q1", stage: "Завершена", stageColor: "hsl(160, 84%, 39%)", stageProgress: 100,
    deadline: "2026-03-31", overdue: false,
    creator: { name: "Наталья Волкова", avatar: av("НВ") },
    assignee: { name: "Наталья Волкова", avatar: av("НВ") },
    projectName: "kat-lubricants.ru", priority: "low", tags: ["GSC", "аналитика"],
    chatMessages: [
      { id: "m8", author: "Наталья Волкова", avatar: av("НВ"), text: "Отчёт GSC за Q1 готов. Рост кликов +23%, показы +15%.", date: "2026-03-30 16:00" },
    ],
  },
  {
    id: "t6", title: "Внедрение правок по On-Page оптимизации", stage: "В работе", stageColor: "hsl(38, 92%, 50%)", stageProgress: 45,
    deadline: "2026-04-12", overdue: false,
    creator: { name: "Алиса Синицына", avatar: av("АС") },
    assignee: { name: "Елена Петрова", avatar: av("ЕП") },
    projectName: "autologistic.ru", priority: "high", tags: ["on-page", "контент"],
    chatMessages: [],
  },
];

export const CRM_PROJECTS: CrmProject[] = [
  {
    id: "p1", name: "РДР", domain: "rdr.ru", client: "РДР", trafficGrowth: 12,
    tasksTotal: 3, tasksCompleted: 3, leader: { name: "Владимир Синицын", avatar: av("ВС") },
    members: [{ name: "АС", avatar: av("АС") }, { name: "ЛШ", avatar: av("ЛШ") }, { name: "ДК", avatar: av("ДК") }],
    efficiency: 100, lastActivity: "2025-06-09 13:13", privacy: "Закрытый", role: "Помощник руководителя проекта",
  },
  {
    id: "p2", name: "vertex-pro.ru", domain: "vertex-pro.ru", client: "Vertex Pro", trafficGrowth: -5,
    tasksTotal: 35, tasksCompleted: 2, leader: { name: "Лейсан Шагинова", avatar: av("ЛШ") },
    members: [{ name: "ВС", avatar: av("ВС") }, { name: "ЛШ", avatar: av("ЛШ") }, { name: "АС", avatar: av("АС") }],
    efficiency: 0, lastActivity: "2025-02-02 13:47", privacy: "Открытый", role: "Участник проекта",
  },
  {
    id: "p3", name: "tulpech.ru", domain: "tulpech.ru", client: "ТулПеч", trafficGrowth: 34,
    tasksTotal: 51, tasksCompleted: 4, leader: { name: "Алиса Синицына", avatar: av("АС") },
    members: [{ name: "АС", avatar: av("АС") }, { name: "ЕП", avatar: av("ЕП") }, { name: "МИ", avatar: av("МИ") }],
    efficiency: 100, lastActivity: "2025-02-18 12:21", privacy: "Закрытый", role: "Участник проекта",
  },
  {
    id: "p4", name: "stroitim.ru", domain: "stroitim.ru", client: "СтройТим", trafficGrowth: 8,
    tasksTotal: 89, tasksCompleted: 3, leader: { name: "Владимир Синицын", avatar: av("ВС") },
    members: [{ name: "ВС", avatar: av("ВС") }, { name: "НВ", avatar: av("НВ") }, { name: "ОР", avatar: av("ОР") }],
    efficiency: 50, lastActivity: "2025-04-02 11:58", privacy: "Закрытый", role: "Руководитель проекта",
  },
  {
    id: "p5", name: "stickerdo.ru", domain: "stickerdo.ru", client: "СтикерДо", trafficGrowth: 21,
    tasksTotal: 79, tasksCompleted: 17, leader: { name: "Дмитрий Козлов", avatar: av("ДК") },
    members: [{ name: "ДК", avatar: av("ДК") }, { name: "АС", avatar: av("АС") }, { name: "ЛШ", avatar: av("ЛШ") }],
    efficiency: 0, lastActivity: "2025-03-25 12:12", privacy: "Закрытый", role: "Руководитель проекта",
  },
];

export const WORKSPACE_COLORS = [
  { name: "Индиго", hsl: "239 84% 67%" },
  { name: "Изумруд", hsl: "160 84% 39%" },
  { name: "Янтарь", hsl: "38 92% 50%" },
  { name: "Роза", hsl: "340 70% 52%" },
  { name: "Бирюза", hsl: "190 80% 42%" },
];
