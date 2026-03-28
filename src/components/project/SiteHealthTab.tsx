import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Globe, Loader2,
  AlertCircle, Link as LinkIcon, Shield, TrendingUp,
  Search, FileText, ArrowUpRight, ArrowDownRight,
  Building2, MapPin, Info,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  GlassCard, StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip,
} from "./shared-ui";

interface SiteHealthTabProps {
  projectId: string;
  accessToken?: string | null;
  hostId?: string | null;
}

const ChartTooltip = StandardChartTooltip;

async function callWebmaster(action: string, accessToken: string, extra?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-webmaster`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
      apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ action, access_token: accessToken, ...extra }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) {
    if (data.error === "Resource not found") return null;
    throw new Error(data.error || "Webmaster API error");
  }
  return data;
}

/* ═══════════════════════════════════════════════════════
   Host Selector (Empty State)
   ═══════════════════════════════════════════════════════ */
function HostSelector({ projectId, accessToken, onSelected }: {
  projectId: string; accessToken: string; onSelected: (hostId: string) => void;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const queryClient = useQueryClient();

  const { data: hosts, isLoading } = useQuery({
    queryKey: ["webmaster-hosts", accessToken],
    queryFn: async () => {
      const data = await callWebmaster("get-hosts", accessToken);
      return (data?.hosts || []) as { host_id: string; ascii_host_url: string; verified: boolean }[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (selectedHostId: string) => {
      await callWebmaster("save-host", accessToken, { host_id: selectedHostId, project_id: projectId });
      return selectedHostId;
    },
    onSuccess: (savedHostId) => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      toast.success(isRu ? "Сайт привязан!" : "Host linked!");
      onSelected(savedHostId);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Globe className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isRu ? "Выберите сайт из Яндекс.Вебмастера" : "Select site from Yandex Webmaster"}
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        {isRu
          ? "Привяжите подтверждённый сайт для отслеживания индексации и диагностики."
          : "Link a verified site to track indexing and diagnostics."}
      </p>
      {isLoading ? (
        <Skeleton className="h-10 w-[320px]" />
      ) : !hosts || hosts.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground">
          {isRu ? "Нет подтверждённых сайтов в Вебмастере" : "No verified hosts found"}
        </div>
      ) : (
        <Select onValueChange={(v) => saveMutation.mutate(v)}>
          <SelectTrigger className="w-[360px] h-10">
            <SelectValue placeholder={isRu ? "Выберите сайт…" : "Select host…"} />
          </SelectTrigger>
          <SelectContent>
            {hosts.map((h) => (
              <SelectItem key={h.host_id} value={h.host_id}>
                {h.ascii_host_url || h.host_id}
                {h.verified && " ✓"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   No Token State
   ═══════════════════════════════════════════════════════ */
function NoTokenState() {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-20 w-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-6">
        <Shield className="h-10 w-10 text-destructive" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isRu ? "Подключите Яндекс.Метрику" : "Connect Yandex Metrika"}
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        {isRu
          ? "Для работы с Вебмастером необходим OAuth-токен Яндекса. Подключите Яндекс.Метрику в разделе Интеграции."
          : "Yandex OAuth token is required. Connect Yandex Metrika in Integrations."}
      </p>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Main Tab
   ═══════════════════════════════════════════════════════ */
export function SiteHealthTab({ projectId, accessToken, hostId }: SiteHealthTabProps) {
  const [selectedHostId, setSelectedHostId] = useState<string | null>(hostId || null);
  const effectiveHostId = hostId || selectedHostId;

  if (!accessToken) return <NoTokenState />;
  if (!effectiveHostId) {
    return (
      <HostSelector
        projectId={projectId}
        accessToken={accessToken}
        onSelected={(newHostId) => setSelectedHostId(newHostId)}
      />
    );
  }

  return (
    <SiteHealthDashboard
      projectId={projectId}
      accessToken={accessToken}
      hostId={effectiveHostId}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Problem name translations
   ═══════════════════════════════════════════════════════ */
const PROBLEM_NAMES_RU: Record<string, string> = {
  INSIGNIFICANT_CGI_PARAMETER: "Незначимые CGI-параметры",
  ERROR_IN_ROBOTS_TXT: "Ошибки в robots.txt",
  MAIN_PAGE_ERROR: "Ошибка главной страницы",
  NO_SITEMAP_MODIFICATIONS: "Нет изменений в Sitemap",
  CONNECT_FAILED: "Ошибка подключения",
  MAIN_MIRROR_IS_NOT_HTTPS: "Главное зеркало не HTTPS",
  FAVICON_ERROR: "Ошибка favicon",
  NOT_IN_SPRAV: "Организация не в Яндекс.Справочнике",
  FAVICON_PROBLEM: "Проблемы с favicon",
  DNS_ERROR: "Ошибка DNS",
  MAIN_PAGE_REDIRECTS: "Редиректы на главной",
  DOCUMENTS_MISSING_DESCRIPTION: "Нет описания у страниц",
  ERRORS_IN_SITEMAPS: "Ошибки в Sitemap",
  NOT_MOBILE_FRIENDLY: "Не оптимизирован для мобильных",
  URL_ALERT_5XX: "5xx ошибки на URL",
  URL_ALERT_4XX: "4xx ошибки на URL",
  DUPLICATE_CONTENT_ATTRS: "Дублированные content-атрибуты",
  BIG_FAVICON_ABSENT: "Нет большого favicon",
  NO_SITEMAPS: "Нет Sitemap",
  DOCUMENTS_MISSING_TITLE: "Нет заголовка у страниц",
  NO_REGIONS: "Не указан регион",
  TOO_MANY_DOMAINS_ON_SEARCH: "Слишком много доменов в поиске",
  SSL_CERTIFICATE_ERROR: "Ошибка SSL-сертификата",
  DUPLICATE_PAGES: "Дублированные страницы",
  DISALLOWED_IN_ROBOTS: "Закрыто в robots.txt",
  NO_ROBOTS_TXT: "Нет robots.txt",
  NO_METRIKA_COUNTER: "Нет счётчика Яндекс.Метрики",
  SOFT_404: "Программный 404 (soft 404)",
  THREATS: "Обнаружены угрозы безопасности",
  NO_METRIKA_COUNTER_BINDING: "Не привязан счётчик Метрики",
  NO_METRIKA_COUNTER_CRAWL_ENABLED: "Не включён обход Метрикой",
  SLOW_AVG_RESPONSE_TIME: "Медленное время ответа",
  VIDEOHOST_OFFER_NEED_PAPER: "Видеохостинг: нужна бумага",
  VIDEOHOST_OFFER_FAILED: "Видеохостинг: ошибка",
};

const SEVERITY_LABELS_RU: Record<string, string> = {
  FATAL: "Фатальная",
  CRITICAL: "Критическая",
  POSSIBLE_PROBLEM: "Возможная проблема",
  RECOMMENDATION: "Рекомендация",
};

const SEVERITY_ORDER: Record<string, number> = {
  FATAL: 0, CRITICAL: 1, POSSIBLE_PROBLEM: 2, RECOMMENDATION: 3,
};

const SEVERITY_COLORS = {
  FATAL: { border: "border-destructive/40", bg: "bg-destructive/8", text: "text-destructive", badge: "border-destructive/40 text-destructive bg-destructive/10" },
  CRITICAL: { border: "border-destructive/30", bg: "bg-destructive/5", text: "text-destructive", badge: "border-destructive/30 text-destructive bg-destructive/10" },
  POSSIBLE_PROBLEM: { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-600", badge: "border-amber-500/40 text-amber-600 bg-amber-500/10" },
  RECOMMENDATION: { border: "border-primary/20", bg: "bg-primary/5", text: "text-primary", badge: "border-primary/30 text-primary bg-primary/10" },
};

/* ═══════════════════════════════════════════════════════
   Dashboard
   ═══════════════════════════════════════════════════════ */
function SiteHealthDashboard({ projectId, accessToken, hostId }: {
  projectId: string; accessToken: string; hostId: string;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const [recrawlUrl, setRecrawlUrl] = useState("");
  const [recrawling, setRecrawling] = useState(false);
  const [showAllChecks, setShowAllChecks] = useState(false);

  // SQI
  const { data: sqiData, isLoading: sqiLoading } = useQuery({
    queryKey: ["webmaster-sqi", hostId],
    queryFn: () => callWebmaster("get-sqi", accessToken, { host_id: hostId }),
    retry: 1,
  });

  // Summary
  const { data: summaryData, isLoading: summaryLoading } = useQuery({
    queryKey: ["webmaster-summary", hostId],
    queryFn: () => callWebmaster("get-summary", accessToken, { host_id: hostId }),
    retry: 1,
  });

  // Indexing history
  const { data: indexingData, isLoading: indexingLoading } = useQuery({
    queryKey: ["webmaster-indexing", hostId],
    queryFn: () => callWebmaster("get-indexing-history", accessToken, { host_id: hostId }),
    retry: 1,
  });

  // Diagnostics
  const { data: diagnosticsData, isLoading: diagLoading } = useQuery({
    queryKey: ["webmaster-diagnostics", hostId],
    queryFn: () => callWebmaster("get-diagnostics", accessToken, { host_id: hostId }),
    retry: 1,
  });

  // Backlinks
  const { data: backlinksData, isLoading: backlinksLoading } = useQuery({
    queryKey: ["webmaster-backlinks", hostId],
    queryFn: () => callWebmaster("get-backlinks", accessToken, { host_id: hostId }),
    retry: 1,
  });

  /* ── Parse SQI ── */
  const sqiHistory = useMemo(() => {
    const points = sqiData?.points || sqiData?.sqi_history || [];
    if (!Array.isArray(points) || points.length === 0) return [];
    // Aggregate by week to reduce noise (daily data for a year = too many points)
    const weekly: Record<string, number[]> = {};
    for (const p of points) {
      if (!p.date) continue;
      const d = new Date(p.date);
      // Get week start (Monday)
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const weekStart = new Date(d.setDate(diff));
      const key = format(weekStart, "dd.MM");
      if (!weekly[key]) weekly[key] = [];
      weekly[key].push(p.sqi ?? p.value ?? 0);
    }
    return Object.entries(weekly).map(([date, vals]) => ({
      date,
      sqi: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length),
    }));
  }, [sqiData]);

  const currentSqi = summaryData?.sqi ?? (sqiHistory.length > 0 ? sqiHistory[sqiHistory.length - 1].sqi : 0);

  /* ── Parse summary ── */
  const pagesInSearch = summaryData?.searchable_pages_count ?? 0;
  const excludedPages = summaryData?.excluded_pages_count ?? 0;

  /* ── Parse backlinks ── */
  const backlinksHistory = useMemo(() => {
    if (!backlinksData?.indicators) return [];
    const vals = Object.values(backlinksData.indicators) as any[];
    if (vals.length > 0 && Array.isArray(vals[0])) {
      return vals[0].map((item: any) => ({
        date: item.date ? format(new Date(item.date), "dd.MM") : "",
        links: item.value ?? 0,
      }));
    }
    return [];
  }, [backlinksData]);

  const backlinksCount = backlinksHistory.length > 0
    ? backlinksHistory[backlinksHistory.length - 1].links
    : (backlinksData?.links_total_count ?? 0);

  /* ── Parse diagnostics (dict format!) ── */
  const { activeProblems, allChecks, spravStatus } = useMemo(() => {
    const problemsDict = diagnosticsData?.problems;
    if (!problemsDict || typeof problemsDict !== "object" || Array.isArray(problemsDict)) {
      return { activeProblems: [], allChecks: [], spravStatus: null as any };
    }

    const active: any[] = [];
    const all: any[] = [];
    let sprav: any = null;

    for (const [key, val] of Object.entries(problemsDict) as [string, any][]) {
      const item = {
        id: key,
        name: isRu ? (PROBLEM_NAMES_RU[key] || key) : key.replace(/_/g, " ").toLowerCase(),
        severity: val.severity || "RECOMMENDATION",
        state: val.state,
        lastUpdate: val.last_state_update,
      };

      all.push(item);

      if (key === "NOT_IN_SPRAV") {
        sprav = item;
      }

      if (val.state === "PRESENT") {
        active.push(item);
      }
    }

    // Sort by severity
    all.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));
    active.sort((a, b) => (SEVERITY_ORDER[a.severity] ?? 99) - (SEVERITY_ORDER[b.severity] ?? 99));

    return { activeProblems: active, allChecks: all, spravStatus: sprav };
  }, [diagnosticsData, isRu]);

  const fatalCount = allChecks.filter(c => c.severity === "FATAL" && c.state === "PRESENT").length;
  const criticalCount = activeProblems.filter(p => p.severity === "CRITICAL" || p.severity === "FATAL").length;
  const warningCount = activeProblems.filter(p => p.severity === "POSSIBLE_PROBLEM").length;

  /* ── Parse indexing chart (aggregate by date) ── */
  const indexingChart = useMemo(() => {
    const indicators = indexingData?.indicators || {};
    const http2xx = indicators.HTTP_2XX || [];
    const http3xx = indicators.HTTP_3XX || [];
    const http4xx = indicators.HTTP_4XX || [];
    const http5xx = indicators.HTTP_5XX || [];

    // Aggregate all series by date (YYYY-MM-DD)
    const byDate: Record<string, { ok: number; redirect: number; notFound: number; serverErr: number }> = {};

    const addToDate = (arr: any[], field: "ok" | "redirect" | "notFound" | "serverErr") => {
      for (const item of arr) {
        if (!item.date) continue;
        const dateKey = new Date(item.date).toISOString().split("T")[0];
        if (!byDate[dateKey]) byDate[dateKey] = { ok: 0, redirect: 0, notFound: 0, serverErr: 0 };
        byDate[dateKey][field] += item.value ?? 0;
      }
    };

    addToDate(http2xx, "ok");
    addToDate(http3xx, "redirect");
    addToDate(http4xx, "notFound");
    addToDate(http5xx, "serverErr");

    const sorted = Object.entries(byDate).sort(([a], [b]) => a.localeCompare(b));
    return sorted.map(([dateStr, vals]) => ({
      date: format(new Date(dateStr), "dd.MM"),
      fullDate: dateStr,
      "2xx": vals.ok,
      "3xx": vals.redirect,
      "4xx": vals.notFound,
      "5xx": vals.serverErr,
    }));
  }, [indexingData]);

  /* ── Diagnostics pie ── */
  const diagPie = useMemo(() => {
    const data = [];
    if (criticalCount > 0) data.push({ name: isRu ? "Критические" : "Critical", value: criticalCount, color: "hsl(var(--destructive))" });
    if (warningCount > 0) data.push({ name: isRu ? "Возм. проблемы" : "Possible", value: warningCount, color: "hsl(45, 93%, 47%)" });
    const passedCount = allChecks.filter(c => c.state === "ABSENT").length;
    if (passedCount > 0) data.push({ name: isRu ? "Пройдено" : "Passed", value: passedCount, color: "hsl(var(--primary))" });
    return data;
  }, [allChecks, criticalCount, warningCount, isRu]);

  /* ── Recrawl ── */
  const handleRecrawl = async () => {
    setRecrawling(true);
    try {
      await callWebmaster("recrawl", accessToken, {
        host_id: hostId,
        url: recrawlUrl.trim() || hostId,
      });
      toast.success(isRu ? "Запрос на переобход отправлен" : "Recrawl request sent");
      setRecrawlUrl("");
    } catch (e: any) {
      toast.error(e.message || "Recrawl failed");
    } finally {
      setRecrawling(false);
    }
  };

  return (
    <div className="space-y-6 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      {/* ── KPI Row ── */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <KpiSkeleton loading={sqiLoading || summaryLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "ИКС (SQI)" : "SQI"}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{currentSqi}</p>
              {sqiHistory.length > 2 && (
                <div className="h-8 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sqiHistory.slice(-12)}>
                      <Line type="monotone" dataKey="sqi" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </GlassCard>
        </KpiSkeleton>

        <KpiSkeleton loading={summaryLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <Search className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "В поиске" : "In search"}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{pagesInSearch.toLocaleString()}</p>
              {excludedPages > 0 && (
                <p className="text-xs text-muted-foreground mt-1">
                  {isRu ? "Исключено" : "Excluded"}: <span className="text-amber-500 font-medium">{excludedPages.toLocaleString()}</span>
                </p>
              )}
            </CardContent>
          </GlassCard>
        </KpiSkeleton>

        <KpiSkeleton loading={summaryLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "Исключено" : "Excluded"}</span>
              </div>
              <p className="text-3xl font-bold text-amber-500">{excludedPages.toLocaleString()}</p>
            </CardContent>
          </GlassCard>
        </KpiSkeleton>

        <KpiSkeleton loading={backlinksLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <LinkIcon className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "Ссылки" : "Backlinks"}</span>
              </div>
              <p className="text-3xl font-bold text-foreground">{backlinksCount.toLocaleString()}</p>
              {backlinksHistory.length > 2 && (
                <div className="h-8 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={backlinksHistory.slice(-10)}>
                      <Line type="monotone" dataKey="links" stroke="hsl(var(--primary))" strokeWidth={1.5} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </GlassCard>
        </KpiSkeleton>

        <KpiSkeleton loading={diagLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle2 className={cn("h-3.5 w-3.5", activeProblems.length > 0 ? "text-amber-500" : "text-emerald-500")} />
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "Замечания" : "Issues"}</span>
              </div>
              <p className={cn("text-3xl font-bold", activeProblems.length > 0 ? "text-amber-500" : "text-emerald-500")}>
                {activeProblems.length}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {isRu ? `из ${allChecks.length} проверок` : `of ${allChecks.length} checks`}
              </p>
            </CardContent>
          </GlassCard>
        </KpiSkeleton>
      </div>

      {/* ── Indexing History Chart ── */}
      <GlassCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {isRu ? "Динамика индексации (обход роботом)" : "Indexing Dynamics (Bot Crawl)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {indexingLoading ? (
            <Skeleton className="h-[300px]" />
          ) : indexingChart.length === 0 ? (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              {isRu ? "Нет данных по индексации" : "No indexing data available"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={indexingChart}>
                <defs>
                  <linearGradient id="grad2xx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad3xx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(45, 93%, 47%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="grad4xx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="2xx" name={isRu ? "Успешно (2xx)" : "OK (2xx)"} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#grad2xx)" dot={false} />
                <Area type="monotone" dataKey="3xx" name={isRu ? "Редиректы (3xx)" : "Redirects (3xx)"} stroke="hsl(45, 93%, 47%)" strokeWidth={1.5} fill="url(#grad3xx)" dot={false} />
                <Area type="monotone" dataKey="4xx" name={isRu ? "Не найдено (4xx)" : "Not found (4xx)"} stroke="hsl(var(--destructive))" strokeWidth={1.5} fill="url(#grad4xx)" dot={false} />
                {indexingChart.some(d => d["5xx"] > 0) && (
                  <Area type="monotone" dataKey="5xx" name={isRu ? "Ошибки (5xx)" : "Server errors (5xx)"} stroke="hsl(280, 70%, 50%)" strokeWidth={1.5} fill="none" dot={false} />
                )}
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </GlassCard>

      {/* ── SQI History + Backlinks History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <GlassCard>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              {isRu ? "История ИКС" : "SQI History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {sqiLoading ? (
              <Skeleton className="h-[200px]" />
            ) : sqiHistory.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                {isRu ? "Нет данных" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={sqiHistory}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="sqi" name="SQI" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>

        <GlassCard>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <LinkIcon className="h-4 w-4 text-primary" />
              {isRu ? "История обратных ссылок" : "Backlinks History"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {backlinksLoading ? (
              <Skeleton className="h-[200px]" />
            ) : backlinksHistory.length === 0 ? (
              <div className="flex items-center justify-center h-[200px] text-sm text-muted-foreground">
                {isRu ? "Нет данных" : "No data"}
              </div>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <AreaChart data={backlinksHistory}>
                  <defs>
                    <linearGradient id="blGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Area type="monotone" dataKey="links" name={isRu ? "Ссылки" : "Links"} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#blGrad)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>
      </div>

      {/* ── Diagnostics (Active Issues) ── */}
      <GlassCard>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {isRu ? "Замечания по сайту" : "Site Issues"}
              {activeProblems.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{activeProblems.length}</Badge>
              )}
            </CardTitle>
          </div>
        </CardHeader>
        <CardContent>
          {diagLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : activeProblems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-8 text-emerald-500">
              <CheckCircle2 className="h-10 w-10" />
              <span className="text-sm font-semibold">{isRu ? "Активных проблем нет!" : "No active issues!"}</span>
              <p className="text-xs text-muted-foreground">{isRu ? "Все проверки Вебмастера пройдены" : "All Webmaster checks passed"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {activeProblems.map((p) => {
                  const colors = SEVERITY_COLORS[p.severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.RECOMMENDATION;
                  return (
                    <div
                      key={p.id}
                      className={cn("rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors", colors.border, colors.bg)}
                    >
                      <AlertCircle className={cn("h-4 w-4 mt-0.5 shrink-0", colors.text)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{p.name}</p>
                        {p.lastUpdate && (
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {isRu ? "Обнаружено" : "Detected"}: {format(new Date(p.lastUpdate), "dd.MM.yyyy")}
                          </p>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", colors.badge)}>
                        {isRu ? (SEVERITY_LABELS_RU[p.severity] || p.severity) : p.severity}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {diagPie.length > 0 && (
                <div className="flex flex-col items-center justify-center">
                  <ResponsiveContainer width={160} height={160}>
                    <PieChart>
                      <Pie data={diagPie} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={3}>
                        {diagPie.map((entry, idx) => (
                          <Cell key={idx} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<ChartTooltip />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="space-y-1 mt-2">
                    {diagPie.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: d.color }} />
                        <span className="text-muted-foreground">{d.name}: <span className="font-medium text-foreground">{d.value}</span></span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </GlassCard>

      {/* ── All Checks List ── */}
      <GlassCard>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              {isRu ? "Все проверки Вебмастера" : "All Webmaster Checks"}
              <Badge variant="secondary" className="text-[10px] ml-1">{allChecks.length}</Badge>
            </CardTitle>
            <Button
              size="sm"
              variant="ghost"
              className="h-7 text-xs"
              onClick={() => setShowAllChecks(!showAllChecks)}
            >
              {showAllChecks ? (isRu ? "Свернуть" : "Collapse") : (isRu ? "Развернуть" : "Expand")}
            </Button>
          </div>
        </CardHeader>
        {showAllChecks && (
          <CardContent>
            {diagLoading ? (
              <Skeleton className="h-40" />
            ) : (
              <div className="space-y-1 max-h-[500px] overflow-y-auto pr-1">
                {allChecks.map((check) => {
                  const isPassed = check.state === "ABSENT";
                  const colors = SEVERITY_COLORS[check.severity as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.RECOMMENDATION;
                  return (
                    <div
                      key={check.id}
                      className={cn(
                        "rounded-lg border px-3 py-2.5 flex items-center gap-3 text-sm",
                        isPassed ? "border-border/50 bg-muted/20" : cn(colors.border, colors.bg)
                      )}
                    >
                      {isPassed ? (
                        <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      ) : (
                        <AlertCircle className={cn("h-4 w-4 shrink-0", colors.text)} />
                      )}
                      <span className={cn("flex-1", isPassed ? "text-muted-foreground" : "text-foreground font-medium")}>
                        {check.name}
                      </span>
                      <Badge
                        variant="outline"
                        className={cn(
                          "text-[10px] shrink-0",
                          isPassed ? "border-emerald-500/30 text-emerald-600 bg-emerald-500/10" : colors.badge
                        )}
                      >
                        {isPassed ? (isRu ? "ОК" : "OK") : (isRu ? SEVERITY_LABELS_RU[check.severity] || check.severity : check.severity)}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        )}
      </GlassCard>

      {/* ── Organization (Яндекс.Справочник) Widget ── */}
      <GlassCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {isRu ? "Привязка к Яндекс.Справочнику" : "Yandex Business Listing"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {diagLoading ? (
            <Skeleton className="h-24" />
          ) : !spravStatus ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              {isRu ? "Нет данных" : "No data"}
            </div>
          ) : spravStatus.state === "ABSENT" ? (
            <div className="flex items-center gap-4 p-4 rounded-lg bg-emerald-500/5 border border-emerald-500/20">
              <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                <CheckCircle2 className="h-6 w-6 text-emerald-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isRu ? "Организация привязана к Справочнику" : "Organization linked to Business Listing"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isRu
                    ? "Сайт привязан к организации в Яндекс.Справочнике. Это помогает ранжированию в Яндексе."
                    : "Site is linked to organization in Yandex Business. This helps with Yandex ranking."}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-4 p-4 rounded-lg bg-amber-500/5 border border-amber-500/20">
              <div className="h-12 w-12 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <MapPin className="h-6 w-6 text-amber-500" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {isRu ? "Организация не найдена в Справочнике" : "Organization not in Business Listing"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isRu
                    ? "Рекомендуем добавить организацию в Яндекс.Справочник для улучшения видимости в поиске и на картах."
                    : "We recommend adding your organization to Yandex Business for better visibility."}
                </p>
                <a
                  href="https://business.yandex.ru/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-primary font-medium mt-2 hover:underline"
                >
                  {isRu ? "Перейти в Яндекс.Справочник" : "Go to Yandex Business"}
                  <ArrowUpRight className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}
        </CardContent>
      </GlassCard>

      {/* ── Recrawl Action ── */}
      <GlassCard>
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <RefreshCw className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 space-y-3">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {isRu ? "Отправить на переобход" : "Request Recrawl"}
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {isRu
                    ? "Укажите URL для переобхода или оставьте пустым для главной страницы."
                    : "Enter URL or leave empty for the main page."}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Input
                  value={recrawlUrl}
                  onChange={(e) => setRecrawlUrl(e.target.value)}
                  placeholder="https://example.com/page"
                  className="max-w-md h-9 text-sm"
                />
                <Button onClick={handleRecrawl} disabled={recrawling} size="sm" className="gap-2 shrink-0">
                  {recrawling ? (
                    <><Loader2 className="h-4 w-4 animate-spin" />{isRu ? "Отправка…" : "Sending…"}</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" />{isRu ? "Переобход" : "Recrawl"}</>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </CardContent>
      </GlassCard>
    </div>
  );
}

/* ── Helpers ── */
function KpiSkeleton({ loading, children }: { loading: boolean; children: React.ReactNode }) {
  if (loading) return <GlassCard><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>;
  return <>{children}</>;
}
