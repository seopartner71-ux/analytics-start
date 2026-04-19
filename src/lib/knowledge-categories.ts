export const KNOWLEDGE_CATEGORIES = [
  { value: "tech_seo", label: "Технический SEO", icon: "🔧" },
  { value: "content", label: "Контент и тексты", icon: "📝" },
  { value: "links", label: "Ссылочное продвижение", icon: "🔗" },
  { value: "analytics", label: "Аналитика и отчёты", icon: "📊" },
  { value: "clients", label: "Работа с клиентами", icon: "👥" },
  { value: "tools", label: "Инструменты и сервисы", icon: "⚙️" },
  { value: "standards", label: "Стандарты компании", icon: "📋" },
  { value: "onboarding", label: "Онбординг", icon: "🚀" },
] as const;

export type KnowledgeCategoryValue = typeof KNOWLEDGE_CATEGORIES[number]["value"];

export const getCategoryMeta = (value: string) =>
  KNOWLEDGE_CATEGORIES.find((c) => c.value === value) ?? KNOWLEDGE_CATEGORIES[0];
