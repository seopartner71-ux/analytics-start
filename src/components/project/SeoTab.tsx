import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, TrendingUp, TrendingDown, RefreshCw,
  AlertCircle, CalendarIcon, FileSearch,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  StandardKpiCard, useTabRefresh, TabLoadingOverlay, GlassCard,
} from "./shared-ui";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface SeoTabProps {
  projectId: string;
  accessToken?: string | null;
  hostId?: string | null;
}

interface SearchQuery {
  query_text: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

/* ═══════════════════════════════════════════════════════
   API helper
   ═══════════════════════════════════════════════════════ */
async function callWebmaster(payload: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Not authenticated");
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(`https://${projectRef}.supabase.co/functions/v1/yandex-webmaster`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || "API error");
  return data;
}

/* ═══════════════════════════════════════════════════════
   Main SeoTab
   ═══════════════════════════════════════════════════════ */
export function SeoTab({ projectId, accessToken, hostId }: SeoTabProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const { appliedRange } = useDateRange();

  const [searchFilter, setSearchFilter] = useState("");
  const [localDateFrom, setLocalDateFrom] = useState<Date>(appliedRange.from);
  const [localDateTo, setLocalDateTo] = useState<Date>(appliedRange.to);

  const effectiveDateFrom = format(localDateFrom, "yyyy-MM-dd");
  const effectiveDateTo = format(localDateTo, "yyyy-MM-dd");

  // Not connected state
  if (!accessToken || !hostId) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-4">
        <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
          <FileSearch className="h-10 w-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground mb-2">
          {isRu ? "Подключите Яндекс.Вебмастер" : "Connect Yandex Webmaster"}
        </h2>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {isRu
            ? "Для получения данных по поисковым запросам подключите Яндекс.Метрику на вкладке «Интеграции» и привяжите сайт на вкладке «Индексация»."
            : "To get search query data, connect Yandex Metrika in Integrations and link your site in the Indexing tab."}
        </p>
      </div>
    );
  }

  return (
    <KeywordsDashboard
      accessToken={accessToken}
      hostId={hostId}
      dateFrom={effectiveDateFrom}
      dateTo={effectiveDateTo}
      localDateFrom={localDateFrom}
      localDateTo={localDateTo}
      setLocalDateFrom={setLocalDateFrom}
      setLocalDateTo={setLocalDateTo}
      searchFilter={searchFilter}
      setSearchFilter={setSearchFilter}
      isRefreshing={isRefreshing}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Keywords Dashboard
   ═══════════════════════════════════════════════════════ */
function KeywordsDashboard({
  accessToken, hostId, dateFrom, dateTo,
  localDateFrom, localDateTo, setLocalDateFrom, setLocalDateTo,
  searchFilter, setSearchFilter, isRefreshing,
}: {
  accessToken: string; hostId: string;
  dateFrom: string; dateTo: string;
  localDateFrom: Date; localDateTo: Date;
  setLocalDateFrom: (d: Date) => void; setLocalDateTo: (d: Date) => void;
  searchFilter: string; setSearchFilter: (v: string) => void;
  isRefreshing: boolean;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  const { data: queriesData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["webmaster-search-queries", hostId, dateFrom, dateTo],
    queryFn: async () => {
      const data = await callWebmaster({
        action: "get-search-queries",
        access_token: accessToken,
        host_id: hostId,
        date_from: dateFrom,
        date_to: dateTo,
        limit: 500,
      });
      return data;
    },
    retry: 1,
  });

  // Parse queries
  const queries: SearchQuery[] = useMemo(() => {
    const raw = queriesData?.queries;
    if (!Array.isArray(raw)) return [];
    return raw.map((q: any) => ({
      query_text: q.query_text || q.query || "",
      clicks: q.count || q.clicks || 0,
      impressions: q.impressions || 0,
      ctr: q.ctr != null ? Math.round(q.ctr * 1000) / 10 : 0,
      position: q.position != null ? Math.round(q.position * 10) / 10 : 0,
    }));
  }, [queriesData]);

  // Filtered
  const filtered = useMemo(() => {
    if (!searchFilter.trim()) return queries;
    const q = searchFilter.toLowerCase();
    return queries.filter((k) => k.query_text.toLowerCase().includes(q));
  }, [queries, searchFilter]);

  // KPI
  const totalClicks = filtered.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = filtered.reduce((s, q) => s + q.impressions, 0);
  const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0;
  const avgPosition = filtered.length > 0
    ? Math.round((filtered.reduce((s, q) => s + q.position, 0) / filtered.length) * 10) / 10
    : 0;

  const handleSync = () => {
    refetch();
    toast.success(isRu ? "Данные обновлены" : "Data refreshed");
  };

  // No data
  if (!isLoading && !isError && queries.length === 0) {
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
              ? "В Яндекс.Вебмастере нет данных по поисковым запросам за эти даты."
              : "Yandex Webmaster has no search query data for these dates."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      <ToolbarRow
        localDateFrom={localDateFrom} localDateTo={localDateTo}
        setLocalDateFrom={setLocalDateFrom} setLocalDateTo={setLocalDateTo}
        isLoading={isLoading} onSync={handleSync}
      />

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
          <CardContent className="p-6">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">
                {isRu ? "Ошибка подключения к Яндекс.Вебмастеру. Проверьте ключи доступа." : "Connection error. Check access keys."}
              </p>
            </div>
            <p className="text-xs text-muted-foreground mt-2">{(error as Error)?.message}</p>
          </CardContent>
        </GlassCard>
      ) : (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <StandardKpiCard
              label={isRu ? "Клики" : "Clicks"}
              value={totalClicks.toLocaleString()}
              loading={isRefreshing}
            />
            <StandardKpiCard
              label={isRu ? "Показы" : "Impressions"}
              value={totalImpressions.toLocaleString()}
              loading={isRefreshing}
            />
            <StandardKpiCard
              label="CTR"
              value={`${avgCtr}%`}
              loading={isRefreshing}
            />
            <StandardKpiCard
              label={isRu ? "Ср. позиция" : "Avg Position"}
              value={String(avgPosition)}
              loading={isRefreshing}
            />
          </div>

          {/* Search */}
          <div className="relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchFilter}
              onChange={(e) => setSearchFilter(e.target.value)}
              placeholder={isRu ? "Поиск по запросам…" : "Search queries…"}
              className="pl-9 h-9 text-sm"
            />
          </div>

          {/* Table */}
          <GlassCard>
            <CardContent className="p-0">
              <div className="px-5 pt-4 pb-2">
                <h3 className="text-sm font-semibold text-foreground">
                  {isRu ? "Поисковые запросы" : "Search Queries"}
                  <span className="ml-2 text-xs text-muted-foreground/70">({filtered.length})</span>
                </h3>
              </div>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/30">
                      <TableHead className="text-xs">{isRu ? "Запрос" : "Query"}</TableHead>
                      <TableHead className="text-xs text-right">{isRu ? "Клики" : "Clicks"}</TableHead>
                      <TableHead className="text-xs text-right">{isRu ? "Показы" : "Impressions"}</TableHead>
                      <TableHead className="text-xs text-right">CTR</TableHead>
                      <TableHead className="text-xs text-right">{isRu ? "Ср. позиция" : "Avg Position"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                          {isRu ? "Ничего не найдено" : "Nothing found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filtered.map((q, i) => (
                        <TableRow key={i} className="hover:bg-muted/20 transition-colors">
                          <TableCell className="text-sm font-medium text-foreground">{q.query_text}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{q.clicks.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{q.impressions.toLocaleString()}</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">{q.ctr}%</TableCell>
                          <TableCell className="text-sm text-right tabular-nums">
                            <span className={cn(
                              q.position <= 3 ? "text-amber-400 font-bold" :
                              q.position <= 10 ? "text-emerald-500 font-bold" :
                              q.position <= 30 ? "text-primary font-bold" :
                              "text-muted-foreground font-bold"
                            )}>
                              {q.position}
                            </span>
                          </TableCell>
                        </TableRow>
                      ))
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
   Toolbar
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
