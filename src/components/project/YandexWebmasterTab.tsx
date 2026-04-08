import { useState, useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, Download, ExternalLink, RefreshCw, Loader2, Search, FileDown, FileText, Link2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, parseISO } from "date-fns";
import { toast } from "sonner";
import { generateWebmasterPdf } from "@/lib/webmaster-pdf";

/* ─── types ─── */
type CheckStatus = "ok" | "error" | "not_checked";
type SectionType = "fatal" | "critical" | "possible" | "recommendation";

interface WmCheck {
  number: string;
  name: string;
  section: SectionType;
  apiField: string;
  actionUrl?: string;
  actionLabel?: string;
  status: CheckStatus;
  errorCount?: number;
  errorUrls?: string[];
}

/* ─── section styles ─── */
const SECTION_META: Record<SectionType, { label: string; color: string; border: string; emoji: string; info: string }> = {
  fatal: { label: "Фатальные ошибки", color: "#F44336", border: "border-l-[#F44336]", emoji: "🔴", info: "Фатальные ошибки несовместимы с отображением сайта в поисковой выдаче. Требуют немедленного исправления." },
  critical: { label: "Критичные ошибки", color: "#FF9800", border: "border-l-[#FF9800]", emoji: "🟠", info: "Критичные ошибки серьёзно затрудняют индексацию. Могут сильно снизить видимость сайта в поиске." },
  possible: { label: "Возможные проблемы", color: "#FFC107", border: "border-l-[#FFC107]", emoji: "🟡", info: "Возможные проблемы влияют на удобство и корректную индексацию. Рекомендуется устранить." },
  recommendation: { label: "Рекомендации", color: "#2196F3", border: "border-l-[#2196F3]", emoji: "🔵", info: "Рекомендации носят необязательный характер, но помогают улучшить сайт и его отображение." },
};

/* ─── API field → site_errors.error_type mapping ─── */
const API_TO_ERROR_TYPE: Record<string, string[]> = {
  security_problems: ["THREATS"],
  dns_error: ["DNS_ERROR"],
  server_error: ["CONNECT_FAILED"],
  main_page_unavailable: ["MAIN_PAGE_ERROR"],
  robots_disallow_all: ["DISALLOWED_IN_ROBOTS"],
  ssl_error: ["SSL_CERTIFICATE_ERROR"],
  get_params_duplicates: ["INSIGNIFICANT_CGI_PARAMETER"],
  http_5xx_pages: ["URL_ALERT_5XX"],
  http_4xx_pages: ["URL_ALERT_4XX"],
  slow_server_response: ["SLOW_AVG_RESPONSE_TIME"],
  incorrect_404: ["SOFT_404"],
  missing_titles: ["DOCUMENTS_MISSING_TITLE"],
  robots_errors: ["ERROR_IN_ROBOTS_TXT"],
  metrika_not_linked: ["NO_METRIKA_COUNTER_BINDING"],
  subdomains_found: ["TOO_MANY_DOMAINS_ON_SEARCH"],
  duplicate_titles_descriptions: ["DUPLICATE_CONTENT_ATTRS"],
  robots_not_found: ["NO_ROBOTS_TXT"],
  no_sitemap: ["NO_SITEMAPS"],
  duplicate_pages: ["DUPLICATE_PAGES"],
  favicon_inaccessible: ["FAVICON_ERROR"],
  missing_descriptions: ["DOCUMENTS_MISSING_DESCRIPTION"],
  main_page_redirect: ["MAIN_PAGE_REDIRECTS"],
  counter_crawl_disabled: ["NO_METRIKA_COUNTER_CRAWL_ENABLED"],
  sitemap_errors: ["ERRORS_IN_SITEMAPS"],
  sitemap_outdated: ["NO_SITEMAP_MODIFICATIONS"],
  no_https_mirror: ["MAIN_MIRROR_IS_NOT_HTTPS"],
  favicon_recommendation: ["BIG_FAVICON_ABSENT", "FAVICON_PROBLEM"],
  region_not_set: ["NO_REGIONS"],
  business_card_created: ["NOT_IN_SPRAV"],
  metrika_missing: ["NO_METRIKA_COUNTER"],
  mobile_not_optimized: ["NOT_MOBILE_FRIENDLY"],
  favicon_missing: ["FAVICON_ERROR", "FAVICON_PROBLEM"],
};

