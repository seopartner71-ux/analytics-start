import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, TrendingUp, TrendingDown, KeyRound, RefreshCw,
  Loader2, AlertCircle, CalendarIcon, Trophy, CheckCircle2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  StandardKpiCard, useTabRefresh, TabLoadingOverlay, GlassCard,
} from "./shared-ui";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { CardContent as CC } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Link as LinkIcon } from "lucide-react";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface SeoTabProps {
  projectId: string;
  hasTopvisor?: boolean;
  topvisorApiKey?: string | null;
  topvisorUserId?: string | null;
  topvisorExternalProjectId?: string | null;
  integrationId?: string | null;
}

interface TvRegion {
  index: string;
  name: string;
  device_name?: string;
  searcher_key: number;
}

interface TvProject {
  id: number;
  name: string;
  site: string;
  searchers?: { key: number; name: string; regions: TvRegion[] }[];
}

interface KeywordRow {
  keyword: string;
  position: number | null;
  prevPosition: number | null;
}

/* ═══════════════════════════════════════════════════════
   API helper (shared with PositionsTab pattern)
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
   Setup Form
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
        await supabase.from("integrations").update({ api_key: apiKey.trim(), counter_id: userId.trim(), connected: true }).eq("id", existing.data.id);
      } else {
        await supabase.from("integrations").insert({ project_id: projectId, service_name: "topvisor", api_key: apiKey.trim(), counter_id: userId.trim(), connected: true });
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
          ? "Введите User ID и API Key из кабинета Topvisor для получения данных по ключевым словам."
          : "Enter your User ID and API Key from Topvisor to get keyword data."}
      </p>
      <GlassCard className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>User ID *</Label>
            <Input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="12345" />
          </div>
          <div className="space-y-2">
            <Label>API Key *</Label>
            <Input value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder="tv_xxx" type="password" />
          </div>
          <a href="https://topvisor.com/ru/support/api/getting-started/" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <LinkIcon className="h-3 w-3" />
            {isRu ? "Где взять ключи?" : "Where to get keys?"}
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
   Position color
   ═══════════════════════════════════════════════════════ */
function positionColor(pos: number | null) {
  if (pos === null || pos <= 0) return "text-muted-foreground";
  if (pos <= 3) return "text-amber-400 font-bold";
  if (pos <= 10) return "text-emerald-500 font-bold";
  if (pos <= 30) return "text-primary font-bold";
  return "text-muted-foreground font-bold";
}

/* ═══════════════════════════════════════════════════════
   Main SeoTab
   ═══════════════════════════════════════════════════════ */
