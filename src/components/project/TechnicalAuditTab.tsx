import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Download, ExternalLink, ShieldAlert, Link2, FileSearch, CheckCircle2, AlertTriangle, Info, AlertCircle, HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ============ Описания проверок (для tooltip) ============
type CheckInfo = { description: string; importance: "Критическая" | "Высокая" | "Средняя" | "Низкая" };
const CHECK_INFO: Record<string, CheckInfo> = {
  // Технические
  no_https: { importance: "Высокая", description: "Сайт не использует HTTPS. HTTPS защищает данные пользователей и является фактором ранжирования в Google и Яндекс. Сайты без HTTPS помечаются браузером как небезопасные." },
  no_http_to_https_redirect: { importance: "Средняя", description: "HTTP не перенаправляет на HTTPS. Пользователи и роботы могут попасть на незащищённую версию сайта. Настройте 301 редирект с HTTP на HTTPS." },
  redirect_chain: { importance: "Средняя", description: "Длинная цепочка редиректов. Цепочки редиректов замедляют загрузку страниц и теряют ссылочный вес. Рекомендуется прямой редирект в 1 шаг." },
  no_robots_txt: { importance: "Высокая", description: "Нет файла robots.txt. Файл robots.txt управляет индексацией сайта поисковыми роботами. Без него роботы могут индексировать служебные страницы." },
  robots_blocks_all: { importance: "Критическая", description: "robots.txt блокирует весь сайт. Директива Disallow: / запрещает индексацию всего сайта. Поисковые роботы не смогут проиндексировать ни одну страницу." },
  no_sitemap: { importance: "Высокая", description: "Нет файла sitemap.xml. XML-карта сайта помогает поисковым системам быстрее находить и индексировать все страницы сайта." },
  sitemap_invalid: { importance: "Средняя", description: "Некорректный sitemap.xml. Ошибки в карте сайта мешают поисковым роботам корректно обходить страницы." },
  missing_canonical: { importance: "Высокая", description: "Отсутствует тег canonical. Canonical указывает поисковикам основную версию страницы и помогает избежать проблем с дублями контента." },
  canonical_mismatch: { importance: "Средняя", description: "Canonical не совпадает с URL страницы. Если canonical указывает на другой URL — поисковик будет индексировать тот URL, а не текущую страницу." },
  slow_ttfb: { importance: "Высокая", description: "Медленный ответ сервера. TTFB более 3 секунд негативно влияет на поведенческие факторы и ранжирование. Google использует скорость загрузки как фактор ранжирования." },
  medium_ttfb: { importance: "Средняя", description: "Замедленный ответ сервера (>1.5 сек). Высокий TTFB ухудшает Core Web Vitals и пользовательский опыт." },
  no_gzip: { importance: "Средняя", description: "Нет сжатия gzip/brotli. Сжатие уменьшает размер страниц в 3-10 раз и ускоряет загрузку для пользователей." },
  noindex_meta: { importance: "Критическая", description: "Страница закрыта от индексации. Тег noindex запрещает поисковикам индексировать страницу. Убедитесь что важные страницы не закрыты случайно." },
  nofollow_meta: { importance: "Средняя", description: "Все ссылки на странице закрыты nofollow. Поисковые роботы не передают вес по таким ссылкам и могут не обойти внутренние страницы." },
  status_404: { importance: "Высокая", description: "Страницы с ошибкой 404. Битые ссылки ухудшают пользовательский опыт и расходуют краулинговый бюджет поисковых роботов." },
  status_500: { importance: "Высокая", description: "Страницы с ошибкой 500. Ошибка сервера означает что страница недоступна. Роботы исключат такие страницы из индекса если ошибка не исправлена в течение суток." },
  crawl_error: { importance: "Высокая", description: "Ошибка при сканировании страницы. Краулер не смог получить корректный ответ — проверьте доступность и стабильность сервера." },
  // Ссылки и контент
  http_link: { importance: "Высокая", description: "Внутренние ссылки с HTTP. Если сайт работает на HTTPS но внутренние ссылки ведут на HTTP — это создаёт лишние редиректы, замедляет загрузку и теряет ссылочный вес." },
  redirect_301: { importance: "Средняя", description: "Внутренние ссылки ведут на 301 редирект. Замените их на конечные URL чтобы не терять ссылочный вес и ускорить переходы." },
  external_link: { importance: "Средняя", description: "Исходящие внешние ссылки. Внешние ссылки с коммерческих страниц могут уводить пользователей. Используйте rel=nofollow для ссылок на сторонние ресурсы." },
  broken_link: { importance: "Высокая", description: "Битые внутренние ссылки. Ссылки ведущие на несуществующие страницы ухудшают пользовательский опыт и расходуют краулинговый бюджет." },
  // Парсер
  missing_h1: { importance: "Высокая", description: "Страницы без заголовка H1. H1 — главный заголовок страницы. Без него поисковики хуже понимают тематику страницы и её ключевые слова." },
  multiple_h1: { importance: "Высокая", description: "Несколько H1 на странице. На каждой странице должен быть только один H1. Несколько H1 путают поисковых роботов при определении главной темы страницы." },
  duplicate_h1: { importance: "Высокая", description: "Дубли страниц по H1. Одинаковые заголовки H1 на разных страницах снижают уникальность и мешают поисковикам определить какая страница важнее." },
  missing_title: { importance: "Высокая", description: "Страницы без тега title. Title — один из главных факторов SEO. Отображается в результатах поиска как кликабельный заголовок. Без него поисковик сам придумает заголовок." },
  multiple_title: { importance: "Средняя", description: "Несколько тегов title на странице. Поисковики возьмут первый, остальные будут проигнорированы — это признак ошибки в шаблоне." },
  duplicate_title: { importance: "Высокая", description: "Дубли страниц по title. Одинаковые title на разных страницах снижают релевантность и CTR в поисковой выдаче." },
  title_too_long: { importance: "Средняя", description: "Title слишком длинный. Title длиннее 70 символов обрезается в результатах поиска. Оптимальная длина 50-70 символов." },
  title_too_short: { importance: "Средняя", description: "Title слишком короткий. Title короче 30 символов не использует весь потенциал для ключевых слов и менее информативен для пользователей." },
  title_equals_h1: { importance: "Средняя", description: "Title дублирует H1. Когда title и H1 одинаковы — упускается возможность использовать разные ключевые слова. Рекомендуется делать их похожими но не идентичными." },
  missing_description: { importance: "Высокая", description: "Страницы без meta description. Description влияет на CTR в поисковой выдаче. Без него поисковик сам выберет текст для сниппета — часто неудачно." },
  multiple_description: { importance: "Средняя", description: "Несколько meta description на странице. Поисковик возьмёт первый, остальные проигнорируются — это ошибка шаблона." },
  duplicate_description: { importance: "Высокая", description: "Дубли страниц по description. Одинаковые описания на разных страницах снижают уникальность и CTR." },
  description_too_long: { importance: "Средняя", description: "Description слишком длинный. Description длиннее 160 символов обрезается в результатах поиска. Оптимальная длина 120-160 символов." },
  missing_alt: { importance: "Средняя", description: "Картинки без атрибута alt. Alt-текст помогает поисковикам понять содержание изображения. Также важен для доступности сайта для людей с нарушениями зрения." },
  heavy_image: { importance: "Средняя", description: "Тяжёлые изображения (>200kb). Большие картинки замедляют загрузку страниц и ухудшают Core Web Vitals. Используйте сжатие и форматы WebP/AVIF." },
  empty_page: { importance: "Средняя", description: "Страницы с малым количеством контента. Страницы с менее 50 словами считаются пустыми. Поисковики расценивают их как малополезные и занижают в выдаче." },
};
const IMPORTANCE_CLS: Record<string, string> = {
  "Критическая": "text-red-400",
  "Высокая": "text-orange-400",
  "Средняя": "text-yellow-400",
  "Низкая": "text-blue-400",
};
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Props { projectId: string; }

