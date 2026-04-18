import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Download, ExternalLink, ShieldAlert, Link2, FileSearch, CheckCircle2, AlertTriangle, Info, AlertCircle, HelpCircle, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { PageSpeedBlock } from "./PageSpeedBlock";

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
  mixed_content: { importance: "Высокая", description: "На HTTPS странице загружаются ресурсы по HTTP (картинки, скрипты, стили). Браузеры блокируют такие ресурсы и показывают предупреждение о небезопасном соединении." },
  no_last_modified: { importance: "Средняя", description: "Заголовок Last-Modified сообщает поисковым роботам когда страница была изменена. Без него роботы не знают нужно ли переиндексировать страницу." },
  cyclic_link: { importance: "Средняя", description: "Страница содержит ссылку на саму себя. Циклические ссылки путают пользователей и тратят краулинговый бюджет поисковых роботов." },
  ssl_expiring_soon: { importance: "Критическая", description: "SSL сертификат истекает в ближайшее время. После истечения сайт будет помечен браузером как небезопасный и выпадет из поиска." },
  ssl_error: { importance: "Критическая", description: "Ошибка SSL сертификата. Браузеры блокируют доступ к сайту с некорректным сертификатом — пользователи и поисковые роботы не смогут открыть страницы." },
  deep_page: { importance: "Средняя", description: "Страница находится слишком глубоко в структуре сайта (более 4 кликов от главной). Глубокие страницы хуже индексируются и получают меньше веса." },
  orphan_page: { importance: "Высокая", description: "Orphan-страница — на неё нет внутренних ссылок с других страниц сайта. Поисковые роботы могут её не найти, а пользователи не смогут до неё дойти по навигации." },
  hreflang_no_default: { importance: "Средняя", description: "Hreflang-разметка без x-default. Тег x-default указывает версию страницы по умолчанию для пользователей из стран, не указанных в hreflang." },
  hreflang_duplicate: { importance: "Средняя", description: "Дублирующиеся hreflang-теги для одного языка/региона. Поисковики могут проигнорировать всю hreflang-разметку при наличии дублей." },
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
  missing_h2: { importance: "Средняя", description: "Страницы без заголовка H2. H2 структурируют контент и помогают поисковикам понять разделы страницы. Без подзаголовков страница хуже воспринимается и пользователями, и роботами." },
  heading_hierarchy: { importance: "Средняя", description: "Нарушена иерархия заголовков (например, H3 идёт сразу после H1, минуя H2). Корректная иерархия H1→H2→H3 важна для SEO и доступности сайта." },
  page_too_large: { importance: "Средняя", description: "Большой размер HTML-страницы (более 200kb). Тяжёлые страницы дольше загружаются, ухудшают Core Web Vitals и расходуют краулинговый бюджет." },
  // Аналитика
  no_yandex_metrika: { importance: "Высокая", description: "Яндекс Метрика не найдена. Без счётчика невозможно отслеживать трафик, поведение пользователей и конверсии." },
  no_google_analytics: { importance: "Высокая", description: "Google Analytics не найден. Необходим для отслеживания трафика из Google и анализа поведения пользователей." },
  duplicate_metrika: { importance: "Средняя", description: "Дубль счётчика Яндекс Метрики. Несколько счётчиков на одной странице искажают статистику посещений и поведенческие метрики." },
  duplicate_ga: { importance: "Средняя", description: "Дубль счётчика Google Analytics. Несколько счётчиков на одной странице задваивают данные и искажают аналитику." },
  // Структурированные данные
  no_schema_jsonld: { importance: "Средняя", description: "Schema.org разметка помогает поисковикам лучше понять содержимое страницы и показывать расширенные сниппеты в выдаче." },
  invalid_schema_jsonld: { importance: "Высокая", description: "Некорректный JSON-LD. Ошибки в разметке Schema.org приводят к тому что поисковики игнорируют разметку и не показывают расширенные сниппеты." },
  no_og_title: { importance: "Средняя", description: "Open Graph теги используются при публикации страницы в социальных сетях. Без og:title соцсети сами выберут заголовок." },
  no_og_description: { importance: "Средняя", description: "Без og:description соцсети сами подберут описание при публикации страницы — часто неудачно." },
  no_og_image: { importance: "Средняя", description: "Без og:image при публикации в соцсетях не отображается превью-картинка, что снижает кликабельность ссылок." },
  no_twitter_card: { importance: "Низкая", description: "Twitter Cards управляют отображением страницы при публикации в Twitter/X." },
  // Скорость
  pagespeed_poor: { importance: "Критическая", description: "PageSpeed Score ниже 50. Низкая скорость загрузки негативно влияет на ранжирование в Google и поведенческие факторы пользователей." },
  pagespeed_average: { importance: "Средняя", description: "PageSpeed Score 50–89. Скорость загрузки требует улучшения для попадания в «зелёную» зону Core Web Vitals." },
  lcp_poor: { importance: "Критическая", description: "LCP (Largest Contentful Paint) — время загрузки главного контента. Норма < 2.5с. Влияет на Core Web Vitals и ранжирование в Google." },
  lcp_average: { importance: "Средняя", description: "LCP в диапазоне 2.5–4.0с. Требует улучшения: оптимизируйте изображения, шрифты и серверный ответ." },
  tbt_poor: { importance: "Критическая", description: "TBT (Total Blocking Time) — время блокировки главного потока. Норма < 200мс. Влияет на интерактивность страницы." },
  tbt_average: { importance: "Средняя", description: "TBT в диапазоне 200–600мс. Требует улучшения: уменьшите объём JavaScript и разбейте длинные задачи." },
  cls_poor: { importance: "Критическая", description: "CLS (Cumulative Layout Shift) — визуальная стабильность страницы. Норма < 0.1. Высокий CLS означает что элементы прыгают при загрузке." },
  cls_average: { importance: "Средняя", description: "CLS в диапазоне 0.1–0.25. Требует улучшения: задавайте размеры изображений и резервируйте место под динамический контент." },
  render_blocking: { importance: "Средняя", description: "Ресурсы блокирующие отрисовку замедляют загрузку страницы. CSS и JS в head без async/defer блокируют рендеринг." },
  unminified_js: { importance: "Средняя", description: "JavaScript не минифицирован. Минификация уменьшает размер файлов и ускоряет загрузку страниц." },
  unminified_css: { importance: "Средняя", description: "CSS не минифицирован. Минификация уменьшает размер стилей и ускоряет загрузку страниц." },
  no_viewport: { importance: "Критическая", description: "Без мета тега viewport страница не адаптируется под мобильные устройства. Google использует mobile-first индексацию." },
};
const IMPORTANCE_CLS: Record<string, string> = {
  "Критическая": "text-red-400",
  "Высокая": "text-orange-400",
  "Средняя": "text-yellow-400",
  "Низкая": "text-blue-400",
};
import { useQuery, useQueryClient } from "@tanstack/react-query";
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
      { code: "ssl_expiring_soon", label: "SSL сертификат скоро истекает", severity: "critical" },
      { code: "ssl_error", label: "Ошибка SSL сертификата", severity: "critical" },
      { code: "crawl_error", label: "Ошибка при сканировании", severity: "critical" },
      { code: "mixed_content", label: "Mixed content — HTTP ресурсы на HTTPS странице", severity: "warning" },
      { code: "no_last_modified", label: "Не установлен заголовок Last-Modified", severity: "warning" },
      { code: "cyclic_link", label: "Циклические ссылки на текущую страницу", severity: "warning" },
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
      { code: "deep_page", label: "Страница слишком глубоко вложена", severity: "warning" },
      { code: "orphan_page", label: "Orphan страница — нет входящих ссылок", severity: "warning" },
      { code: "hreflang_no_default", label: "Hreflang без x-default", severity: "info" },
      { code: "hreflang_duplicate", label: "Дублирующиеся hreflang теги", severity: "warning" },
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
      { code: "missing_h2", label: "Страницы без заголовка H2", severity: "warning" },
      { code: "heading_hierarchy", label: "Нарушена иерархия заголовков", severity: "warning" },
      { code: "page_too_large", label: "Большой размер страницы (>200kb)", severity: "warning" },
    ],
  },
  {
    id: "analytics",
    title: "Аналитика",
    description: "Счётчики Яндекс Метрики и Google Analytics",
    icon: ({ className }: any) => <span className={className}>📊</span>,
    types: ["analytics"],
    checks: [
      { code: "no_yandex_metrika", label: "Яндекс Метрика не установлена", severity: "warning" },
      { code: "no_google_analytics", label: "Google Analytics не установлен", severity: "warning" },
      { code: "duplicate_metrika", label: "Дубль счётчика Яндекс Метрики", severity: "warning" },
      { code: "duplicate_ga", label: "Дубль счётчика Google Analytics", severity: "warning" },
    ],
  },
  {
    id: "structured",
    title: "Структурированные данные",
    description: "Schema.org JSON-LD, Open Graph и Twitter Cards",
    icon: ({ className }: any) => <span className={className}>🔖</span>,
    types: ["structured"],
    checks: [
      { code: "invalid_schema_jsonld", label: "Некорректный JSON-LD", severity: "warning" },
      { code: "no_og_title", label: "Нет og:title", severity: "warning" },
      { code: "no_og_description", label: "Нет og:description", severity: "warning" },
      { code: "no_og_image", label: "Нет og:image", severity: "warning" },
      { code: "no_schema_jsonld", label: "Нет Schema.org JSON-LD разметки", severity: "info" },
      { code: "no_twitter_card", label: "Нет Twitter Card", severity: "info" },
    ],
  },
  {
    id: "speed",
    title: "Скорость",
    description: "PageSpeed, Core Web Vitals (LCP, CLS, TBT), минификация и mobile-friendly",
    icon: ({ className }: any) => <span className={className}>⚡️</span>,
    types: ["speed"],
    checks: [
      { code: "pagespeed_poor", label: "Низкий PageSpeed Score", severity: "critical" },
      { code: "lcp_poor", label: "LCP слишком медленный", severity: "critical" },
      { code: "tbt_poor", label: "Total Blocking Time высокий", severity: "critical" },
      { code: "cls_poor", label: "CLS слишком высокий", severity: "critical" },
      { code: "no_viewport", label: "Нет viewport для мобильных", severity: "critical" },
      { code: "pagespeed_average", label: "Средний PageSpeed Score", severity: "warning" },
      { code: "lcp_average", label: "LCP требует улучшения", severity: "warning" },
      { code: "tbt_average", label: "Total Blocking Time требует улучшения", severity: "warning" },
      { code: "cls_average", label: "CLS требует улучшения", severity: "warning" },
      { code: "render_blocking", label: "Render-blocking ресурсы", severity: "warning" },
      { code: "unminified_js", label: "JavaScript не минифицирован", severity: "warning" },
      { code: "unminified_css", label: "CSS не минифицирован", severity: "warning" },
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

  // Группируем найденные issues этой секции по code.
  // Матчим по type ИЛИ по code (если code есть в каталоге секции) — так issues
  // от внешних краулеров с "неправильным" type всё равно попадут в нужную секцию
  // и получат русский label.
  const sectionCodes = new Set(section.checks.map((c) => c.code));
  const sectionIssues = (issues ?? []).filter(
    (i) => section.types.includes(i.type) || sectionCodes.has(i.code),
  );
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
  // Коды, принадлежащие другим секциям каталога — исключаем из "extras",
  // чтобы избежать дублей и отображения raw-кода вместо русского label.
  const ownedByOtherSection = new Set<string>();
  for (const s of SECTIONS) {
    if (s.id === section.id) continue;
    for (const c of s.checks) ownedByOtherSection.add(c.code);
  }
  const extraCodes = Array.from(groupMap.keys()).filter(
    (c) => !catalogCodes.has(c) && !ownedByOtherSection.has(c),
  );
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
    <Card className={cn("bg-card border-border overflow-hidden", sectionLeftBorder)}>
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
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
          <h3 className="text-[14px] font-semibold text-foreground">{section.title}</h3>
          <p className="text-[11px] text-muted-foreground truncate">{section.description}</p>
        </div>
        <Badge className={cn("text-[11px] border", counterCls)}>
          {problemCount === 0 ? "Ошибок нет" : `Найдено: ${problemCount}`}
        </Badge>
        {sectionOpen
          ? <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          : <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />}
      </button>

      {sectionOpen && (
        <div className="border-t border-border divide-y divide-border">
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
                  <span className={cn("flex-1 min-w-0", has ? "text-foreground" : "text-muted-foreground")}>
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
                                className="inline-flex shrink-0 text-muted-foreground hover:text-foreground/90 transition-colors cursor-help"
                              >
                                <HelpCircle className="h-3.5 w-3.5" />
                              </span>
                            </TooltipTrigger>
                            <TooltipContent side="top" className="max-w-[320px] text-[12px] leading-relaxed">
                              <div className="space-y-1.5">
                                <div className="font-semibold text-zinc-900">{r.label}</div>
                                <div className="text-zinc-700">{CHECK_INFO[r.code].description}</div>
                                <div className="pt-1 border-t border-zinc-200">
                                  <span className="text-muted-foreground">Важность: </span>
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
                      <span className="block text-[11px] italic text-muted-foreground truncate mt-0.5">
                        {String(duplicateValue)}
                      </span>
                    )}
                  </span>
                  {has ? (
                    <>
                      <Badge className="bg-muted text-foreground/90 text-[11px] shrink-0 border-0">
                        {pages} {pageWord(pages)}
                      </Badge>
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0", SEV_CLS[r.severity] ?? SEV_CLS.info)}>
                        {SEV_LABEL[r.severity] ?? r.severity}
                      </span>
                      {isOpen
                        ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                        : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />}
                    </>
                  ) : (
                    <span className="text-[11px] text-emerald-400 shrink-0">Ошибок нет</span>
                  )}
                </button>
                {has && isOpen && (
                  <div className="px-4 py-3 pl-11 space-y-2 bg-muted/30">
                    {items.length === 0 ? (
                      <div className="text-[11px] text-muted-foreground">URL не переданы краулером</div>
                    ) : isDuplicateCode ? (
                      (() => {
                        const groups = new Map<string, string[]>();
                        for (const it of items) {
                          const dv = (it.details as any)?.duplicate_value;
                          if (!dv || !it.url) continue;
                          const key = String(dv);
                          if (!groups.has(key)) groups.set(key, []);
                          const arr = groups.get(key)!;
                          if (!arr.includes(it.url)) arr.push(it.url);
                        }
                        const entries = Array.from(groups.entries()).sort((a, b) => b[1].length - a[1].length);
                        if (entries.length === 0) {
                          return <div className="text-[11px] text-muted-foreground">Значения дублей не переданы краулером</div>;
                        }
                        return (
                          <>
                            {entries.slice(0, 50).map(([value, urls], gi) => (
                              <div key={gi} className="rounded border border-border bg-background overflow-hidden">
                                <div className="flex items-center justify-between gap-2 px-3 py-2 bg-muted/40 border-b border-border">
                                  <div className="min-w-0 flex-1">
                                    <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                                      Дубль · {value.length} симв.
                                    </div>
                                    <div className="text-[12px] text-foreground/90 break-words">{value}</div>
                                  </div>
                                  <Badge className="bg-muted text-foreground/90 text-[11px] shrink-0 border-0">
                                    {urls.length} {pageWord(urls.length)}
                                  </Badge>
                                </div>
                                <div className="px-3 py-2 space-y-1">
                                  {urls.slice(0, 100).map((u, ui) => (
                                    <a
                                      key={ui}
                                      href={u}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="flex items-center gap-1.5 text-[12px] text-blue-400 hover:text-blue-300 hover:underline font-mono"
                                    >
                                      <ExternalLink className="h-3 w-3 shrink-0" />
                                      <span className="truncate">{u}</span>
                                    </a>
                                  ))}
                                  {urls.length > 100 && (
                                    <div className="text-[11px] text-muted-foreground">…и ещё {urls.length - 100}</div>
                                  )}
                                </div>
                              </div>
                            ))}
                            {entries.length > 50 && (
                              <div className="text-[11px] text-muted-foreground pt-1">…и ещё {entries.length - 50} групп дублей</div>
                            )}
                          </>
                        );
                      })()
                    ) : (
                      items.slice(0, 100).map((it, i) => {
                        const detail = showText ? getDetailText(r.code, it.details) : null;
                        return (
                          <div key={i} className="space-y-1 border-b border-border last:border-0 pb-2 last:pb-0">
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
                              <div className="text-[11px] text-muted-foreground">URL не указан</div>
                            )}
                            {detail && (
                              <div className="ml-5 rounded bg-background border border-border px-2.5 py-1.5">
                                <div className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">
                                  Текст {detail.len != null && <span className="text-muted-foreground">· {detail.len} симв.</span>}
                                </div>
                                <div className="text-[12px] text-foreground/90 break-words">{detail.text}</div>
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                    {!isDuplicateCode && items.length > 100 && (
                      <div className="text-[11px] text-muted-foreground pt-1">…и ещё {items.length - 100} записей</div>
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

// ============ BENTO-СЕТКА РАЗДЕЛОВ ============
function BentoSections({
  sections,
  issues,
  baseUrl,
}: {
  sections: SectionDef[];
  issues: any[];
  baseUrl?: string | null;
}) {
  // Скрываем секцию "speed" из сетки — для скорости есть отдельный блок PageSpeed Insights ниже
  const visibleSections = sections.filter((s) => s.id !== "speed");
  const [activeId, setActiveId] = useState<string>(visibleSections[0]?.id ?? "");

  // Считаем статистику по каждой секции
  const sectionStats = sections.map((s) => {
    const codes = new Set(s.checks.map((c) => c.code));
    const own = (issues ?? []).filter((i) => s.types.includes(i.type) || codes.has(i.code));
    const groups = new Map<string, { severity: string; count: number }>();
    for (const i of own) {
      const code = i.code || "unknown";
      const g = groups.get(code);
      if (!g) groups.set(code, { severity: i.severity || "info", count: 1 });
      else g.count += 1;
    }
    let critical = 0, warning = 0, info = 0;
    for (const g of groups.values()) {
      if (g.severity === "critical") critical += 1;
      else if (g.severity === "warning") warning += 1;
      else info += 1;
    }
    const problemCount = groups.size;
    const totalChecks = s.checks.length;
    const passed = totalChecks - problemCount;
    const score = totalChecks > 0 ? Math.round((passed / totalChecks) * 100) : 100;
    const status: "ok" | "critical" | "warning" | "info" =
      problemCount === 0 ? "ok" : critical > 0 ? "critical" : warning > 0 ? "warning" : "info";
    return { section: s, problemCount, critical, warning, info, score, status, passed, totalChecks };
  });

  const STATUS_GRADIENT: Record<string, string> = {
    ok: "from-emerald-500/20 via-emerald-500/5 to-transparent",
    critical: "from-red-500/25 via-red-500/5 to-transparent",
    warning: "from-yellow-500/20 via-yellow-500/5 to-transparent",
    info: "from-blue-500/20 via-blue-500/5 to-transparent",
  };
  const STATUS_RING: Record<string, string> = {
    ok: "ring-emerald-500/40",
    critical: "ring-red-500/50",
    warning: "ring-yellow-500/40",
    info: "ring-blue-500/40",
  };
  const STATUS_TEXT: Record<string, string> = {
    ok: "text-emerald-400",
    critical: "text-red-400",
    warning: "text-yellow-400",
    info: "text-blue-400",
  };
  const STATUS_BG_ICON: Record<string, string> = {
    ok: "bg-emerald-500/15 text-emerald-400",
    critical: "bg-red-500/15 text-red-400",
    warning: "bg-yellow-500/15 text-yellow-400",
    info: "bg-blue-500/15 text-blue-400",
  };
  const STATUS_PROGRESS: Record<string, string> = {
    ok: "bg-emerald-500",
    critical: "bg-red-500",
    warning: "bg-yellow-500",
    info: "bg-blue-500",
  };

  const active = sections.find((s) => s.id === activeId) ?? sections[0];

  return (
    <div className="space-y-5">
      {/* Bento-сетка */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
        {sectionStats.map(({ section, problemCount, critical, warning, info, score, status, passed, totalChecks }) => {
          const Icon = section.icon;
          const isActive = section.id === activeId;
          return (
            <button
              key={section.id}
              type="button"
              onClick={() => setActiveId(section.id)}
              className={cn(
                "group relative overflow-hidden rounded-xl border bg-card p-4 text-left transition-all",
                "hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20",
                isActive ? cn("ring-2 border-transparent", STATUS_RING[status]) : "border-border hover:border-border/80"
              )}
            >
              {/* Градиентный фон по статусу */}
              <div className={cn("absolute inset-0 bg-gradient-to-br opacity-80 pointer-events-none", STATUS_GRADIENT[status])} />
              {/* Декоративный круг */}
              <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-2xl opacity-50 pointer-events-none", STATUS_PROGRESS[status])} />

              <div className="relative space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div className={cn("h-9 w-9 rounded-lg flex items-center justify-center shrink-0", STATUS_BG_ICON[status])}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="text-right">
                    <div className={cn("text-[22px] font-bold leading-none tabular-nums", STATUS_TEXT[status])}>
                      {problemCount}
                    </div>
                    <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
                      {problemCount === 0 ? "Ошибок нет" : "проблем"}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-[13px] font-semibold text-foreground leading-tight line-clamp-2 min-h-[34px]">
                    {section.title}
                  </h3>
                </div>

                {/* Прогресс-бар по % здоровья */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{passed}/{totalChecks} OK</span>
                    <span className={cn("font-semibold tabular-nums", STATUS_TEXT[status])}>{score}%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn("h-full transition-all", STATUS_PROGRESS[status])}
                      style={{ width: `${score}%` }}
                    />
                  </div>
                </div>

                {/* Severity-точки */}
                {problemCount > 0 && (
                  <div className="flex items-center gap-1.5 pt-1">
                    {critical > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-red-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-red-500" />{critical}
                      </span>
                    )}
                    {warning > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-yellow-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />{warning}
                      </span>
                    )}
                    {info > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />{info}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Детали выбранной секции */}
      {active && (
        active.id === "speed" ? (
          <PageSpeedBlock siteUrl={baseUrl} />
        ) : (
          <AuditSection
            key={active.id}
            section={active}
            issues={issues}
            baseUrl={baseUrl}
            defaultOpen={true}
          />
        )
      )}
    </div>
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
  const queryClient = useQueryClient();
  const [resetting, setResetting] = useState(false);

  const handleResetAll = async () => {
    if (!confirm("Удалить все данные сканирования по этому проекту? Действие необратимо.")) return;
    setResetting(true);
    try {
      const { data: jobs } = await supabase
        .from("crawl_jobs")
        .select("id")
        .eq("project_id", projectId);
      const jobIds = (jobs ?? []).map((j: any) => j.id);
      if (jobIds.length > 0) {
        await supabase.from("crawl_issues").delete().in("job_id", jobIds);
        await supabase.from("crawl_pages").delete().in("job_id", jobIds);
        await supabase.from("crawl_stats").delete().in("job_id", jobIds);
        await supabase.from("crawl_jobs").delete().in("id", jobIds);
      }
      setJobId(null);
      setStats(null);
      setScanStatus("idle");
      setScanProgress(0);
      setShowSfPanel(false);
      await queryClient.invalidateQueries({ queryKey: ["crawl-stats"] });
      await queryClient.invalidateQueries({ queryKey: ["crawl-issues-all"] });
      toast.success("Все данные сканирования удалены");
    } catch (e: any) {
      toast.error("Не удалось сбросить данные: " + (e?.message ?? ""));
    } finally {
      setResetting(false);
    }
  };

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
      <Card className="bg-card border-border p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-foreground">Технический аудит</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
              <span>Сайт: <span className="text-foreground font-medium">{domain}</span></span>
              <span>Дата аудита: <span className="text-foreground">{format(new Date(), "dd.MM.yyyy")}</span></span>
              <span>Подготовил: <span className="text-foreground">{specialist?.full_name || project?.seo_specialist || "—"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {scanStatus === "idle" && <Badge variant="secondary" className="text-[11px]">Ожидает запуска</Badge>}
            {scanStatus === "pending" && <Badge className="bg-[hsl(var(--chart-2))]/15 text-[hsl(var(--chart-2))] hover:bg-[hsl(var(--chart-2))]/15 text-[11px]">В очереди</Badge>}
            {scanStatus === "running" && <Badge className="bg-[hsl(var(--chart-4))]/15 text-[hsl(var(--chart-4))] hover:bg-[hsl(var(--chart-4))]/15 animate-pulse text-[11px]">Сканирование...</Badge>}
            {scanStatus === "done" && <Badge className="bg-[hsl(var(--chart-3))]/15 text-[hsl(var(--chart-3))] hover:bg-[hsl(var(--chart-3))]/15 text-[11px]">Готов</Badge>}
            {scanStatus === "error" && <Badge variant="destructive" className="text-[11px]">Ошибка</Badge>}
            <Button variant="outline" size="sm" className="gap-1.5 text-[12px]">
              <Download className="h-3.5 w-3.5" /> Скачать PDF отчёт
            </Button>
            {(jobId || scanStatus !== "idle") && (
              <Button
                variant="outline"
                size="sm"
                disabled={resetting}
                onClick={handleResetAll}
                className="gap-1.5 text-[12px] border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
              >
                <Trash2 className="h-3.5 w-3.5" />
                {resetting ? "Сброс..." : "Сбросить данные"}
              </Button>
            )}
            <Button size="sm" className="gap-1.5 text-[12px]" onClick={handleStartScan}>
              Запустить аудит
            </Button>
          </div>
        </div>
      </Card>

      {/* Панель прогресса */}
      {showSfPanel && (
        <Card className="bg-card border-border p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-foreground">Сканирование</span>
            <Button variant="ghost" size="sm" className="text-muted-foreground text-[11px]" onClick={() => setShowSfPanel(false)}>Скрыть</Button>
          </div>
          <div className="flex items-center gap-3">
            <Input value={domain !== "—" ? `https://${domain}` : ""} readOnly className="bg-muted/40 border-border text-foreground/90 text-[12px] max-w-xs" />
            <span className="text-[11px] text-muted-foreground">Время сканирования: 5–15 минут для сайтов до 500 страниц</span>
          </div>
          {(scanStatus === "pending" || scanStatus === "running") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
                  {scanStatus === "running" ? "Идёт сканирование..." : "В очереди..."}
                </span>
                <span>{Math.round(scanProgress)}%</span>
              </div>
              <Progress value={Math.min(scanProgress, 100)} className="h-2 bg-muted" />
            </div>
          )}
          {scanStatus === "error" && (
            <div className="text-[12px] text-red-400">Произошла ошибка при сканировании</div>
          )}
        </Card>
      )}

      {/* KPI результатов — единый стиль с «Аналитикой» */}
      {scanStatus === "done" && effectiveStats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          {([
            { label: "Всего страниц", value: effectiveStats.total_pages, icon: FileSearch, tone: "primary" },
            { label: "Критических", value: effectiveStats.critical_count, icon: AlertCircle, tone: "destructive" },
            { label: "Предупреждений", value: effectiveStats.warning_count, icon: AlertTriangle, tone: "chart-4" },
            { label: "Средний TTFB", value: `${effectiveStats.avg_load_time_ms} мс`, icon: Info, tone: "chart-2" },
            { label: "Оценка сайта", value: `${effectiveStats.score}/100`, icon: CheckCircle2, tone: "chart-3" },
          ] as const).map((k) => {
            const Icon = k.icon;
            const isPrimary = k.tone === "primary";
            const isDestructive = k.tone === "destructive";
            const bgCls = isPrimary ? "bg-primary/10" : isDestructive ? "bg-destructive/10" : `bg-[hsl(var(--${k.tone}))]/10`;
            const textCls = isPrimary ? "text-primary" : isDestructive ? "text-destructive" : `text-[hsl(var(--${k.tone}))]`;
            return (
              <Card key={k.label} className="bg-card rounded-lg shadow-sm border border-border p-4">
                <div className="flex items-center gap-3">
                  <div className={`h-9 w-9 rounded-lg ${bgCls} flex items-center justify-center`}>
                    <Icon className={`h-4 w-4 ${textCls}`} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-wide truncate">{k.label}</p>
                    <p className="text-xl font-bold text-foreground tabular-nums">{k.value}</p>
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Bento-плитки разделов + раскрываемые детали */}
      {scanStatus === "done" && (
        <BentoSections sections={SECTIONS} issues={jobIssues} baseUrl={project?.url} />
      )}

      {scanStatus !== "done" && !showSfPanel && (
        <Card className="bg-card border-border p-8 text-center">
          <div className="text-[14px] text-muted-foreground">Запустите аудит, чтобы получить технический анализ сайта</div>
        </Card>
      )}
    </div>
  );
}

export default TechnicalAuditTab;
