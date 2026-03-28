import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Globe, Loader2,
  ExternalLink, AlertCircle, Link as LinkIcon, Shield,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  GlassCard, StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip, MetricTooltip,
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
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(`https://${projectRef}.supabase.co/functions/v1/yandex-webmaster`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, access_token: accessToken, ...extra }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || "Webmaster API error");
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
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const queryClient = useQueryClient();

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
function SiteHealthDashboard({ projectId, accessToken, hostId }: {
  projectId: string; accessToken: string; hostId: string;
}) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const [recrawlUrl, setRecrawlUrl] = useState("");
  const [recrawling, setRecrawling] = useState(false);

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

  // Parse SQI
  const sqiHistory = sqiData?.points || sqiData?.sqi_history || [];
  const currentSqi = sqiHistory.length > 0 ? sqiHistory[sqiHistory.length - 1]?.sqi ?? 0 : (sqiData?.sqi ?? 0);

  // Parse summary
  const pagesInSearch = summaryData?.searchable_pages_count ?? summaryData?.sites_count ?? 0;

  // Parse backlinks
  const backlinksCount = (() => {
    if (backlinksData?.indicators) {
      const vals = Object.values(backlinksData.indicators) as any[];
      if (vals.length > 0 && Array.isArray(vals[0])) {
        const last = vals[0][vals[0].length - 1];
        return last?.value ?? 0;
      }
    }
    return backlinksData?.links_total_count ?? 0;
  })();

  // Parse diagnostics
  const problems = Array.isArray(diagnosticsData?.problems)
    ? diagnosticsData.problems
    : Array.isArray(diagnosticsData)
      ? diagnosticsData
      : [];

  const criticalCount = problems.filter((p: any) => p.severity === "CRITICAL" || p.severity === "critical").length;

  // Parse indexing chart
  const indexingChart = useMemo(() => {
    const history = indexingData?.indicators || indexingData?.history || {};
    const searchable = history?.SEARCHABLE || history?.searchable || [];
    if (Array.isArray(searchable) && searchable.length > 0) {
      return searchable.map((item: any) => ({
        day: item.date ? format(new Date(item.date), "dd.MM") : "",
        pages: item.value ?? 0,
      }));
    }
    return [];
  }, [indexingData]);

  const handleRecrawl = async () => {
    setRecrawling(true);
    try {
      await callWebmaster("recrawl", accessToken, {
        host_id: hostId,
        url: recrawlUrl.trim() || hostId,
      });
      toast.success(isRu ? "Запрос на переобход отправлен успешно" : "Recrawl request sent successfully");
      setRecrawlUrl("");
    } catch (e: any) {
      toast.error(e.message || "Recrawl failed");
    } finally {
      setRecrawling(false);
    }
  };

  const anyLoading = sqiLoading || summaryLoading || indexingLoading || diagLoading || backlinksLoading;

  return (
    <div className="space-y-6 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {sqiLoading ? (
          <GlassCard><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
        ) : (
          <StandardKpiCard
            label={isRu ? "ИКС (SQI)" : "SQI"}
            value={currentSqi}
            change={0}
            tooltipKey="sqi"
            loading={false}
          />
        )}
        {summaryLoading ? (
          <GlassCard><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
        ) : (
          <StandardKpiCard
            label={isRu ? "Страниц в поиске" : "Pages in search"}
            value={pagesInSearch.toLocaleString()}
            change={0}
            loading={false}
          />
        )}
        {backlinksLoading ? (
          <GlassCard><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
        ) : (
          <StandardKpiCard
            label={isRu ? "Внешние ссылки" : "Backlinks"}
            value={backlinksCount.toLocaleString()}
            change={0}
            loading={false}
          />
        )}
        {diagLoading ? (
          <GlassCard><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
        ) : (
          <GlassCard>
            <CardContent className="p-4">
              <div className="flex items-center gap-1.5 mb-1">
                <AlertTriangle className={cn("h-4 w-4", criticalCount > 0 ? "text-destructive" : "text-emerald-500")} />
                <span className="text-xs text-muted-foreground font-medium">
                  {isRu ? "Критические ошибки" : "Critical errors"}
                </span>
              </div>
              <p className={cn("text-3xl font-bold", criticalCount > 0 ? "text-destructive" : "text-emerald-500")}>
                {criticalCount}
              </p>
            </CardContent>
          </GlassCard>
        )}
      </div>

      {/* Indexing Chart */}
      <GlassCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {isRu ? "Динамика индексации" : "Indexing History"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {indexingLoading ? (
            <Skeleton className="h-[260px]" />
          ) : indexingChart.length === 0 ? (
            <div className="flex items-center justify-center h-[260px] text-sm text-muted-foreground">
              {isRu ? "Нет данных по индексации" : "No indexing data available"}
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={indexingChart}>
                <defs>
                  <linearGradient id="idxGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Area type="monotone" dataKey="pages" name={isRu ? "Страниц" : "Pages"} stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#idxGrad)" dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </GlassCard>

      {/* Diagnostics */}
      <GlassCard>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            {isRu ? "Диагностика (Технические ошибки)" : "Diagnostics (Technical Errors)"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {diagLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-12" />)}
            </div>
          ) : problems.length === 0 ? (
            <div className="flex items-center gap-3 py-6 justify-center text-emerald-500">
              <CheckCircle2 className="h-6 w-6" />
              <span className="text-sm font-medium">{isRu ? "Проблем не обнаружено" : "No issues found"}</span>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {problems.map((p: any, i: number) => {
                const severity = (p.severity || "").toUpperCase();
                const isCritical = severity === "CRITICAL";
                const isWarning = severity === "WARNING" || severity === "WARN";
                return (
                  <div
                    key={i}
                    className={cn(
                      "rounded-lg border px-4 py-3 flex items-start gap-3",
                      isCritical && "border-destructive/30 bg-destructive/5",
                      isWarning && "border-amber-500/30 bg-amber-500/5",
                      !isCritical && !isWarning && "border-border bg-muted/30",
                    )}
                  >
                    <AlertCircle className={cn(
                      "h-4 w-4 mt-0.5 shrink-0",
                      isCritical && "text-destructive",
                      isWarning && "text-amber-500",
                      !isCritical && !isWarning && "text-muted-foreground",
                    )} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">{p.problem || p.title || p.type || "Unknown"}</p>
                      {p.affect && <p className="text-xs text-muted-foreground mt-0.5">{p.affect}</p>}
                      {p.count !== undefined && (
                        <span className="text-xs text-muted-foreground">
                          {isRu ? "Кол-во" : "Count"}: {p.count}
                        </span>
                      )}
                    </div>
                    <Badge variant="outline" className={cn("text-[10px] shrink-0",
                      isCritical && "border-destructive/40 text-destructive",
                      isWarning && "border-amber-500/40 text-amber-600",
                      !isCritical && !isWarning && "border-border text-muted-foreground",
                    )}>
                      {severity || "INFO"}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </GlassCard>

      {/* Recrawl Action */}
      <GlassCard>
        <CardContent className="p-5 space-y-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {isRu ? "Отправить на переобход" : "Request Recrawl"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {isRu
                ? "Укажите URL для переобхода или оставьте пустым для переобхода главной страницы."
                : "Enter URL to recrawl or leave empty for the main page."}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Input
              value={recrawlUrl}
              onChange={(e) => setRecrawlUrl(e.target.value)}
              placeholder={isRu ? "https://example.com/page" : "https://example.com/page"}
              className="max-w-md h-9 text-sm"
            />
            <Button onClick={handleRecrawl} disabled={recrawling} className="gap-2 shrink-0">
              {recrawling ? (
                <><Loader2 className="h-4 w-4 animate-spin" />{isRu ? "Отправка…" : "Sending…"}</>
              ) : (
                <><RefreshCw className="h-4 w-4" />{isRu ? "Отправить" : "Recrawl"}</>
              )}
            </Button>
          </div>
        </CardContent>
      </GlassCard>
    </div>
  );
}
