import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ExternalLink, Search, TrendingUp, TrendingDown,
  Minus, Settings, Trophy, RefreshCw, Loader2,
  KeyRound, CheckCircle2, AlertCircle, Link as LinkIcon,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Legend,
} from "recharts";
import { GlassCard, StandardKpiCard, MetricTooltip, useTabRefresh, TabLoadingOverlay } from "./shared-ui";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface PositionsTabProps {
  projectId: string;
  hasTopvisor?: boolean;
  topvisorApiKey?: string | null;
  topvisorUserId?: string | null;
  topvisorExternalProjectId?: string | null;
  integrationId?: string | null;
  onNavigateSettings?: () => void;
}

interface TvProject {
  id: number;
  name: string;
  site: string;
}

interface KeywordPosition {
  keyword: string;
  position: number | null;
  prevPosition: number | null;
  url: string;
  volume: number;
}

/* ═══════════════════════════════════════════════════════
   API helper
   ═══════════════════════════════════════════════════════ */
async function callTopvisor(action: string, apiKey: string, userId: string, payload?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");

  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(`https://${projectRef}.supabase.co/functions/v1/topvisor-api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, api_key: apiKey, user_id: userId, payload }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || "API error");
  return data;
}

/* ═══════════════════════════════════════════════════════
   Setup Form (Empty State)
   ═══════════════════════════════════════════════════════ */
function TopvisorSetupForm({ projectId, onConnected }: { projectId: string; onConnected: () => void }) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const [testing, setTesting] = useState(false);

  const handleTest = async () => {
    if (!apiKey.trim() || !userId.trim()) {
      toast.error(isRu ? "Заполните оба поля" : "Fill in both fields");
      return;
    }
    setTesting(true);
    try {
      await callTopvisor("test-connection", apiKey.trim(), userId.trim());
      // Save to integrations table
      const existing = await supabase.from("integrations").select("id").eq("project_id", projectId).eq("service_name", "topvisor").maybeSingle();
      if (existing.data) {
        await supabase.from("integrations").update({
          api_key: apiKey.trim(),
          counter_id: userId.trim(),
          connected: true,
          last_sync: new Date().toISOString(),
        }).eq("id", existing.data.id);
      } else {
        await supabase.from("integrations").insert({
          project_id: projectId,
          service_name: "topvisor",
          api_key: apiKey.trim(),
          counter_id: userId.trim(),
          connected: true,
          last_sync: new Date().toISOString(),
        });
      }
      toast.success(isRu ? "Topvisor подключен!" : "Topvisor connected!");
      onConnected();
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Trophy className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isRu ? "Подключите Topvisor" : "Connect Topvisor"}
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        {isRu
          ? "Введите User ID и API Key из личного кабинета Topvisor для автоматического отслеживания позиций."
          : "Enter your User ID and API Key from Topvisor to automatically track keyword positions."}
      </p>

      <GlassCard className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>User ID *</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="12345" />
          </div>
          <div className="space-y-2">
            <Label>API Key *</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="tv_xxxxxxxxxxxxxxxx" type="password" />
          </div>
          <a
            href="https://topvisor.com/ru/support/api/getting-started/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            <LinkIcon className="h-3 w-3" />
            {isRu ? "Где взять ключи в Topvisor?" : "Where to get Topvisor keys?"}
          </a>
          <Button onClick={handleTest} disabled={testing} className="w-full gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isRu ? "Проверить подключение" : "Test Connection"}
          </Button>
        </CardContent>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Project Selector
   ═══════════════════════════════════════════════════════ */
function TopvisorProjectSelector({
  apiKey, userId, projectId, currentExternalId, integrationId, onSelect,
}: {
  apiKey: string;
  userId: string;
  projectId: string;
  currentExternalId: string | null;
  integrationId: string;
  onSelect: (tvProjectId: string) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const queryClient = useQueryClient();

  const { data: tvProjects, isLoading } = useQuery({
    queryKey: ["topvisor-projects", apiKey, userId],
    queryFn: async () => {
      const data = await callTopvisor("get-projects", apiKey, userId);
      return (data?.result || []) as TvProject[];
    },
  });

  const linkMutation = useMutation({
    mutationFn: async (tvId: string) => {
      await supabase.from("integrations").update({ external_project_id: tvId }).eq("id", integrationId);
    },
    onSuccess: (_, tvId) => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      onSelect(tvId);
      toast.success(isRu ? "Проект привязан" : "Project linked");
    },
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-3">
        <Skeleton className="h-9 w-[280px]" />
        <Skeleton className="h-9 w-9" />
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3 flex-wrap">
      <Select
        value={currentExternalId || ""}
        onValueChange={(v) => linkMutation.mutate(v)}
      >
        <SelectTrigger className="w-[320px] h-9 text-sm">
          <SelectValue placeholder={isRu ? "Выберите проект Topvisor…" : "Select Topvisor project…"} />
        </SelectTrigger>
        <SelectContent>
          {tvProjects?.map((p) => (
            <SelectItem key={p.id} value={String(p.id)}>
              {p.name || p.site} — {p.site}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Position color helpers
   ═══════════════════════════════════════════════════════ */
function positionColor(pos: number | null) {
  if (pos === null || pos <= 0) return "text-muted-foreground";
  if (pos <= 3) return "text-amber-400 font-bold";
  if (pos <= 10) return "text-emerald-500 font-bold";
  if (pos <= 30) return "text-primary font-bold";
  return "text-muted-foreground font-bold";
}

/* ═══════════════════════════════════════════════════════
   Main PositionsTab
   ═══════════════════════════════════════════════════════ */
export function PositionsTab({
  projectId,
  hasTopvisor = false,
  topvisorApiKey,
  topvisorUserId,
  topvisorExternalProjectId,
  integrationId,
  onNavigateSettings,
}: PositionsTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const queryClient = useQueryClient();
  const { appliedRange } = useDateRange();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTvProject, setSelectedTvProject] = useState<string | null>(topvisorExternalProjectId || null);

  const tvProjectId = selectedTvProject || topvisorExternalProjectId;
  const apiKey = topvisorApiKey;
  const userId = topvisorUserId;

  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  // If no integration, show setup form
  if (!hasTopvisor || !apiKey || !userId) {
    return (
      <TopvisorSetupForm
        projectId={projectId}
        onConnected={() => queryClient.invalidateQueries({ queryKey: ["integrations", projectId] })}
      />
    );
  }

  // If no project selected, show selector only
  if (!tvProjectId) {
    return (
      <div className="space-y-6">
        <GlassCard>
          <CardContent className="p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4">
              {isRu ? "Выберите проект Topvisor" : "Select Topvisor project"}
            </h3>
            <p className="text-xs text-muted-foreground mb-4">
              {isRu
                ? "Привяжите один из ваших проектов Topvisor к этому проекту StatPulse."
                : "Link one of your Topvisor projects to this StatPulse project."}
            </p>
            <TopvisorProjectSelector
              apiKey={apiKey}
              userId={userId}
              projectId={projectId}
              currentExternalId={null}
              integrationId={integrationId!}
              onSelect={setSelectedTvProject}
            />
          </CardContent>
        </GlassCard>
      </div>
    );
  }

  return (
    <PositionsDashboard
      apiKey={apiKey}
      userId={userId}
      tvProjectId={tvProjectId}
      projectId={projectId}
      integrationId={integrationId!}
      dateFrom={dateFrom}
      dateTo={dateTo}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      selectedTvProject={selectedTvProject}
      setSelectedTvProject={setSelectedTvProject}
      isRefreshing={isRefreshing}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Dashboard (after project selected)
   ═══════════════════════════════════════════════════════ */
function PositionsDashboard({
  apiKey, userId, tvProjectId, projectId, integrationId,
  dateFrom, dateTo, searchQuery, setSearchQuery,
  selectedTvProject, setSelectedTvProject, isRefreshing,
}: {
  apiKey: string;
  userId: string;
  tvProjectId: string;
  projectId: string;
  integrationId: string;
  dateFrom: string;
  dateTo: string;
  searchQuery: string;
  setSearchQuery: (v: string) => void;
  selectedTvProject: string | null;
  setSelectedTvProject: (v: string) => void;
  isRefreshing: boolean;
}) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const queryClient = useQueryClient();

  // Fetch positions
  const { data: positionsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["topvisor-positions", tvProjectId, dateFrom, dateTo],
    queryFn: async () => {
      const data = await callTopvisor("get-positions", apiKey, userId, {
        project_id: tvProjectId,
        regions_indexes: [0],
        date1: dateFrom,
        date2: dateTo,
        show_headers: 1,
        positions_fields: ["position"],
      });
      return data;
    },
    retry: 1,
  });

  // Parse the response into our format
  const keywords: KeywordPosition[] = useMemo(() => {
    if (!positionsData?.result) return [];

    const result = positionsData.result;
    const headers = result.headers || [];
    const rows = result.keywords || [];

    // headers is an array of date strings; last two are date2 and date1
    const dateKeys = headers;
    const lastIdx = dateKeys.length - 1;
    const prevIdx = lastIdx - 1;

    return rows.map((row: any) => {
      const positions = row.positionsData?.[0]?.positions || {};
      const lastDate = dateKeys[lastIdx];
      const prevDate = prevIdx >= 0 ? dateKeys[prevIdx] : null;

      const currentPos = lastDate ? (positions[lastDate]?.position ?? null) : null;
      const prevPos = prevDate ? (positions[prevDate]?.position ?? null) : null;

      return {
        keyword: row.name || "",
        position: currentPos !== null ? Number(currentPos) : null,
        prevPosition: prevPos !== null ? Number(prevPos) : null,
        url: row.landing_page || "",
        volume: row.target || 0,
      } as KeywordPosition;
    });
  }, [positionsData]);

  // Filtered keywords
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return keywords;
    const q = searchQuery.toLowerCase();
    return keywords.filter((k) => k.keyword.toLowerCase().includes(q));
  }, [keywords, searchQuery]);

  // KPI calculations
  const withPos = filtered.filter((k) => k.position !== null && k.position > 0);
  const avgPos = withPos.length > 0 ? withPos.reduce((s, k) => s + k.position!, 0) / withPos.length : 0;
  const prevAvgPos = withPos.filter(k => k.prevPosition).length > 0
    ? withPos.filter(k => k.prevPosition).reduce((s, k) => s + (k.prevPosition || 0), 0) / withPos.filter(k => k.prevPosition).length
    : 0;
  const posChange = prevAvgPos > 0 ? prevAvgPos - avgPos : 0;

  const top3 = withPos.filter((k) => k.position! <= 3).length;
  const top10 = withPos.filter((k) => k.position! <= 10).length;
  const top30 = withPos.filter((k) => k.position! <= 30).length;
  const outside = withPos.length - top30;
  const total = withPos.length || 1;
  const visibility = Math.round((top10 / total) * 100);

  const ups = withPos.filter((k) => k.prevPosition && k.position! < k.prevPosition).length;
  const downs = withPos.filter((k) => k.prevPosition && k.position! > k.prevPosition).length;
  const stable = withPos.filter((k) => k.prevPosition && k.position === k.prevPosition).length;

  const handleSync = () => {
    refetch();
    toast.success(isRu ? "Данные обновлены" : "Data refreshed");
  };

  // No data state
  if (!isLoading && !isError && keywords.length === 0) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3 flex-wrap">
          <TopvisorProjectSelector
            apiKey={apiKey} userId={userId} projectId={projectId}
            currentExternalId={tvProjectId} integrationId={integrationId}
            onSelect={setSelectedTvProject}
          />
          <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync}>
            <RefreshCw className="h-3.5 w-3.5" /> {t("integrations.sync")}
          </Button>
        </div>
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {isRu ? "Нет данных за выбранный период" : "No data for selected period"}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {isRu
              ? "В Topvisor нет данных по позициям за выбранные даты. Попробуйте другой период."
              : "Topvisor has no position data for the selected dates. Try a different period."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      {/* Project selector + sync */}
      <div className="flex items-center gap-3 flex-wrap">
        <TopvisorProjectSelector
          apiKey={apiKey} userId={userId} projectId={projectId}
          currentExternalId={tvProjectId} integrationId={integrationId}
          onSelect={setSelectedTvProject}
        />
        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync}>
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          {isRu ? "Синхронизировать" : "Sync Now"}
        </Button>
      </div>

      {/* Loading skeleton */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <GlassCard key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
            ))}
          </div>
          <GlassCard><CardContent className="p-5"><Skeleton className="h-[260px]" /></CardContent></GlassCard>
          <GlassCard><CardContent className="p-5"><Skeleton className="h-[300px]" /></CardContent></GlassCard>
        </div>
      ) : isError ? (
        <GlassCard>
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">{(error as Error)?.message || "Error loading data"}</p>
            </div>
          </CardContent>
        </GlassCard>
      ) : (
        <>
          {/* KPI row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StandardKpiCard
              label={t("positions.avgPosition")}
              value={avgPos > 0 ? avgPos.toFixed(1) : "—"}
              change={posChange}
              invertChange
              tooltipKey="avgPosition"
              loading={isRefreshing}
            />
            <StandardKpiCard
              label={t("positions.visibility")}
              value={`${visibility}%`}
              change={0}
              loading={isRefreshing}
            />

            {/* Distribution bar */}
            <GlassCard>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground font-medium">{t("positions.distribution")}</span>
                  <MetricTooltip metricKey="avgPosition" />
                </div>
                <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                  {top3 > 0 && <div className="bg-amber-400" style={{ width: `${(top3 / total) * 100}%` }} />}
                  {(top10 - top3) > 0 && <div className="bg-emerald-500" style={{ width: `${((top10 - top3) / total) * 100}%` }} />}
                  {(top30 - top10) > 0 && <div className="bg-primary" style={{ width: `${((top30 - top10) / total) * 100}%` }} />}
                  {outside > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(outside / total) * 100}%` }} />}
                </div>
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Top 3: {top3}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Top 10: {top10 - top3}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Top 30: {top30 - top10}</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />{t("positions.outside")}: {outside}</span>
                </div>
              </CardContent>
            </GlassCard>

            {/* Ups/Downs */}
            <GlassCard>
              <CardContent className="p-4 space-y-2">
                <span className="text-xs text-muted-foreground font-medium">{t("positions.movement")}</span>
                <div className="flex items-baseline gap-4">
                  <div className="flex items-center gap-1 text-emerald-500">
                    <TrendingUp className="h-4 w-4" /><span className="text-lg font-bold">{ups}</span>
                  </div>
                  <div className="flex items-center gap-1 text-destructive">
                    <TrendingDown className="h-4 w-4" /><span className="text-lg font-bold">{downs}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Minus className="h-4 w-4" /><span className="text-lg font-bold">{stable}</span>
                  </div>
                </div>
                <p className="text-[10px] text-muted-foreground">{t("positions.movementHint")}</p>
              </CardContent>
            </GlassCard>
          </div>

          {/* Search filter */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("positions.searchPlaceholder")}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Queries table */}
          <GlassCard>
            <CardContent className="p-0">
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-foreground">{t("positions.tableTitle")}</h3>
                <p className="text-xs text-muted-foreground">{t("positions.tableSubtitle", { count: filtered.length })}</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground">{t("positions.colQuery")}</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">{t("positions.colPosition")}</th>
                      <th className="text-center p-3 font-medium text-muted-foreground">{t("positions.colDelta")}</th>
                      <th className="text-left p-3 font-medium text-muted-foreground">{t("positions.colUrl")}</th>
                      <th className="text-right p-3 font-medium text-muted-foreground">{t("positions.colFreq")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((k, i) => {
                      const delta = k.prevPosition && k.position ? k.prevPosition - k.position : null;
                      return (
                        <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-foreground font-medium">{k.keyword}</td>
                          <td className="p-3 text-center">
                            <span className={cn("text-base", positionColor(k.position))}>
                              {k.position ?? "—"}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            {delta !== null && delta > 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-emerald-500 font-medium">
                                <TrendingUp className="h-3.5 w-3.5" />+{delta}
                              </span>
                            ) : delta !== null && delta < 0 ? (
                              <span className="inline-flex items-center gap-0.5 text-destructive font-medium">
                                <TrendingDown className="h-3.5 w-3.5" />{delta}
                              </span>
                            ) : (
                              <span className="text-muted-foreground"><Minus className="h-3.5 w-3.5 inline" /></span>
                            )}
                          </td>
                          <td className="p-3">
                            {k.url ? (
                              <a
                                href={k.url.startsWith("http") ? k.url : `https://${k.url}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 text-xs text-primary hover:underline max-w-[200px] truncate"
                              >
                                {k.url} <ExternalLink className="h-3 w-3 shrink-0" />
                              </a>
                            ) : (
                              <span className="text-xs text-muted-foreground">—</span>
                            )}
                          </td>
                          <td className="p-3 text-right text-muted-foreground">{k.volume > 0 ? k.volume.toLocaleString() : "—"}</td>
                        </tr>
                      );
                    })}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-muted-foreground">
                          {isRu ? "Ничего не найдено" : "Nothing found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </GlassCard>
        </>
      )}
    </div>
  );
}