function getDomain(url?: string | null): string {
  if (!url) return "example.com";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; } catch { return url.replace(/^https?:\/\//, "").split("/")[0] || "example.com"; }
}

function buildChecks(domain: string): WmCheck[] {
  const d = domain;
  return [
    // FATAL
    { number: "1.1", name: "Нарушения безопасности", section: "fatal", apiField: "security_problems", status: "not_checked" },
    { number: "1.2", name: "Ошибка DNS", section: "fatal", apiField: "dns_error", status: "not_checked", actionUrl: `https://mxtoolbox.com/SuperTool.aspx?action=dns%3a${d}`, actionLabel: "Проверить DNS" },
    { number: "1.3", name: "Ошибка сервера", section: "fatal", apiField: "server_error", status: "not_checked", actionUrl: `https://check-host.net/check-http?host=${d}`, actionLabel: "Проверить сервер" },
    { number: "1.4", name: "Главная страница недоступна", section: "fatal", apiField: "main_page_unavailable", status: "not_checked", actionUrl: `https://${d}`, actionLabel: "Открыть сайт" },
    { number: "1.5", name: "Сайт закрыт в robots.txt", section: "fatal", apiField: "robots_disallow_all", status: "not_checked", actionUrl: `https://${d}/robots.txt`, actionLabel: "Открыть robots.txt" },
    // CRITICAL
    { number: "2.1", name: "Некорректный SSL-сертификат", section: "critical", apiField: "ssl_error", status: "not_checked", actionUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${d}`, actionLabel: "Проверить SSL" },
    { number: "2.2", name: "Страницы-дубли с GET-параметрами", section: "critical", apiField: "get_params_duplicates", status: "not_checked" },
    { number: "2.3", name: "Страницы отвечают 5xx", section: "critical", apiField: "http_5xx_pages", status: "not_checked" },
    { number: "2.4", name: "Страницы отвечают 4xx", section: "critical", apiField: "http_4xx_pages", status: "not_checked" },
    { number: "2.5", name: "Долгий ответ сервера", section: "critical", apiField: "slow_server_response", status: "not_checked" },
    // POSSIBLE
    { number: "3.1", name: "Некорректная настройка 404", section: "possible", apiField: "incorrect_404", status: "not_checked" },
    { number: "3.2", name: "Отсутствуют теги title", section: "possible", apiField: "missing_titles", status: "not_checked" },
    { number: "3.3", name: "Ошибки в robots.txt", section: "possible", apiField: "robots_errors", status: "not_checked", actionUrl: `https://${d}/robots.txt`, actionLabel: "Проверить robots.txt" },
    { number: "3.4", name: "Счётчик Метрики не привязан", section: "possible", apiField: "metrika_not_linked", status: "not_checked", actionUrl: "https://metrika.yandex.ru", actionLabel: "Привязать" },
    { number: "3.5", name: "Найдены поддомены в поиске", section: "possible", apiField: "subdomains_found", status: "not_checked" },
    { number: "3.6", name: "Одинаковые заголовки и описания", section: "possible", apiField: "duplicate_titles_descriptions", status: "not_checked" },
    { number: "3.7", name: "Не найден robots.txt", section: "possible", apiField: "robots_not_found", status: "not_checked", actionUrl: `https://${d}/robots.txt`, actionLabel: "Открыть" },
    { number: "3.8", name: "Нет файлов Sitemap", section: "possible", apiField: "no_sitemap", status: "not_checked", actionUrl: `https://${d}/sitemap.xml`, actionLabel: "Проверить Sitemap" },
    { number: "3.9", name: "Страницы дублируют друг друга", section: "possible", apiField: "duplicate_pages", status: "not_checked" },
    { number: "3.10", name: "Favicon недоступен для робота", section: "possible", apiField: "favicon_inaccessible", status: "not_checked", actionUrl: `https://${d}/favicon.ico`, actionLabel: "Проверить favicon" },
    { number: "3.11", name: "Отсутствуют метатеги Description", section: "possible", apiField: "missing_descriptions", status: "not_checked" },
    { number: "3.12", name: "Пользовательское соглашение видео", section: "possible", apiField: "video_agreement", status: "not_checked", actionUrl: "https://yandex.ru/support/webmaster/", actionLabel: "Справка Яндекса" },
    { number: "3.13", name: "Главная перенаправляет на другой сайт", section: "possible", apiField: "main_page_redirect", status: "not_checked", actionUrl: `https://${d}`, actionLabel: "Проверить редирект" },
    { number: "3.14", name: "Не включён обход по счётчикам", section: "possible", apiField: "counter_crawl_disabled", status: "not_checked", actionUrl: "https://webmaster.yandex.ru", actionLabel: "Настроить" },
    { number: "3.15", name: "Ошибки в файлах Sitemap", section: "possible", apiField: "sitemap_errors", status: "not_checked", actionUrl: "https://validator.w3.org/feed/", actionLabel: "Валидатор Sitemap" },
    { number: "3.16", name: "Полезные страницы закрыты от индексации", section: "possible", apiField: "useful_pages_closed", status: "not_checked" },
    { number: "3.17", name: "Требуется соглашение с Яндексом", section: "possible", apiField: "yandex_agreement_required", status: "not_checked", actionUrl: "https://yandex.ru/support/webmaster/", actionLabel: "Справка" },
    { number: "3.18", name: "Sitemap давно не обновлялись", section: "possible", apiField: "sitemap_outdated", status: "not_checked" },
    { number: "3.19", name: "Главное зеркало без HTTPS", section: "possible", apiField: "no_https_mirror", status: "not_checked", actionUrl: `https://www.ssllabs.com/ssltest/analyze.html?d=${d}`, actionLabel: "Проверить SSL" },
    { number: "3.20", name: "Не все товары переданы в поиск", section: "possible", apiField: "products_not_submitted", status: "not_checked", actionUrl: "https://webmaster.yandex.ru", actionLabel: "Яндекс Вебмастер" },
    // RECOMMENDATIONS
    { number: "4.1", name: "Добавить favicon SVG 120×120", section: "recommendation", apiField: "favicon_recommendation", status: "not_checked", actionUrl: "https://yandex.ru/support/webmaster/", actionLabel: "Справка" },
    { number: "4.2", name: "Указать регион сайта", section: "recommendation", apiField: "region_not_set", status: "not_checked", actionUrl: "https://webmaster.yandex.ru", actionLabel: "Настроить регион" },
    { number: "4.3", name: "Яндекс Бизнес создал карточку", section: "recommendation", apiField: "business_card_created", status: "not_checked", actionUrl: "https://business.yandex.ru", actionLabel: "Проверить карточку" },
    { number: "4.4", name: "Добавить сайт в Яндекс Бизнес", section: "recommendation", apiField: "add_to_yandex_business", status: "not_checked", actionUrl: "https://business.yandex.ru", actionLabel: "Добавить" },
    { number: "4.5", name: "Счётчик Метрики не установлен", section: "recommendation", apiField: "metrika_missing", status: "not_checked", actionUrl: "https://metrika.yandex.ru", actionLabel: "Установить" },
    { number: "4.6", name: "Сайт не оптимизирован для мобильных", section: "recommendation", apiField: "mobile_not_optimized", status: "not_checked", actionUrl: "https://webmaster.yandex.ru/tools/mobile-friendly/", actionLabel: "Проверить" },
    { number: "4.7", name: "Файл favicon не найден", section: "recommendation", apiField: "favicon_missing", status: "not_checked", actionUrl: "https://yandex.ru/support/webmaster/", actionLabel: "Справка" },
  ];
}

/* ─── sub-components ─── */
function StatusBadge({ status }: { status: CheckStatus }) {
  if (status === "ok") return <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400">✅ Ошибок нет</span>;
  if (status === "error") return <span className="inline-flex items-center gap-1 text-[11px] text-red-400">🔴 Ошибка обнаружена</span>;
  return <span className="text-[11px] text-zinc-500">Не проверено</span>;
}

function CheckRowWm({ check, sectionType }: { check: WmCheck; sectionType: SectionType }) {
  const [expanded, setExpanded] = useState(false);
  const meta = SECTION_META[sectionType];
  const borderCls = check.status === "error" ? meta.border : check.status === "ok" ? "border-l-emerald-500" : "border-l-zinc-600";

  return (
    <div className={cn("border-l-[3px] rounded-r-lg", borderCls)}>
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#2a2a2a] cursor-pointer transition-colors" onClick={() => (check.errorUrls && check.errorUrls.length > 0) && setExpanded(!expanded)}>
        <span className="w-[40px] text-[12px] text-zinc-500 font-mono shrink-0">{check.number}</span>
        <span className={cn("flex-1 text-[13px] truncate", check.status === "ok" ? "text-zinc-500" : "text-zinc-200")}>{check.name}</span>
        <div className="w-[180px] shrink-0"><StatusBadge status={check.status} /></div>
        {check.errorCount !== undefined && check.errorCount > 0 && (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[10px]">{check.errorCount} стр.</Badge>
        )}
        <div className="w-[140px] shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
          {check.actionUrl && (
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10" onClick={() => window.open(check.actionUrl, "_blank")}>
              {check.actionLabel || "Открыть"} <ExternalLink className="h-3 w-3" />
            </Button>
          )}
        </div>
        {check.errorUrls && check.errorUrls.length > 0 && (
          <span className="text-zinc-500">{expanded ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />}</span>
        )}
      </div>
      {expanded && check.errorUrls && (
        <div className="px-4 pb-3 pl-[60px] space-y-1">
          {check.errorUrls.slice(0, 10).map((u, i) => <div key={i} className="text-[12px] text-zinc-400 font-mono">{u}</div>)}
          {check.errorUrls.length > 10 && <div className="text-[11px] text-cyan-400 cursor-pointer">Показать все {check.errorUrls.length}</div>}
        </div>
      )}
    </div>
  );
}

function SectionWm({ section, checks }: { section: SectionType; checks: WmCheck[] }) {
  const [open, setOpen] = useState(true);
  const meta = SECTION_META[section];
  const errCount = checks.filter(c => c.status === "error").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] transition-colors">
          {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
          <span className="text-[14px] font-semibold text-zinc-100">{meta.emoji} {meta.label}</span>
          <Badge className="text-[11px]" style={{ backgroundColor: `${meta.color}20`, color: meta.color, borderColor: `${meta.color}50` }}>{checks.length} проверок</Badge>
          {errCount > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px]">{errCount} ошибок</Badge>}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="mx-4 mt-2 mb-2 rounded-lg px-4 py-2 text-[12px] border" style={{ backgroundColor: `${meta.color}08`, borderColor: `${meta.color}20`, color: `${meta.color}cc` }}>
          {meta.info}
        </div>
        <div className="flex items-center gap-3 px-3 py-2 text-[11px] text-zinc-500 font-medium border-b border-[#333] mx-1">
          <div className="w-[40px] shrink-0">№</div>
          <div className="flex-1">Проверка</div>
          <div className="w-[180px] shrink-0">Статус</div>
          <div className="w-[80px] shrink-0">Кол-во</div>
          <div className="w-[140px] shrink-0 text-right">Действие</div>
          <div className="w-[20px]"></div>
        </div>
        <div className="space-y-0.5 mt-1">
          {checks.map(c => <CheckRowWm key={c.number} check={c} sectionType={section} />)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

/* ─── main ─── */
interface Props { projectId: string; }

export function YandexWebmasterTab({ projectId }: Props) {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);
  const [pdfLoading, setPdfLoading] = useState(false);

  const handleDownloadPdf = async () => {
    setPdfLoading(true);
    try {
      await new Promise(r => setTimeout(r, 100));
      generateWebmasterPdf(checks, {
        domain,
        date: format(new Date(), "dd.MM.yyyy"),
        period: "1",
        specialist: specialist?.full_name || project?.seo_specialist || "—",
      });
      toast.success("PDF отчёт скачан");
    } catch (e: any) {
      console.error(e);
      toast.error("Ошибка генерации PDF");
    } finally {
      setPdfLoading(false);
    }
  };

  const { data: project } = useQuery({
    queryKey: ["project-wm-tab", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      return data;
    },
  });

  const { data: specialist } = useQuery({
    queryKey: ["specialist-wm", project?.seo_specialist_id],
    enabled: !!project?.seo_specialist_id,
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("full_name").eq("id", project!.seo_specialist_id!).single();
      return data;
    },
  });

  const { data: siteErrors = [] } = useQuery({
    queryKey: ["site-errors", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("site_errors").select("*").eq("project_id", projectId).eq("source", "yandex");
      return data || [];
    },
  });

  const { data: healthMetrics = [] } = useQuery({
    queryKey: ["site-health", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("site_health").select("*").eq("project_id", projectId).eq("source", "yandex");
      return data || [];
    },
  });

  const domain = getDomain(project?.url);

  const lastUpdate = useMemo(() => {
    if (healthMetrics.length === 0) return null;
    const dates = healthMetrics.map(m => new Date(m.updated_at).getTime());
    return new Date(Math.max(...dates));
  }, [healthMetrics]);

  const getMetric = (name: string) => {
    const m = healthMetrics.find(h => h.metric_name === name);
    return m?.metric_value || "0";
  };

  // Map active error types from API
  const activeErrorTypes = new Set(siteErrors.map(e => e.error_type));

  // Build checks with live status from API
  const checks = useMemo(() => {
    const raw = buildChecks(domain);
    return raw.map(c => {
      const mappedTypes = API_TO_ERROR_TYPE[c.apiField] || [];
      const hasError = mappedTypes.some(t => activeErrorTypes.has(t));
      const relatedErrors = siteErrors.filter(e => mappedTypes.includes(e.error_type));
      const isChecked = healthMetrics.length > 0; // data was synced
      return {
        ...c,
        status: isChecked ? (hasError ? "error" : "ok") : "not_checked" as CheckStatus,
        errorCount: relatedErrors.length > 0 ? relatedErrors.length : undefined,
        errorUrls: relatedErrors.filter(e => e.url && e.url !== "—").map(e => e.url),
      };
    });
  }, [domain, activeErrorTypes, siteErrors, healthMetrics]);

  const bySection = (s: SectionType) => {
    let filtered = checks.filter(c => c.section === s);
    if (filter === "errors") filtered = filtered.filter(c => c.status === "error");
    if (filter === "fatal") filtered = filtered.filter(c => c.section === "fatal");
    if (filter === "critical") filtered = filtered.filter(c => c.section === "critical");
    if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()));
    return filtered;
  };

  const fatalCount = checks.filter(c => c.section === "fatal" && c.status === "error").length;
  const criticalCount = checks.filter(c => c.section === "critical" && c.status === "error").length;
  const possibleCount = checks.filter(c => c.section === "possible" && c.status === "error").length;
  const recCount = checks.filter(c => c.section === "recommendation" && c.status === "error").length;
  const errorChecks = checks.filter(c => c.status === "error");

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Не авторизован");
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(`https://${projectRef}.supabase.co/functions/v1/fetch-site-health`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ project_id: projectId }),
      });
      const result = await resp.json();
      if (!resp.ok) throw new Error(result.error || "Ошибка обновления");
      queryClient.invalidateQueries({ queryKey: ["site-health", projectId] });
      queryClient.invalidateQueries({ queryKey: ["site-errors", projectId] });
      toast.success("Данные Яндекс Вебмастера обновлены");
    } catch (e: any) {
      toast.error(e.message || "Ошибка при обновлении");
    } finally {
      setRefreshing(false);
    }
  };

  const yIndexed = getMetric("indexed_pages");
  const yTotal = getMetric("total_pages");

  return (
    <div className="space-y-5">
      {/* HEADER */}
      <Card className="bg-[#252525] border-[#333] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-zinc-100">Яндекс Вебмастер</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-zinc-400">
              <span>Сайт: <span className="text-zinc-200 font-medium">{domain}</span></span>
              <span>Дата анализа: <span className="text-zinc-200">{lastUpdate ? format(lastUpdate, "dd.MM.yyyy HH:mm") : "—"}</span></span>
              <span>Подготовил: <span className="text-zinc-200">{specialist?.full_name || project?.seo_specialist || "—"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {lastUpdate && <span className="text-[11px] text-zinc-500">Последнее обновление: {format(lastUpdate, "dd.MM.yyyy 'в' HH:mm")}</span>}
            <Button variant="outline" size="sm" className="gap-1.5 text-[12px] border-[#444] text-zinc-300 hover:bg-[#333]">
              <Download className="h-3.5 w-3.5" /> Скачать PDF отчёт
            </Button>
            <Button size="sm" className="gap-1.5 text-[12px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0" onClick={handleRefresh} disabled={refreshing}>
              <RefreshCw className={cn("h-3.5 w-3.5", refreshing && "animate-spin")} /> {refreshing ? "Обновление..." : "🔄 Обновить данные"}
            </Button>
          </div>
        </div>
      </Card>

      {/* LEGEND */}
      <div className="flex flex-wrap gap-2">
        {(["fatal", "critical", "possible", "recommendation"] as const).map(s => {
          const m = SECTION_META[s];
          return <span key={s} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium" style={{ backgroundColor: `${m.color}15`, color: m.color, borderColor: `${m.color}30` }}>{m.emoji} {m.label} — {m.info.split(".")[0].toLowerCase()}</span>;
        })}
      </div>

      {/* SUMMARY CARDS */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: "Фатальные ошибки", count: fatalCount, color: "#F44336", emoji: "🔴" },
          { label: "Критичные ошибки", count: criticalCount, color: "#FF9800", emoji: "🟠" },
          { label: "Возможные проблемы", count: possibleCount, color: "#FFC107", emoji: "🟡" },
          { label: "Рекомендации", count: recCount, color: "#2196F3", emoji: "🔵" },
        ]).map(card => (
          <Card key={card.label} className={cn("bg-[#252525] border-[#333] overflow-hidden", card.count > 0 && card.color === "#F44336" && "shadow-[0_0_20px_rgba(244,67,54,0.15)]")} style={{ borderLeftWidth: 3, borderLeftColor: card.color }}>
            <div className="p-4">
              <div className="text-[11px] text-zinc-400 flex items-center gap-1.5"><span>{card.emoji}</span> {card.label}</div>
              <div className="text-2xl font-bold text-zinc-100 mt-1">{card.count}</div>
            </div>
          </Card>
        ))}
      </div>

      {/* STATUS BANNER */}
      {healthMetrics.length > 0 && (
        fatalCount > 0 ? (
          <div className="rounded-lg bg-red-500/10 border border-red-500/20 px-4 py-3 text-[13px] text-red-400 font-medium">🚨 Фатальные ошибки! Сайт может пропасть из поиска</div>
        ) : criticalCount > 0 ? (
          <div className="rounded-lg bg-orange-500/10 border border-orange-500/20 px-4 py-3 text-[13px] text-orange-400 font-medium">⚠️ Обнаружены критичные ошибки — требуют срочного исправления</div>
        ) : (
          <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-4 py-3 text-[13px] text-emerald-400 font-medium">✅ Критических проблем не обнаружено</div>
        )
      )}

      {/* FILTER BAR */}
      <div className="flex flex-wrap items-center gap-2">
        {([["all", "Все"], ["errors", "Только ошибки"], ["fatal", "Фатальные"], ["critical", "Критичные"]] as const).map(([val, label]) => (
          <Button key={val} variant={filter === val ? "default" : "outline"} size="sm"
            className={cn("text-[11px] h-7", filter === val ? "bg-purple-600 hover:bg-purple-700 text-white border-0" : "border-[#444] text-zinc-400 hover:bg-[#333]")}
            onClick={() => setFilter(val)}>
            {label}
          </Button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input placeholder="Поиск по проверке..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] h-7 w-[240px]" />
        </div>
      </div>

      {/* Empty state */}
      {healthMetrics.length === 0 && (
        <Card className="bg-[#252525] border-[#333] p-12 text-center">
          <RefreshCw className="h-12 w-12 mx-auto mb-4 text-zinc-600" />
          <p className="text-zinc-400 text-[14px] mb-3">Нажмите «Обновить данные» для загрузки данных из Яндекс Вебмастер</p>
          <Button size="sm" className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white border-0" onClick={handleRefresh} disabled={refreshing}>
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : "🔄 Обновить данные"}
          </Button>
        </Card>
      )}

      {/* SECTIONS */}
      {healthMetrics.length > 0 && (
        <div className="space-y-4">
          <SectionWm section="fatal" checks={bySection("fatal")} />
          <SectionWm section="critical" checks={bySection("critical")} />
          <SectionWm section="possible" checks={bySection("possible")} />
          <SectionWm section="recommendation" checks={bySection("recommendation")} />
        </div>
      )}

      {/* DATA WIDGETS */}
      {healthMetrics.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Indexation */}
          <Card className="bg-[#252525] border-[#333] p-4">
            <h4 className="text-[13px] font-semibold text-zinc-200 mb-3">📊 Индексация</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]"><span className="text-zinc-400">Страниц в индексе</span><span className="text-zinc-100 font-bold">{Number(yIndexed).toLocaleString("ru-RU")}</span></div>
              <div className="flex justify-between text-[12px]"><span className="text-zinc-400">Всего страниц</span><span className="text-zinc-100 font-bold">{Number(yTotal).toLocaleString("ru-RU")}</span></div>
              {Number(yTotal) > 0 && (
                <Progress value={(Number(yIndexed) / Number(yTotal)) * 100} className="h-2 bg-[#333]" />
              )}
            </div>
          </Card>

          {/* Errors summary */}
          <Card className="bg-[#252525] border-[#333] p-4">
            <h4 className="text-[13px] font-semibold text-zinc-200 mb-3">⚠️ Замечания</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]"><span className="text-zinc-400">Активных проблем</span><span className="text-red-400 font-bold">{siteErrors.filter(e => e.status === "Новая").length}</span></div>
              <div className="flex justify-between text-[12px]"><span className="text-zinc-400">Просмотрено</span><span className="text-zinc-300 font-bold">{siteErrors.filter(e => e.status === "Просмотрена").length}</span></div>
              <div className="flex justify-between text-[12px]"><span className="text-zinc-400">Всего из Вебмастера</span><span className="text-zinc-100 font-bold">{siteErrors.length}</span></div>
            </div>
          </Card>

          {/* Sitemap */}
          <Card className="bg-[#252525] border-[#333] p-4">
            <h4 className="text-[13px] font-semibold text-zinc-200 mb-3">🗺️ Sitemap и Robots</h4>
            <div className="space-y-2">
              <div className="flex justify-between text-[12px]">
                <span className="text-zinc-400">Sitemap</span>
                <span className={cn("font-bold", getMetric("sitemap_status") === "ok" ? "text-emerald-400" : "text-zinc-500")}>{getMetric("sitemap_status") === "ok" ? "✅ Подключен" : "Не настроен"}</span>
              </div>
              <div className="flex justify-between text-[12px]">
                <span className="text-zinc-400">Последний обход</span>
                <span className="text-zinc-100">{(() => { const v = getMetric("last_crawl"); try { return v && v !== "0" ? format(parseISO(v), "dd.MM.yyyy") : "—"; } catch { return "—"; } })()}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* SECTION 5 — Recommendations for errors */}
      {errorChecks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-zinc-100">Рекомендации по исправлениям</h3>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px]">{errorChecks.length}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {errorChecks.map(c => {
              const meta = SECTION_META[c.section];
              return (
                <Card key={c.number} className="bg-[#252525] border-[#333] p-4 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${meta.color}20`, color: meta.color, borderColor: `${meta.color}40` }}>{meta.emoji} {meta.label}</span>
                    <span className="text-[12px] font-mono text-zinc-500">{c.number}</span>
                    <span className="text-[13px] font-medium text-zinc-200">{c.name}</span>
                  </div>
                  <Textarea placeholder="Задание для специалиста / разработчика..." className="bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] min-h-[60px]" />
                  <div className="flex items-center gap-2">
                    <Select defaultValue="new">
                      <SelectTrigger className="h-7 w-[130px] text-[11px] bg-[#1e1e1e] border-[#333] text-zinc-300"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="new">Новая</SelectItem>
                        <SelectItem value="inprogress">В работе</SelectItem>
                        <SelectItem value="done">Выполнено</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default YandexWebmasterTab;