// ============ КАТАЛОГ ПРОВЕРОК ============
type CheckDef = { code: string; label: string; severity: "critical" | "warning" | "info" };
type SectionDef = { id: string; title: string; types: string[]; checks: CheckDef[]; icon: any; description: string };

const SECTIONS: SectionDef[] = [
  {
    id: "technical",
    title: "Технические ошибки",
    description: "HTTPS, robots.txt, sitemap, скорость ответа сервера",
    icon: ShieldAlert,
    types: ["technical"],
    checks: [
      { code: "no_https", label: "Сайт не использует HTTPS", severity: "critical" },
      { code: "robots_blocks_all", label: "robots.txt блокирует весь сайт", severity: "critical" },
      { code: "slow_ttfb", label: "Медленный ответ сервера (>3 сек)", severity: "critical" },
      { code: "noindex_meta", label: "Страница закрыта от индексации", severity: "critical" },
      { code: "status_404", label: "Страницы с ошибкой 404", severity: "critical" },
      { code: "status_500", label: "Страницы с ошибкой 500", severity: "critical" },
      { code: "crawl_error", label: "Ошибка при сканировании", severity: "critical" },
      { code: "no_http_to_https_redirect", label: "HTTP не редиректит на HTTPS", severity: "warning" },
      { code: "redirect_chain", label: "Длинная цепочка редиректов", severity: "warning" },
      { code: "no_robots_txt", label: "Нет файла robots.txt", severity: "warning" },
      { code: "no_sitemap", label: "Нет sitemap.xml", severity: "warning" },
      { code: "sitemap_invalid", label: "Некорректный sitemap.xml", severity: "warning" },
      { code: "missing_canonical", label: "Отсутствует canonical", severity: "warning" },
      { code: "medium_ttfb", label: "Замедленный ответ сервера (>1.5 сек)", severity: "warning" },
      { code: "no_gzip", label: "Нет сжатия gzip/brotli", severity: "warning" },
      { code: "nofollow_meta", label: "Все ссылки закрыты nofollow", severity: "warning" },
      { code: "canonical_mismatch", label: "Canonical не совпадает с URL", severity: "info" },
    ],
  },
  {
    id: "links",
    title: "Ссылки и контент",
    description: "Внутренние и внешние ссылки, редиректы, битые URL",
    icon: Link2,
    types: ["links"],
    checks: [
      { code: "broken_link", label: "Битые внутренние ссылки", severity: "critical" },
      { code: "http_link", label: "Ссылки с HTTP на HTTPS сайте", severity: "warning" },
      { code: "redirect_301", label: "Внутренние ссылки ведут на редирект 301", severity: "warning" },
      { code: "external_link", label: "Исходящие внешние ссылки", severity: "info" },
    ],
  },
  {
    id: "onpage",
    title: "Ошибки парсера",
    description: "Title, description, H1, изображения и контент страниц",
    icon: FileSearch,
    types: ["onpage", "media"],
    checks: [
      { code: "missing_h1", label: "Страницы без H1", severity: "critical" },
      { code: "missing_title", label: "Страницы без title", severity: "critical" },
      { code: "multiple_h1", label: "Страницы с несколькими H1", severity: "warning" },
      { code: "duplicate_h1", label: "Дубли страниц по H1", severity: "warning" },
      { code: "multiple_title", label: "Страницы с несколькими title", severity: "warning" },
      { code: "duplicate_title", label: "Дубли страниц по title", severity: "warning" },
      { code: "title_too_long", label: "Title слишком длинный (>70 симв)", severity: "warning" },
      { code: "title_too_short", label: "Title слишком короткий (<30 симв)", severity: "warning" },
      { code: "title_equals_h1", label: "Title дублирует H1", severity: "warning" },
      { code: "missing_description", label: "Страницы без description", severity: "warning" },
      { code: "multiple_description", label: "Несколько description на странице", severity: "warning" },
      { code: "duplicate_description", label: "Дубли страниц по description", severity: "warning" },
      { code: "description_too_long", label: "Description слишком длинный (>160 симв)", severity: "warning" },
      { code: "missing_alt", label: "Картинки без alt", severity: "warning" },
      { code: "heavy_image", label: "Тяжёлые изображения (>200kb)", severity: "warning" },
      { code: "empty_page", label: "Пустые страницы (<50 слов)", severity: "warning" },
    ],
  },
];