export function SeoTab({
  projectId,
  hasTopvisor = false,
  topvisorApiKey,
  topvisorUserId,
  topvisorExternalProjectId,
  integrationId,
}: SeoTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const queryClient = useQueryClient();
  const { appliedRange } = useDateRange();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTvProject, setSelectedTvProject] = useState<string | null>(topvisorExternalProjectId || null);
  const [showReconnect, setShowReconnect] = useState(false);

  const tvProjectId = selectedTvProject || topvisorExternalProjectId;
  const apiKey = topvisorApiKey;
  const userId = topvisorUserId;

  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  // Not connected
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

  // No project selected — show project selector
  if (!tvProjectId) {
    return <ProjectSelectorView apiKey={apiKey} userId={userId} projectId={projectId} integrationId={integrationId!} onSelect={setSelectedTvProject} />;
  }

  return (
    <KeywordsDashboard
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
      onReconnect={() => setShowReconnect(true)}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Project selector view
   ═══════════════════════════════════════════════════════ */
function ProjectSelectorView({ apiKey, userId, projectId, integrationId, onSelect }: {
  apiKey: string; userId: string; projectId: string; integrationId: string; onSelect: (id: string) => void;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const queryClient = useQueryClient();

  const { data: tvProjects, isLoading } = useQuery({
    queryKey: ["topvisor-projects", apiKey, userId],
    queryFn: async () => {
      const data = await callTopvisor("get-projects", apiKey, userId);
      return (data?.result || []) as TvProject[];
    },
  });

  const handleSelect = async (tvId: string) => {
    await supabase.from("projects").update({ topvisor_project_id: tvId } as any).eq("id", projectId);
    if (integrationId) {
      await supabase.from("integrations").update({ external_project_id: tvId }).eq("id", integrationId);
    }
    queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
    onSelect(tvId);
    toast.success(isRu ? "Проект привязан" : "Project linked");
  };

  return (
    <div className="space-y-6">
      <GlassCard>
        <CardContent className="p-6">
          <h3 className="text-sm font-semibold text-foreground mb-4">
            {isRu ? "Выберите проект Topvisor" : "Select Topvisor project"}
          </h3>
          {isLoading ? (
            <Skeleton className="h-9 w-[300px]" />
          ) : (
            <Select onValueChange={handleSelect}>
              <SelectTrigger className="w-[320px] h-9 text-sm">
                <SelectValue placeholder={isRu ? "Выберите проект…" : "Select project…"} />
              </SelectTrigger>
              <SelectContent>
                {tvProjects?.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.name || p.site} — {p.site}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Keywords Dashboard
   ═══════════════════════════════════════════════════════ */
function KeywordsDashboard({
  apiKey, userId, tvProjectId, projectId, integrationId,
  dateFrom, dateTo, searchQuery, setSearchQuery,
  selectedTvProject, setSelectedTvProject, isRefreshing, onReconnect,
}: {
  apiKey: string; userId: string; tvProjectId: string; projectId: string; integrationId: string;
  dateFrom: string; dateTo: string; searchQuery: string; setSearchQuery: (v: string) => void;
  selectedTvProject: string | null; setSelectedTvProject: (v: string) => void;
  isRefreshing: boolean; onReconnect?: () => void;
}) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  const [localDateFrom, setLocalDateFrom] = useState<Date>(new Date(dateFrom));
  const [localDateTo, setLocalDateTo] = useState<Date>(new Date(dateTo));

  const effectiveDateFrom = format(localDateFrom, "yyyy-MM-dd");
  const effectiveDateTo = format(localDateTo, "yyyy-MM-dd");

  // Fetch positions/keywords from Topvisor
  const { data: positionsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["topvisor-keywords", tvProjectId, effectiveDateFrom, effectiveDateTo],
    queryFn: async () => {
      const data = await callTopvisor("get-positions", apiKey, userId, {
        project_id: tvProjectId,
        dates: [effectiveDateFrom, effectiveDateTo],
        show_headers: 1,
        positions_fields: ["position"],
      });
      return data;
    },
    retry: 1,
  });

  // Parse keywords
  const keywords: KeywordRow[] = useMemo(() => {
    if (!positionsData?.result) return [];
    const result = positionsData.result;
    const dateKeys: string[] = Array.isArray(result?.headers?.dates) ? result.headers.dates : [];
    const rows = Array.isArray(result?.keywords) ? result.keywords : [];

    const lastDate = dateKeys.at(-1) ?? null;
    const prevDate = dateKeys.length > 1 ? dateKeys.at(-2) ?? null : null;

    return rows.map((row: any) => {
      const positionsObj = row.positionsData && typeof row.positionsData === "object" ? row.positionsData : {};

      const findPos = (date: string | null) => {
        if (!date) return null;
        const key = Object.keys(positionsObj).find((k) => k.startsWith(`${date}:`));
        if (!key) return null;
        const value = positionsObj[key]?.position;
        if (value === null || value === undefined || value === "--" || value === "") return null;
        const num = Number(value);
        return Number.isFinite(num) && num > 0 ? num : null;
      };

      let currentPos = findPos(lastDate);
      let previousPos = findPos(prevDate);

      if (currentPos === null && previousPos === null) {
        const allKeys = Object.keys(positionsObj);
        if (allKeys.length > 0) {
          const val = positionsObj[allKeys[0]]?.position;
          if (val && val !== "--" && val !== "") {
            const num = Number(val);
            currentPos = Number.isFinite(num) && num > 0 ? num : null;
          }
        }
      }

      return { keyword: row.name || "", position: currentPos, prevPosition: previousPos };
    });
  }, [positionsData]);

  // Filtered
  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return keywords;
    const q = searchQuery.toLowerCase();
    return keywords.filter((k) => k.keyword.toLowerCase().includes(q));
  }, [keywords, searchQuery]);

  // KPI
  const withPos = filtered.filter((k) => k.position !== null && k.position > 0);
  const avgPos = withPos.length > 0 ? withPos.reduce((s, k) => s + k.position!, 0) / withPos.length : 0;
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

  // No data
  if (!isLoading && !isError && keywords.length === 0) {
    return (
      <div className="space-y-6">
        <ToolbarRow
          localDateFrom={localDateFrom} localDateTo={localDateTo}
          setLocalDateFrom={setLocalDateFrom} setLocalDateTo={setLocalDateTo}
          isLoading={isLoading} onSync={handleSync}
        />
        <div className="flex flex-col items-center justify-center py-16">
          <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold text-foreground mb-2">
            {isRu ? "Нет данных за выбранный период" : "No data for selected period"}
          </h3>
          <p className="text-sm text-muted-foreground text-center max-w-md">
            {isRu
              ? "В Topvisor нет данных по ключевым словам за эти даты. Попробуйте другой период."
              : "Topvisor has no keyword data for these dates. Try a different period."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      {/* Toolbar */}
      <ToolbarRow
        localDateFrom={localDateFrom} localDateTo={localDateTo}
        setLocalDateFrom={setLocalDateFrom} setLocalDateTo={setLocalDateTo}
        isLoading={isLoading} onSync={handleSync}
      />

      {/* Loading */}
      {isLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <GlassCard key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
            ))}
          </div>
          <GlassCard><CardContent className="p-5"><Skeleton className="h-[300px]" /></CardContent></GlassCard>
        </div>
      ) : isError ? (
        <GlassCard>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">{(error as Error)?.message || "Error"}</p>
            </div>
            {onReconnect && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onReconnect}>
                <KeyRound className="h-3.5 w-3.5" />
                {isRu ? "Переподключить" : "Reconnect"}
              </Button>
            )}
          </CardContent>
        </GlassCard>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StandardKpiCard
              label={isRu ? "Всего ключевых слов" : "Total Keywords"}
              value={String(keywords.length)}
              loading={isRefreshing}
            />
            <StandardKpiCard
              label={isRu ? "Средняя позиция" : "Avg Position"}
              value={avgPos > 0 ? avgPos.toFixed(1) : "—"}
              loading={isRefreshing}
            />
            <StandardKpiCard
              label={isRu ? "Видимость (Top 10)" : "Visibility (Top 10)"}
              value={`${visibility}%`}
              loading={isRefreshing}
            />
            <GlassCard>
              <CardContent className="p-4 space-y-2">
                <span className="text-xs text-muted-foreground font-medium">{isRu ? "Движение" : "Movement"}</span>
                <div className="flex items-baseline gap-4">
                  <div className="flex items-center gap-1 text-emerald-500">
                    <TrendingUp className="h-4 w-4" /><span className="text-lg font-bold">{ups}</span>
                  </div>
                  <div className="flex items-center gap-1 text-destructive">
                    <TrendingDown className="h-4 w-4" /><span className="text-lg font-bold">{downs}</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span className="text-lg font-bold">= {stable}</span>
                  </div>
                </div>
              </CardContent>
            </GlassCard>
          </div>

          {/* Distribution */}
          <GlassCard>
            <CardContent className="p-4 space-y-2">
              <span className="text-xs text-muted-foreground font-medium">{isRu ? "Распределение позиций" : "Position Distribution"}</span>
              <div className="flex h-4 rounded-full overflow-hidden bg-muted">
                {top3 > 0 && <div className="bg-amber-400" style={{ width: `${(top3 / total) * 100}%` }} />}
                {(top10 - top3) > 0 && <div className="bg-emerald-500" style={{ width: `${((top10 - top3) / total) * 100}%` }} />}
                {(top30 - top10) > 0 && <div className="bg-primary" style={{ width: `${((top30 - top10) / total) * 100}%` }} />}
                {outside > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(outside / total) * 100}%` }} />}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" />Top 3: {top3}</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />Top 4-10: {top10 - top3}</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-primary" />Top 11-30: {top30 - top10}</span>
                <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground/30" />{isRu ? "За 30" : ">30"}: {outside}</span>
              </div>
            </CardContent>
          </GlassCard>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={isRu ? "Поиск по ключевым словам…" : "Search keywords…"}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Table */}
          <GlassCard>
            <CardContent className="p-0">
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {isRu ? "Ключевые слова" : "Keywords"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isRu ? `${filtered.length} запросов` : `${filtered.length} keywords`}
                </p>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">{isRu ? "Запрос" : "Keyword"}</TableHead>
                      <TableHead className="text-xs text-center">{isRu ? "Позиция" : "Position"}</TableHead>
                      <TableHead className="text-xs text-center">{isRu ? "Изменение" : "Change"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={3} className="text-center text-muted-foreground py-8">
                          {isRu ? "Ничего не найдено" : "Nothing found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((k, i) => {
                        const delta = k.prevPosition && k.position ? k.prevPosition - k.position : null;
                        return (
                          <TableRow key={i} className="hover:bg-muted/20 transition-colors">
                            <TableCell className="text-sm font-medium text-foreground">{k.keyword}</TableCell>
                            <TableCell className="text-center">
                              <span className={cn("text-base", positionColor(k.position))}>
                                {k.position ?? "—"}
                              </span>
                            </TableCell>
                            <TableCell className="text-center">
                              {delta !== null && delta !== 0 ? (
                                <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold",
                                  delta > 0 ? "text-emerald-500" : "text-destructive"
                                )}>
                                  {delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                                  {delta > 0 ? "+" : ""}{delta}
                                </span>
                              ) : (
                                <span className="text-xs text-muted-foreground">—</span>
                              )}
                            </TableCell>
                          </TableRow>
                        );
                      })
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </GlassCard>
        </>
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Toolbar with date pickers & sync
   ═══════════════════════════════════════════════════════ */
function ToolbarRow({ localDateFrom, localDateTo, setLocalDateFrom, setLocalDateTo, isLoading, onSync }: {
  localDateFrom: Date; localDateTo: Date;
  setLocalDateFrom: (d: Date) => void; setLocalDateTo: (d: Date) => void;
  isLoading: boolean; onSync: () => void;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(localDateFrom, "dd.MM.yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single" selected={localDateFrom}
            onSelect={(d) => d && setLocalDateFrom(d)}
            disabled={(d) => d > localDateTo || d > new Date()}
            locale={isRu ? ru : undefined}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <span className="text-xs text-muted-foreground">→</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-9">
            <CalendarIcon className="h-3.5 w-3.5" />
            {format(localDateTo, "dd.MM.yyyy")}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single" selected={localDateTo}
            onSelect={(d) => d && setLocalDateTo(d)}
            disabled={(d) => d < localDateFrom || d > new Date()}
            locale={isRu ? ru : undefined}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
      <Button variant="outline" size="sm" className="gap-1.5" onClick={onSync}>
        <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
        {isRu ? "Обновить" : "Refresh"}
      </Button>
    </div>
  );
}
