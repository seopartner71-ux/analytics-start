import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Search, TrendingUp, TrendingDown,
  Minus, Trophy, RefreshCw, Loader2,
  KeyRound, CheckCircle2, AlertCircle, Link as LinkIcon,
  ArrowUp, ArrowDown, Filter,
} from "lucide-react";
import { GlassCard, StandardKpiCard, useTabRefresh, TabLoadingOverlay } from "./shared-ui";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface PositionsTabProps {
  projectId: string;
  projectName?: string;
  projectUrl?: string | null;
  hasTopvisor?: boolean;
  topvisorApiKey?: string | null;
  topvisorUserId?: string | null;
  topvisorExternalProjectId?: string | null;
  integrationId?: string | null;
  onNavigateSettings?: () => void;
}

interface TvRegion {
  index: string;
  name: string;
  areaName?: string;
  device_name?: string;
  searcher_key: number;
}

interface TvSearcher {
  key: number;
  name: string;
  regions: TvRegion[];
}

interface TvProject {
  id: number;
  name: string;
  site: string;
  searchers?: TvSearcher[];
}

interface KeywordRow {
  keyword: string;
  group?: string;
  isBrand: boolean;
  /** position per date, keyed by "date:regionIndex" */
  positions: Record<string, number | null>;
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
  const { i18n } = useTranslation();
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
      await supabase.from("projects").update({
        topvisor_api_key: apiKey.trim(),
        topvisor_user_id: userId.trim(),
      } as any).eq("id", projectId);
      const existing = await supabase.from("integrations").select("id").eq("project_id", projectId).eq("service_name", "topvisor").maybeSingle();
      if (existing.data) {
        await supabase.from("integrations").update({
          api_key: apiKey.trim(), counter_id: userId.trim(), connected: true, last_sync: new Date().toISOString(),
        }).eq("id", existing.data.id);
      } else {
        await supabase.from("integrations").insert({
          project_id: projectId, service_name: "topvisor", api_key: apiKey.trim(),
          counter_id: userId.trim(), connected: true, last_sync: new Date().toISOString(),
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
          <a href="https://topvisor.com/ru/support/api/getting-started/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
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
   Position color helpers
   ═══════════════════════════════════════════════════════ */
function positionColor(pos: number | null) {
  if (pos === null || pos <= 0) return "text-muted-foreground";
  if (pos <= 3) return "text-amber-400 font-bold";
  if (pos <= 10) return "text-emerald-500 font-bold";
  if (pos <= 30) return "text-primary font-bold";
  return "text-muted-foreground font-bold";
}

function positionBg(pos: number | null) {
  if (pos === null || pos <= 0) return "";
  if (pos <= 3) return "bg-amber-400/10";
  if (pos <= 10) return "bg-emerald-500/10";
  if (pos <= 30) return "bg-primary/10";
  return "";
}

/* ═══════════════════════════════════════════════════════
   Brand detection
   ═══════════════════════════════════════════════════════ */
function isBrandKeyword(keyword: string, projectUrl?: string | null): boolean {
  const lower = keyword.toLowerCase();
  // Extract domain name without TLD for brand detection
  if (projectUrl) {
    const domain = projectUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").split(".")[0];
    if (domain && domain.length > 2 && lower.includes(domain.toLowerCase())) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════
   Main PositionsTab
   ═══════════════════════════════════════════════════════ */
export function PositionsTab({
  projectId, projectName, projectUrl,
  hasTopvisor = false, topvisorApiKey, topvisorUserId,
  topvisorExternalProjectId, integrationId, onNavigateSettings,
}: PositionsTabProps) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const queryClient = useQueryClient();
  const { appliedRange } = useDateRange();

  const [searchQuery, setSearchQuery] = useState("");
  const [showReconnect, setShowReconnect] = useState(false);
  const [brandFilter, setBrandFilter] = useState<"all" | "brand" | "nonbrand">("all");

  const tvProjectId = topvisorExternalProjectId;
  const apiKey = topvisorApiKey;
  const userId = topvisorUserId;

  if (!hasTopvisor || !apiKey || !userId || showReconnect) {
    return (
      <TopvisorSetupForm
        projectId={projectId}
        onConnected={() => {
          setShowReconnect(false);
          queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
        }}
      />
    );
  }

  if (!tvProjectId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isRu ? "Проект Topvisor не привязан" : "Topvisor project not linked"}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {isRu
            ? "Привяжите проект Topvisor в настройках интеграции."
            : "Link a Topvisor project in integration settings."}
        </p>
      </div>
    );
  }

  return (
    <PositionsDashboard
      apiKey={apiKey}
      userId={userId}
      tvProjectId={tvProjectId}
      projectId={projectId}
      projectName={projectName}
      projectUrl={projectUrl}
      integrationId={integrationId!}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      brandFilter={brandFilter}
      setBrandFilter={setBrandFilter}
      isRefreshing={isRefreshing}
      onReconnect={() => setShowReconnect(true)}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Dashboard with Google/Yandex tabs & date columns
   ═══════════════════════════════════════════════════════ */
function PositionsDashboard({
  apiKey, userId, tvProjectId, projectId, projectName, projectUrl, integrationId,
  searchQuery, setSearchQuery, brandFilter, setBrandFilter, isRefreshing, onReconnect,
}: {
  apiKey: string; userId: string; tvProjectId: string; projectId: string;
  projectName?: string; projectUrl?: string | null; integrationId: string;
  searchQuery: string; setSearchQuery: (v: string) => void;
  brandFilter: "all" | "brand" | "nonbrand"; setBrandFilter: (v: "all" | "brand" | "nonbrand") => void;
  isRefreshing: boolean; onReconnect?: () => void;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  const [regions, setRegions] = useState<TvRegion[]>([]);

  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  // Load regions from projects
  const { data: regionsData } = useQuery({
    queryKey: ["topvisor-regions", tvProjectId, apiKey, userId],
    queryFn: async () => {
      const data = await callTopvisor("get-projects", apiKey, userId);
      const projects = (data?.result || []) as TvProject[];
      const found = projects.find((p) => String(p.id) === tvProjectId);
      if (!found?.searchers) return { searchers: [] as TvSearcher[], allRegions: [] as TvRegion[] };

      const allRegions = found.searchers.flatMap((s) =>
        (s.regions || []).map((r) => ({ ...r, searcher_key: s.key }))
      );
      setRegions(allRegions);
      return { searchers: found.searchers, allRegions };
    },
  });

  // Group regions by searcher
  const searcherTabs = useMemo(() => {
    const tabs: { key: string; name: string; regionIndexes: string[] }[] = [];
    const searchers = regionsData?.searchers || [];
    for (const s of searchers) {
      const name = s.key === 0 ? "Yandex" : s.key === 1 ? "Google" : `SE ${s.key}`;
      const indexes = (s.regions || []).map((r) => String(r.index));
      if (indexes.length > 0) {
        tabs.push({ key: String(s.key), name, regionIndexes: indexes });
      }
    }
    return tabs;
  }, [regionsData]);

  // Collect ALL region indexes for the API call
  const allRegionIndexes = useMemo(() => {
    return regions.map((r) => Number(r.index)).filter((n) => n > 0);
  }, [regions]);

  // Fetch rankings history with all regions
  const { data: rankingsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["topvisor-rankings-history", tvProjectId, dateFrom, dateTo, allRegionIndexes.join(",")],
    queryFn: async () => {
      const data = await callTopvisor("get-rankings-history", apiKey, userId, {
        project_id: tvProjectId,
        regions_indexes: allRegionIndexes,
        date_from: dateFrom,
        date_to: dateTo,
      });
      return data;
    },
    enabled: allRegionIndexes.length > 0,
    retry: 1,
  });

  // Parse response into structured data
  const { dates, keywordRows } = useMemo(() => {
    if (!rankingsData?.result) return { dates: [] as string[], keywordRows: [] as KeywordRow[] };

    const result = rankingsData.result;
    const headerDates: string[] = Array.isArray(result?.headers?.dates) ? result.headers.dates : [];
    const existsDates: string[] = Array.isArray(result?.exists_dates) ? result.exists_dates : headerDates;
    const rows = Array.isArray(result?.keywords) ? result.keywords : [];

    // Use exists_dates if available, otherwise header dates
    const allDates = existsDates.length > 0 ? existsDates : headerDates;
    // Take last 7 dates, sorted newest first
    const displayDates = [...allDates].sort().slice(-7).reverse();

    const kwRows: KeywordRow[] = rows.map((row: any) => {
      const positionsObj = row.positionsData && typeof row.positionsData === "object" ? row.positionsData : {};
      const positions: Record<string, number | null> = {};

      // positionsData keys are "date:projectId:regionIndex"
      for (const [key, val] of Object.entries(positionsObj)) {
        const parts = key.split(":");
        const date = parts[0];
        const regionIdx = parts[2] || parts[1]; // "date:projectId:regionIdx"

        const posVal = (val as any)?.position;
        let numPos: number | null = null;
        if (posVal !== null && posVal !== undefined && posVal !== "--" && posVal !== "" && posVal !== "0") {
          const n = Number(posVal);
          numPos = Number.isFinite(n) && n > 0 ? n : null;
        }

        positions[`${date}:${regionIdx}`] = numPos;
      }

      return {
        keyword: row.name || "",
        group: row.group_name || undefined,
        isBrand: isBrandKeyword(row.name || "", projectUrl),
        positions,
      };
    });

    return { dates: displayDates, keywordRows: kwRows };
  }, [rankingsData, projectUrl]);

  // Filter keywords
  const filtered = useMemo(() => {
    let result = keywordRows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    if (brandFilter === "brand") result = result.filter((k) => k.isBrand);
    if (brandFilter === "nonbrand") result = result.filter((k) => !k.isBrand);
    return result;
  }, [keywordRows, searchQuery, brandFilter]);

  const handleSync = () => {
    refetch();
    toast.success(isRu ? "Данные обновлены" : "Data refreshed");
  };

  /* ── Render table for a specific searcher ── */
  const renderTable = (regionIndexes: string[], searcherName: string) => {
    // For each keyword, extract positions only for these regions
    const hasAnyData = filtered.some((kw) =>
      dates.some((d) => regionIndexes.some((ri) => kw.positions[`${d}:${ri}`] !== undefined))
    );

    if (!hasAnyData && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {isRu ? "Нет данных о проверках за выбранный период" : "No ranking data for selected period"}
          </p>
        </div>
      );
    }

    // KPI for this searcher
    const allPositions: number[] = [];
    const prevPositions: number[] = [];
    filtered.forEach((kw) => {
      const latestDate = dates[0];
      const prevDate = dates[1];
      regionIndexes.forEach((ri) => {
        const cur = kw.positions[`${latestDate}:${ri}`];
        const prev = kw.positions[`${prevDate}:${ri}`];
        if (cur !== null && cur !== undefined) allPositions.push(cur);
        if (prev !== null && prev !== undefined) prevPositions.push(prev);
      });
    });

    const avgPos = allPositions.length > 0 ? allPositions.reduce((a, b) => a + b, 0) / allPositions.length : 0;
    const prevAvgPos = prevPositions.length > 0 ? prevPositions.reduce((a, b) => a + b, 0) / prevPositions.length : 0;
    const posChange = prevAvgPos > 0 ? prevAvgPos - avgPos : 0;

    const top3 = allPositions.filter((p) => p <= 3).length;
    const top10 = allPositions.filter((p) => p <= 10).length;
    const top30 = allPositions.filter((p) => p <= 30).length;
    const outside = allPositions.length - top30;
    const total = allPositions.length || 1;
    const visibility = Math.round((top10 / total) * 100);

    return (
      <div className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StandardKpiCard
            label={isRu ? "Средняя позиция" : "Avg Position"}
            value={avgPos > 0 ? avgPos.toFixed(1) : "—"}
            change={posChange}
            invertChange
            tooltipKey="avgPosition"
            loading={isRefreshing}
          />
          <StandardKpiCard
            label={isRu ? "Видимость" : "Visibility"}
            value={`${visibility}%`}
            change={0}
            loading={isRefreshing}
          />
          <GlassCard>
            <CardContent className="p-4 space-y-2">
              <span className="text-xs text-muted-foreground font-medium">
                {isRu ? "Распределение" : "Distribution"}
              </span>
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
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />{isRu ? "Вне" : "Out"}: {outside}</span>
              </div>
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="p-4 space-y-2">
              <span className="text-xs text-muted-foreground font-medium">
                {isRu ? "Запросов" : "Keywords"}
              </span>
              <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
              <p className="text-[10px] text-muted-foreground">
                {isRu ? `${searcherName} • ${regionIndexes.length} рег.` : `${searcherName} • ${regionIndexes.length} reg.`}
              </p>
            </CardContent>
          </GlassCard>
        </div>

        {/* Rankings table with date columns */}
        <GlassCard>
          <CardContent className="p-0">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {isRu ? "Запросы и позиции" : "Keywords & Positions"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {filtered.length} {isRu ? "запросов" : "keywords"} • {searcherName}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[200px]">
                      {isRu ? "Запрос" : "Keyword"}
                    </th>
                    <th className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[60px]">
                      {isRu ? "Группа" : "Group"}
                    </th>
                    {dates.map((date) => (
                      <th key={date} className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[70px]">
                        {date.slice(5).replace("-", ".")}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((kw, i) => (
                    <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                      <td className="p-3 sticky left-0 bg-background z-10">
                        <div className="flex items-center gap-2">
                          <span className="text-foreground font-medium text-sm truncate max-w-[250px]">
                            {kw.keyword}
                          </span>
                          {kw.isBrand && (
                            <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400/50 text-amber-400 shrink-0">
                              Brand
                            </Badge>
                          )}
                        </div>
                      </td>
                      <td className="p-2 text-center text-xs text-muted-foreground truncate max-w-[80px]">
                        {kw.group || "—"}
                      </td>
                      {dates.map((date, dateIdx) => {
                        // Find position for this date across all region indexes for this searcher
                        let pos: number | null = null;
                        for (const ri of regionIndexes) {
                          const p = kw.positions[`${date}:${ri}`];
                          if (p !== null && p !== undefined) { pos = p; break; }
                        }

                        // Previous date for delta
                        let prevPos: number | null = null;
                        const prevDate = dates[dateIdx + 1];
                        if (prevDate) {
                          for (const ri of regionIndexes) {
                            const p = kw.positions[`${prevDate}:${ri}`];
                            if (p !== null && p !== undefined) { prevPos = p; break; }
                          }
                        }

                        const delta = prevPos !== null && pos !== null ? prevPos - pos : null;

                        return (
                          <td key={date} className={cn("p-2 text-center", positionBg(pos))}>
                            <div className="flex flex-col items-center">
                              <span className={cn("text-sm", positionColor(pos))}>
                                {pos ?? "—"}
                              </span>
                              {delta !== null && delta !== 0 && (
                                <span className={cn(
                                  "text-[9px] flex items-center gap-0.5",
                                  delta > 0 ? "text-emerald-500" : "text-destructive"
                                )}>
                                  {delta > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                                  {Math.abs(delta)}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={dates.length + 2} className="p-8 text-center text-muted-foreground">
                        {isRu ? "Ничего не найдено" : "Nothing found"}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </GlassCard>
      </div>
    );
  };

  /* ── Loading skeleton ── */
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
        ))}
      </div>
      <GlassCard>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </GlassCard>
    </div>
  );

  return (
    <div className="space-y-5 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60">
          <span className="text-xs font-medium text-foreground">{projectName || "—"}</span>
          {projectUrl && (
            <>
              <span className="text-xs text-muted-foreground">—</span>
              <span className="text-xs text-primary font-medium">{projectUrl.replace(/^https?:\/\//, "")}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground">
          {dateFrom.slice(5).replace("-", ".")} — {dateTo.slice(5).replace("-", ".")}
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync}>
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          {isRu ? "Обновить" : "Refresh"}
        </Button>

        {/* Brand filter */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={brandFilter === "all" ? "secondary" : "ghost"}
            size="sm" className="text-xs h-7 px-2"
            onClick={() => setBrandFilter("all")}
          >
            {isRu ? "Все" : "All"}
          </Button>
          <Button
            variant={brandFilter === "brand" ? "secondary" : "ghost"}
            size="sm" className="text-xs h-7 px-2"
            onClick={() => setBrandFilter("brand")}
          >
            Brand
          </Button>
          <Button
            variant={brandFilter === "nonbrand" ? "secondary" : "ghost"}
            size="sm" className="text-xs h-7 px-2"
            onClick={() => setBrandFilter("nonbrand")}
          >
            Non-brand
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isRu ? "Поиск по запросу…" : "Search keywords…"}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Error */}
      {isError && (
        <GlassCard>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">{(error as Error)?.message || "Error loading data"}</p>
            </div>
            {onReconnect && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onReconnect}>
                <KeyRound className="h-3.5 w-3.5" />
                {isRu ? "Переподключить" : "Reconnect"}
              </Button>
            )}
          </CardContent>
        </GlassCard>
      )}

      {/* Searcher tabs */}
      {!isError && (
        searcherTabs.length > 0 ? (
          <Tabs defaultValue={searcherTabs[0]?.key} className="space-y-4">
            <TabsList className="bg-muted/50">
              {searcherTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs gap-1.5">
                  {tab.name}
                </TabsTrigger>
              ))}
            </TabsList>
            {searcherTabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                {isLoading ? renderSkeleton() : renderTable(tab.regionIndexes, tab.name)}
              </TabsContent>
            ))}
          </Tabs>
        ) : isLoading ? (
          renderSkeleton()
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {isRu ? "Нет данных о регионах" : "No regions found"}
            </p>
          </div>
        )
      )}
    </div>
  );
}