// Коды, для которых при раскрытии показываем дополнительный текст из details (title/description/h1)
const TEXT_DETAIL_CODES = new Set([
  "title_too_long", "title_too_short", "title_equals_h1", "duplicate_title", "multiple_title",
  "description_too_long", "duplicate_description", "multiple_description",
  "duplicate_h1", "multiple_h1",
]);

// Какое поле details содержит сам текст для конкретного кода
function getDetailText(code: string, details: any): { text: string; len?: number } | null {
  if (!details || typeof details !== "object") return null;
  const candidates = ["title", "description", "h1", "text", "value", "content"];
  for (const k of candidates) {
    if (typeof details[k] === "string" && details[k]) {
      return { text: details[k], len: typeof details.length === "number" ? details.length : details[k].length };
    }
  }
  return null;
}

const SEV_CLS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};
const SEV_LABEL: Record<string, string> = {
  critical: "Критическая",
  warning: "Предупреждение",
  info: "Информация",
};
const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function getDomain(url?: string | null): string {
  if (!url) return "—";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; }
  catch { return url.replace(/^https?:\/\//, "").split("/")[0] || "—"; }
}

function extractUrl(issue: any): string | null {
  const fromPage = issue?.crawl_pages?.url;
  if (fromPage) return fromPage;
  const d = issue?.details;
  if (d && typeof d === "object") {
    if (typeof d.url === "string" && d.url) return d.url;
    if (typeof d.page_url === "string" && d.page_url) return d.page_url;
  }
  const msg: string | undefined = issue?.message;
  if (msg) {
    const m = msg.match(/(https?:\/\/\S+)/);
    if (m) return m[1];
  }
  return null;
}

function pageWord(n: number) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "страница";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "страницы";
  return "страниц";
}

