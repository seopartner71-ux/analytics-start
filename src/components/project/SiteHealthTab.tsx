import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Globe, Loader2,
  AlertCircle, Link as LinkIcon, Shield, TrendingUp, TrendingDown,
  Search, FileText, ExternalLink, ArrowUpRight, ArrowDownRight,
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
   Dashboard
   ═══════════════════════════════════════════════════════ */

const SEVERITY_COLORS = {
  CRITICAL: { border: "border-destructive/30", bg: "bg-destructive/5", text: "text-destructive", badge: "border-destructive/40 text-destructive" },
  WARNING: { border: "border-amber-500/30", bg: "bg-amber-500/5", text: "text-amber-500", badge: "border-amber-500/40 text-amber-600" },
  INFO: { border: "border-border", bg: "bg-muted/30", text: "text-muted-foreground", badge: "border-border text-muted-foreground" },
};

function SiteHealthDashboard({ projectId, accessToken, hostId }: {
  projectId: string; accessToken: string; hostId: string;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const [recrawlUrl, setRecrawlUrl] = useState("");
  const [recrawling, setRecrawling] = useState(false);
  const [diagFilter, setDiagFilter] = useState<"all" | "CRITICAL" | "WARNING">("all");

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
    return points.map((p: any) => ({
      date: p.date ? format(new Date(p.date), "dd.MM") : "",
      sqi: p.sqi ?? p.value ?? 0,
    }));
  }, [sqiData]);

  const currentSqi = sqiHistory.length > 0
    ? sqiHistory[sqiHistory.length - 1].sqi
    : (sqiData?.sqi ?? 0);
  const prevSqi = sqiHistory.length > 1 ? sqiHistory[0].sqi : currentSqi;
  const sqiDelta = currentSqi - prevSqi;

  /* ── Parse summary ── */
  const pagesInSearch = summaryData?.searchable_pages_count ?? summaryData?.sites_count ?? 0;
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
  const prevBacklinks = backlinksHistory.length > 1
    ? backlinksHistory[0].links
    : backlinksCount;
  const backlinksDelta = backlinksCount - prevBacklinks;

  /* ── Parse diagnostics ── */
  const problems = useMemo(() => {
    const raw = Array.isArray(diagnosticsData?.problems)
      ? diagnosticsData.problems
      : Array.isArray(diagnosticsData)
        ? diagnosticsData
        : [];
    return raw.map((p: any) => ({
      ...p,
      severity: (p.severity || "INFO").toUpperCase(),
    }));
  }, [diagnosticsData]);

  const criticalCount = problems.filter((p) => p.severity === "CRITICAL").length;
  const warningCount = problems.filter((p) => p.severity === "WARNING" || p.severity === "WARN").length;

  const filteredProblems = diagFilter === "all"
    ? problems
    : problems.filter((p) => p.severity === diagFilter || (diagFilter === "WARNING" && p.severity === "WARN"));

  /* ── Parse indexing chart ── */
  const indexingChart = useMemo(() => {
    const history = indexingData?.indicators || indexingData?.history || {};
    const searchable = history?.SEARCHABLE || history?.searchable || [];
    const excluded = history?.NOT_SEARCHABLE || history?.not_searchable || [];
    if (Array.isArray(searchable) && searchable.length > 0) {
      return searchable.map((item: any, i: number) => ({
        date: item.date ? format(new Date(item.date), "dd.MM") : "",
        indexed: item.value ?? 0,
        excluded: excluded[i]?.value ?? 0,
      }));
    }
    return [];
  }, [indexingData]);

  /* ── Diagnostics summary pie ── */
  const diagPie = useMemo(() => {
    const data = [];
    if (criticalCount > 0) data.push({ name: isRu ? "Критические" : "Critical", value: criticalCount, color: "hsl(var(--destructive))" });
    if (warningCount > 0) data.push({ name: isRu ? "Предупреждения" : "Warnings", value: warningCount, color: "hsl(45, 93%, 47%)" });
    const infoCount = problems.length - criticalCount - warningCount;
    if (infoCount > 0) data.push({ name: isRu ? "Информация" : "Info", value: infoCount, color: "hsl(var(--muted-foreground))" });
    return data;
  }, [problems, criticalCount, warningCount, isRu]);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiSkeleton loading={sqiLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "ИКС (SQI)" : "SQI"}</span>
                <DeltaBadge delta={sqiDelta} />
              </div>
              <p className="text-3xl font-bold text-foreground">{currentSqi}</p>
              {sqiHistory.length > 2 && (
                <div className="h-8 mt-2">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={sqiHistory.slice(-10)}>
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

        <KpiSkeleton loading={backlinksLoading}>
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <LinkIcon className="h-3.5 w-3.5 text-primary" />
                  <span className="text-xs text-muted-foreground font-medium">{isRu ? "Обратные ссылки" : "Backlinks"}</span>
                </div>
                <DeltaBadge delta={backlinksDelta} />
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
                <AlertTriangle className={cn("h-3.5 w-3.5", criticalCount > 0 ? "text-destructive" : "text-emerald-500")} />
                <span className="text-xs text-muted-foreground font-medium">
                  {isRu ? "Проблемы" : "Issues"}
                </span>
              </div>
              <p className={cn("text-3xl font-bold", criticalCount > 0 ? "text-destructive" : "text-emerald-500")}>
                {problems.length}
              </p>
              <div className="flex gap-3 mt-1">
                {criticalCount > 0 && (
                  <span className="text-xs text-destructive font-medium">{criticalCount} {isRu ? "крит." : "crit."}</span>
                )}
                {warningCount > 0 && (
                  <span className="text-xs text-amber-500 font-medium">{warningCount} {isRu ? "пред." : "warn."}</span>
                )}
              </div>
            </CardContent>
          </GlassCard>
        </KpiSkeleton>
      </div>

      {/* ── Indexing History Chart ── */}
      <GlassCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4 text-primary" />
            {isRu ? "Динамика индексации" : "Indexing History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {indexingLoading ? (
            <Skeleton className="h-[280px]" />
          ) : indexingChart.length === 0 ? (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              {isRu ? "Нет данных по индексации" : "No indexing data available"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={indexingChart}>
                <defs>
                  <linearGradient id="idxGradIn" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="idxGradEx" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="indexed" name={isRu ? "В индексе" : "Indexed"} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#idxGradIn)" dot={false} />
                <Area type="monotone" dataKey="excluded" name={isRu ? "Исключено" : "Excluded"} stroke="hsl(var(--destructive))" strokeWidth={1.5} fill="url(#idxGradEx)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </GlassCard>

      {/* ── SQI History + Backlinks History ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* SQI History */}
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
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} tickLine={false} axisLine={false} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="sqi" name="SQI" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </GlassCard>

        {/* Backlinks History */}
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

      {/* ── Diagnostics ── */}
      <GlassCard>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              {isRu ? "Диагностика" : "Diagnostics"}
              {problems.length > 0 && (
                <Badge variant="secondary" className="text-[10px] ml-1">{problems.length}</Badge>
              )}
            </CardTitle>
            {problems.length > 0 && (
              <div className="flex gap-1">
                {(["all", "CRITICAL", "WARNING"] as const).map((f) => (
                  <Button
                    key={f}
                    size="sm"
                    variant={diagFilter === f ? "default" : "outline"}
                    className="h-7 text-xs px-3"
                    onClick={() => setDiagFilter(f)}
                  >
                    {f === "all" ? (isRu ? "Все" : "All") : f === "CRITICAL" ? (isRu ? "Критические" : "Critical") : (isRu ? "Предупреждения" : "Warnings")}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {diagLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-14" />)}
            </div>
          ) : problems.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-10 text-emerald-500">
              <CheckCircle2 className="h-10 w-10" />
              <span className="text-sm font-semibold">{isRu ? "Проблем не обнаружено!" : "No issues found!"}</span>
              <p className="text-xs text-muted-foreground">{isRu ? "Ваш сайт прошёл все проверки Вебмастера" : "Your site passed all Webmaster checks"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_200px] gap-4">
              {/* Problems list */}
              <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
                {filteredProblems.map((p: any, i: number) => {
                  const sev = p.severity === "WARN" ? "WARNING" : p.severity;
                  const colors = SEVERITY_COLORS[sev as keyof typeof SEVERITY_COLORS] || SEVERITY_COLORS.INFO;
                  return (
                    <div
                      key={i}
                      className={cn("rounded-lg border px-4 py-3 flex items-start gap-3 transition-colors", colors.border, colors.bg)}
                    >
                      <AlertCircle className={cn("h-4 w-4 mt-0.5 shrink-0", colors.text)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground">{p.problem || p.title || p.type || "Unknown"}</p>
                        {p.affect && <p className="text-xs text-muted-foreground mt-0.5">{p.affect}</p>}
                        {p.count !== undefined && (
                          <span className="text-xs text-muted-foreground">
                            {isRu ? "Кол-во" : "Count"}: <span className="font-medium">{p.count}</span>
                          </span>
                        )}
                      </div>
                      <Badge variant="outline" className={cn("text-[10px] shrink-0", colors.badge)}>
                        {sev}
                      </Badge>
                    </div>
                  );
                })}
              </div>

              {/* Pie summary */}
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

function DeltaBadge({ delta }: { delta: number }) {
  if (delta === 0) return null;
  const positive = delta > 0;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[11px] font-medium px-1.5 py-0.5 rounded-full",
      positive ? "text-emerald-600 bg-emerald-500/10" : "text-destructive bg-destructive/10"
    )}>
      {positive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
      {positive ? "+" : ""}{delta}
    </span>
  );
}