// ============ Стили severity ============
const SEV_LEFT_BORDER: Record<string, string> = {
  critical: "border-l-4 border-l-red-500",
  warning: "border-l-4 border-l-yellow-500",
  info: "border-l-4 border-l-blue-500",
  ok: "border-l-4 border-l-emerald-500",
};
const SEV_ROW_BG: Record<string, string> = {
  critical: "bg-red-500/[0.04] hover:bg-red-500/[0.08]",
  warning: "bg-yellow-500/[0.04] hover:bg-yellow-500/[0.08]",
  info: "bg-blue-500/[0.04] hover:bg-blue-500/[0.08]",
  ok: "bg-emerald-500/[0.04]",
};
const SEV_ICON: Record<string, any> = {
  critical: AlertCircle,
  warning: AlertTriangle,
  info: Info,
  ok: CheckCircle2,
};
const SEV_ICON_COLOR: Record<string, string> = {
  critical: "text-red-400",
  warning: "text-yellow-400",
  info: "text-blue-400",
  ok: "text-emerald-400",
};

// ============ СЕКЦИЯ ============
function AuditSection({
  section,
  issues,
  baseUrl,
  defaultOpen,
}: {
  section: SectionDef;
  issues: any[];
  baseUrl?: string | null;
  defaultOpen?: boolean;
}) {
  const [sectionOpen, setSectionOpen] = useState<boolean>(!!defaultOpen);
  const [rowOpen, setRowOpen] = useState<Record<string, boolean>>({});

  const origin = (() => {
    try { return baseUrl ? new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`).origin : null; }
    catch { return null; }
  })();

  // Группируем найденные issues этой секции по code (сохраняем сами issues для деталей)
  const sectionIssues = (issues ?? []).filter((i) => section.types.includes(i.type));
  type Group = { items: { url: string | null; details: any }[]; total: number; severity: string };
  const groupMap = new Map<string, Group>();
  for (const i of sectionIssues) {
    const code = i.code || "unknown";
    let g = groupMap.get(code);
    if (!g) { g = { items: [], total: 0, severity: i.severity || "info" }; groupMap.set(code, g); }
    g.total += 1;
    let url = extractUrl(i);
    if (url && url.startsWith("/") && origin) url = origin + url;
    g.items.push({ url, details: i.details });
    if ((SEV_ORDER[i.severity] ?? 9) < (SEV_ORDER[g.severity] ?? 9)) g.severity = i.severity;
  }

  const catalogCodes = new Set(section.checks.map((c) => c.code));
  const extraCodes = Array.from(groupMap.keys()).filter((c) => !catalogCodes.has(c));
  const rows = [
    ...section.checks.map((c) => ({
      code: c.code,
      label: c.label,
      severity: groupMap.get(c.code)?.severity ?? c.severity,
      group: groupMap.get(c.code),
    })),
    ...extraCodes.map((code) => ({
      code, label: code, severity: groupMap.get(code)!.severity, group: groupMap.get(code),
    })),
  ];

  rows.sort((a, b) => {
    const aHas = !!a.group, bHas = !!b.group;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
  });

  const problemCount = rows.filter((r) => !!r.group).length;
  const hasCritical = rows.some((r) => !!r.group && r.severity === "critical");
  const hasWarning = rows.some((r) => !!r.group && r.severity === "warning");

  // Цвет счётчика секции
  const counterCls = problemCount === 0
    ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30"
    : hasCritical
      ? "bg-red-500/15 text-red-400 border-red-500/30"
      : hasWarning
        ? "bg-yellow-500/15 text-yellow-400 border-yellow-500/30"
        : "bg-blue-500/15 text-blue-400 border-blue-500/30";

  const SectionIcon = section.icon;
  const sectionLeftBorder = problemCount === 0
    ? "border-l-4 border-l-emerald-500"
    : hasCritical
      ? "border-l-4 border-l-red-500"
      : hasWarning
        ? "border-l-4 border-l-yellow-500"
        : "border-l-4 border-l-blue-500";

  return (
    <Card className={cn("bg-[#252525] border-[#333] overflow-hidden", sectionLeftBorder)}>
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-[#2a2a2a] transition-colors text-left"
      >
        <div className={cn(
          "h-9 w-9 rounded-lg flex items-center justify-center shrink-0",
          problemCount === 0 ? "bg-emerald-500/15" : hasCritical ? "bg-red-500/15" : hasWarning ? "bg-yellow-500/15" : "bg-blue-500/15"
        )}>
          <SectionIcon className={cn(
            "h-5 w-5",
            problemCount === 0 ? "text-emerald-400" : hasCritical ? "text-red-400" : hasWarning ? "text-yellow-400" : "text-blue-400"
          )} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-[14px] font-semibold text-zinc-100">{section.title}</h3>
          <p className="text-[11px] text-zinc-500 truncate">{section.description}</p>
        </div>
        <Badge className={cn("text-[11px] border", counterCls)}>
          {problemCount === 0 ? "Ошибок нет" : `Найдено: ${problemCount}`}
        </Badge>
        {sectionOpen
          ? <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" />
          : <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />}
      </button>

      {sectionOpen && (
        <div className="border-t border-[#333] divide-y divide-[#2a2a2a]">
          {rows.map((r) => {
            const isOpen = !!rowOpen[r.code];
            const has = !!r.group;
            const items = r.group ? r.group.items : [];
            const uniqueUrls = Array.from(new Set(items.map((it) => it.url).filter(Boolean) as string[]));
            const pages = uniqueUrls.length || r.group?.total || 0;
            const sevKey = has ? r.severity : "ok";
            const SevIcon = SEV_ICON[sevKey];
            const showText = TEXT_DETAIL_CODES.has(r.code);
            const isDuplicateCode = r.code === "duplicate_title" || r.code === "duplicate_h1" || r.code === "duplicate_description";
            const duplicateValue = isDuplicateCode && has
              ? (items.find((it) => it.details && typeof it.details === "object" && (it.details as any).duplicate_value)?.details as any)?.duplicate_value
              : null;

            return (
              <div key={r.code} className={cn(SEV_LEFT_BORDER[sevKey])}>
                <button
                  type="button"
                  disabled={!has}
                  onClick={() => has && setRowOpen((p) => ({ ...p, [r.code]: !p[r.code] }))}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    has ? cn("cursor-pointer", SEV_ROW_BG[sevKey]) : cn("cursor-default", SEV_ROW_BG.ok)
                  )}
                >
                  <SevIcon className={cn("h-4 w-4 shrink-0", SEV_ICON_COLOR[sevKey])} />
                  <span className={cn("flex-1 min-w-0", has ? "text-zinc-200" : "text-zinc-400")}>
                    <span className="flex items-center gap-1.5 text-[13px] min-w-0">
                      <span className="truncate">{r.label}</span>
                      {CHECK_INFO[r.code] && (
                        <TooltipProvider delayDuration={150}>
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span
                                role="button"
                                tabIndex={0}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex shrink-0 text-zinc-500 hover:text-zinc-300 transition-colors cursor-help"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[320px] text-[12px] leading-relaxed">
                              <div className="space-y-1.5">
                                <div className="font-semibold text-zinc-900">{r.label}</div>
                                <div className="text-zinc-700">{CHECK_INFO[r.code].description}</div>
                                <div className="pt-1 border-t border-zinc-200">
                                  <span className="text-zinc-500">Важность: </span>
                                  <span className={cn("font-semibold", IMPORTANCE_CLS[CHECK_INFO[r.code].importance])}>
                                    {CHECK_INFO[r.code].importance}
                                  </span>
                                </div>
                              </div>
                            </TooltipContent>
                          </Tooltip>
                        </TooltipProvider>
                      )}
                    </span>
                    {duplicateValue && (
                      <span className="block text-[11px] italic text-zinc-500 truncate mt-0.5">
                        {String(duplicateValue)}
                      </span>
                    )}
                  </span>
                  {has ? (
                    <>
                      <Badge className="bg-zinc-700/70 text-zinc-300 text-[11px] shrink-0 border-0">
                        {pages} {pageWord(pages)}
                      </Badge>
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0", SEV_CLS[r.severity] ?? SEV_CLS.info)}>
                        {SEV_LABEL[r.severity] ?? r.severity}
                      </span>
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />}
                    </>
                  ) : (
                    <span className="text-[11px] text-emerald-400 shrink-0">Ошибок нет</span>
                  )}
                </button>
                {has && isOpen && (
                  <div className="px-4 py-3 pl-11 space-y-2 bg-[#181818]">
                    {items.length === 0 ? (
                      <div className="text-[11px] text-zinc-500">URL не переданы краулером</div>
                    ) : (
                      items.slice(0, 100).map((it, i) => {
                        const detail = showText ? getDetailText(r.code, it.details) : null;
                        return (
                          <div key={i} className="space-y-1 border-b border-[#222] last:border-0 pb-2 last:pb-0">
                            {it.url ? (
                              <a
                                href={it.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-1.5 text-[12px] text-blue-400 hover:text-blue-300 hover:underline font-mono"
                              >
                                <ExternalLink className="h-3 w-3 shrink-0" />
                                <span className="truncate">{it.url}</span>
                              </a>
                            ) : (
                              <div className="text-[11px] text-zinc-500">URL не указан</div>
                            )}
                            {detail && (
                              <div className="ml-5 rounded bg-[#0f0f0f] border border-[#262626] px-2.5 py-1.5">
                                <div className="text-[10px] text-zinc-500 uppercase tracking-wide mb-0.5">
                                  Текст {detail.len != null && <span className="text-zinc-600">· {detail.len} симв.</span>}
                                </div>
                                <div className="text-[12px] text-zinc-300 break-words">{detail.text}</div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    {items.length > 100 && (
                      <div className="text-[11px] text-zinc-500 pt-1">…и ещё {items.length - 100} записей</div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

// ============ ОСНОВНОЙ КОМПОНЕНТ ============
export function TechnicalAuditTab({ projectId }: Props) {
  const [scanStatus, setScanStatus] = useState<"idle" | "pending" | "running" | "done" | "error">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showSfPanel, setShowSfPanel] = useState(false);
  const channelRef = useRef<any>(null);

  const { data: project } = useQuery({
    queryKey: ["project-detail-audit", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      return data;
    },
  });

  const { data: specialist } = useQuery({
    queryKey: ["specialist-audit", project?.seo_specialist_id],
    enabled: !!project?.seo_specialist_id,
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("full_name").eq("id", project!.seo_specialist_id!).single();
      return data;
    },
  });

  const domain = getDomain(project?.url);

  // Восстановить последний job для проекта
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("crawl_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setJobId(data.id);
        setScanStatus(data.status as any);
        setScanProgress(data.progress ?? 0);
        if (data.status !== "idle") setShowSfPanel(true);
      }
    })();
  }, [projectId]);

  const { data: jobStats } = useQuery({
    queryKey: ["crawl-stats", jobId],
    enabled: !!jobId && scanStatus === "done",
    queryFn: async () => {
      const { data } = await supabase.from("crawl_stats").select("*").eq("job_id", jobId!).maybeSingle();
      return data;
    },
  });

  const { data: jobIssues = [] } = useQuery({
    queryKey: ["crawl-issues-all", jobId],
    enabled: !!jobId && scanStatus === "done",
    queryFn: async () => {
      const { data } = await supabase
        .from("crawl_issues")
        .select("id, type, severity, code, message, page_id, details, crawl_pages(url)")
        .eq("job_id", jobId!);
      return (data ?? []) as any[];
    },
  });

  const effectiveStats: any = stats ?? jobStats;

  const handleStartScan = async () => {
    setShowSfPanel(true);
    setScanProgress(0);
    setStats(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { toast.error("Войдите в систему"); return; }
    const targetUrl = project?.url || (domain !== "—" ? `https://${domain}` : "");
    if (!targetUrl) { toast.error("У проекта не указан URL"); return; }

    const { data: job, error } = await supabase
      .from("crawl_jobs")
      .insert({ project_id: projectId, user_id: userData.user.id, url: targetUrl, status: "pending", progress: 0 })
      .select()
      .single();
    if (error || !job) { toast.error("Не удалось создать задание: " + (error?.message ?? "")); return; }
    setJobId(job.id);
    setScanStatus("pending");
    toast.success("Задание создано — ожидает запуска краулера");
  };

  // Realtime подписка на job/stats
  useEffect(() => {
    if (!jobId) return;
    const ch = supabase
      .channel(`crawl-job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crawl_jobs", filter: `id=eq.${jobId}` }, (payload: any) => {
        const row = payload.new;
        setScanStatus(row.status);
        setScanProgress(row.progress ?? 0);
        if (row.status === "done") toast.success("Аудит завершён");
        if (row.status === "error") toast.error("Ошибка аудита: " + (row.error_message ?? ""));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crawl_stats", filter: `job_id=eq.${jobId}` }, (payload: any) => {
        setStats(payload.new);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [jobId]);

  return (
    <div className="space-y-5">
      {/* Шапка */}
      <Card className="bg-[#252525] border-[#333] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-zinc-100">Технический аудит</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-zinc-400">
              <span>Сайт: <span className="text-zinc-200 font-medium">{domain}</span></span>
              <span>Дата аудита: <span className="text-zinc-200">{format(new Date(), "dd.MM.yyyy")}</span></span>
              <span>Подготовил: <span className="text-zinc-200">{specialist?.full_name || project?.seo_specialist || "—"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {scanStatus === "idle" && <Badge className="bg-zinc-700 text-zinc-400">Ожидает запуска</Badge>}
            {scanStatus === "pending" && <Badge className="bg-blue-500/20 text-blue-400">В очереди</Badge>}
            {scanStatus === "running" && <Badge className="bg-yellow-500/20 text-yellow-400 animate-pulse">Сканирование...</Badge>}
            {scanStatus === "done" && <Badge className="bg-emerald-500/20 text-emerald-400">Готов</Badge>}
            {scanStatus === "error" && <Badge className="bg-red-500/20 text-red-400">Ошибка</Badge>}
            <Button variant="outline" size="sm" className="gap-1.5 text-[12px] border-[#444] text-zinc-300 hover:bg-[#333]">
              <Download className="h-3.5 w-3.5" /> Скачать PDF отчёт
            </Button>
            <Button size="sm" className="gap-1.5 text-[12px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0" onClick={handleStartScan}>
              🔍 Запустить аудит
            </Button>
          </div>
        </div>
      </Card>

      {/* Панель прогресса */}
      {showSfPanel && (
        <Card className="bg-[#252525] border-[#333] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-zinc-200">🤖 Python краулер — Сканирование</span>
            <Button variant="ghost" size="sm" className="text-zinc-500 text-[11px]" onClick={() => setShowSfPanel(false)}>Скрыть</Button>
          </div>
          <div className="flex items-center gap-3">
            <Input value={domain !== "—" ? `https://${domain}` : ""} readOnly className="bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] max-w-xs" />
            <span className="text-[11px] text-zinc-500">Время сканирования: 5–15 минут для сайтов до 500 страниц</span>
          </div>
          {(scanStatus === "pending" || scanStatus === "running") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
                  {scanStatus === "running" ? "Идёт сканирование..." : "В очереди..."}
                </span>
                <span>{Math.round(scanProgress)}%</span>
              </div>
              <Progress value={Math.min(scanProgress, 100)} className="h-2 bg-[#333]" />
            </div>
          )}
          {scanStatus === "error" && (
            <div className="text-[12px] text-red-400">Произошла ошибка при сканировании</div>
          )}
        </Card>
      )}

      {/* Карточки статистики */}
      {scanStatus === "done" && effectiveStats && (
        <Card className="bg-[#252525] border-[#333] p-4 space-y-2">
          <div className="text-[13px] font-semibold text-zinc-200">Результаты сканирования</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Всего страниц</div><div className="text-[18px] font-bold text-zinc-100">{effectiveStats.total_pages}</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Критических</div><div className="text-[18px] font-bold text-red-400">{effectiveStats.critical_count}</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Предупреждений</div><div className="text-[18px] font-bold text-yellow-400">{effectiveStats.warning_count}</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Средний TTFB</div><div className="text-[18px] font-bold text-zinc-100">{effectiveStats.avg_load_time_ms} мс</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Оценка сайта</div><div className="text-[18px] font-bold text-emerald-400">{effectiveStats.score}/100</div></div>
          </div>
        </Card>
      )}

      {/* 3 раздела с проверками */}
      {scanStatus === "done" && (
        <div className="space-y-3">
          {SECTIONS.map((s, idx) => (
            <AuditSection
              key={s.id}
              section={s}
              issues={jobIssues}
              baseUrl={project?.url}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
      )}

      {scanStatus !== "done" && !showSfPanel && (
        <Card className="bg-[#252525] border-[#333] p-8 text-center">
          <div className="text-[14px] text-zinc-400">Запустите аудит, чтобы получить технический анализ сайта</div>
        </Card>
      )}
    </div>
  );
}

export default TechnicalAuditTab;
