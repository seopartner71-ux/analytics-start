import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, TrendingUp, TrendingDown, Filter, Loader2, AlertCircle,
  Users, Clock, BarChart3, ArrowUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  PieChart, Pie, Cell,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { supabase } from "@/integrations/supabase/client";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import {
  StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip,
} from "./shared-ui";

interface SeoTabProps {
  projectId: string;
  projectName?: string;
}

type QueryType = "brand" | "informational" | "commercial";
type SortKey = "visits" | "users" | "bounceRate" | "duration";

interface KeywordRow {
  query: string;
  visits: number;
  users: number;
  bounceRate: number;
  pageDepth: number;
  avgDuration: number;
  engine: string;
  queryType: QueryType;
}

const ENGINE_COLORS = {
  yandex: "hsl(10, 85%, 57%)",
  google: "hsl(217, 89%, 61%)",
};

function YandexIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-3.5 w-3.5", className)} fill="none">
      <rect width="24" height="24" rx="4" fill="#FC3F1D" />
      <path d="M13.63 18.71h-2.05V5.29h2.84c2.34 0 3.57 1.18 3.57 3.15 0 1.56-.86 2.65-2.27 3.18l2.72 7.09h-2.2l-2.42-6.57h-.19v6.57zm0-8.46h.55c1.25 0 1.95-.66 1.95-1.82 0-1.13-.67-1.72-1.92-1.72h-.58v3.54z" fill="white" />
    </svg>
  );
}

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={cn("h-3.5 w-3.5", className)} fill="none">
      <rect width="24" height="24" rx="4" fill="#4285F4" />
      <path d="M17.64 12.2c0-.63-.06-1.25-.16-1.84H12v3.49h3.16a2.7 2.7 0 01-1.17 1.77v1.47h1.9c1.1-1.02 1.75-2.52 1.75-4.89z" fill="white" />
      <path d="M12 18c1.58 0 2.91-.52 3.88-1.41l-1.9-1.47c-.52.35-1.19.56-1.98.56-1.53 0-2.82-1.03-3.28-2.42H6.75v1.52A5.99 5.99 0 0012 18z" fill="white" />
      <path d="M8.72 13.26a3.6 3.6 0 010-2.29V9.45H6.75a6 6 0 000 5.33l1.97-1.52z" fill="white" />
      <path d="M12 8.58c.86 0 1.63.3 2.24.88l1.68-1.68A5.35 5.35 0 0012 6a5.99 5.99 0 00-5.25 3.45l1.97 1.52c.46-1.39 1.75-2.39 3.28-2.39z" fill="white" />
    </svg>
  );
}

const QUERY_TYPE_LABELS: Record<string, Record<QueryType | "all", string>> = {
  ru: { all: "Все", brand: "Брендовые", informational: "Информационные", commercial: "Коммерческие" },
  en: { all: "All", brand: "Brand", informational: "Informational", commercial: "Commercial" },
};

const QUERY_TYPE_COLORS: Record<QueryType, string> = {
  brand: "hsl(var(--chart-1))",
  commercial: "hsl(var(--chart-2))",
  informational: "hsl(var(--chart-3))",
};

function classifyQuery(query: string): QueryType {
  const q = query.toLowerCase();
  if (q.includes("купить") || q.includes("цена") || q.includes("заказ") || q.includes("buy") || q.includes("price") || q.includes("order") || q.includes("доставк") || q.includes("стоимость")) return "commercial";
  if (q.includes("как") || q.includes("что") || q.includes("how") || q.includes("what") || q.includes("guide") || q.includes("отзыв") || q.includes("почему") || q.includes("зачем")) return "informational";
  return "brand";
}

function formatDuration(secs: number) {
  const m = Math.floor(secs / 60);
  const s = Math.round(secs % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function SeoTab({ projectId, projectName }: SeoTabProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";
  const { appliedRange } = useDateRange();
  const isRefreshing = useTabRefresh();
  const contentRef = useRef<HTMLDivElement>(null);
  const [queryTypeFilter, setQueryTypeFilter] = useState<QueryType | "all">("all");
  const [sortKey, setSortKey] = useState<SortKey>("visits");
  const [sortAsc, setSortAsc] = useState(false);

  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  // Integration
  const { data: integration } = useQuery({
    queryKey: ["integration-metrika", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations").select("*")
        .eq("project_id", projectId).eq("service_name", "yandexMetrika").eq("connected", true)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // Fetch search phrases from real API
  const { data: searchData, isLoading } = useQuery({
    queryKey: ["metrika-search-phrases", projectId, dateFrom, dateTo],
    queryFn: async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-search-phrases`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            access_token: integration!.access_token,
            counter_id: integration!.counter_id,
            date1: dateFrom,
            date2: dateTo,
          }),
        }
      );
      return await resp.json();
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 10 * 60 * 1000,
  });

  // Parse keywords — only real metrics from Metrika
  const keywords: KeywordRow[] = useMemo(() => {
    if (!searchData?.phrases?.data) return [];
    return searchData.phrases.data.map((row: any) => {
      const engineName = row.dimensions?.[0]?.name || row.dimensions?.[0]?.id || "";
      const phrase = row.dimensions?.[1]?.name || row.dimensions?.[1]?.id || "";
      const metrics = row.metrics || [];
      const engine = engineName.toLowerCase().includes("google") ? "google" : "yandex";
      return {
        query: phrase,
        visits: Math.round(metrics[0] || 0),
        users: Math.round(metrics[1] || 0),
        bounceRate: Math.round((metrics[2] || 0) * 10) / 10,
        pageDepth: Math.round((metrics[3] || 0) * 100) / 100,
        avgDuration: Math.round(metrics[4] || 0),
        engine,
        queryType: classifyQuery(phrase),
      };
    }).filter((k: KeywordRow) => k.query && k.query.length > 0)
      .sort((a: KeywordRow, b: KeywordRow) => b.visits - a.visits)
      .slice(0, 200);
  }, [searchData]);

  // Engine trend chart
  const chartData = useMemo(() => {
    if (!searchData?.trend?.data) return [];
    const timeIntervals = searchData.trend?.time_intervals || [];
    const rows = searchData.trend?.data || [];
    const engineMap = new Map<string, number[]>();
    for (const row of rows) {
      const engineName = row.dimensions?.[0]?.name || row.dimensions?.[0]?.id || "other";
      const isGoogle = engineName.toLowerCase().includes("google");
      const key = isGoogle ? "google" : "yandex";
      const visits = row.metrics?.[0] || [];
      if (!engineMap.has(key)) engineMap.set(key, new Array(timeIntervals.length).fill(0));
      const existing = engineMap.get(key)!;
      for (let i = 0; i < visits.length; i++) {
        existing[i] = (existing[i] || 0) + (visits[i] || 0);
      }
    }
    return timeIntervals.map((interval: string[], i: number) => {
      const dateStr = interval?.[0]?.split("T")?.[0] || "";
      const d = dateStr ? new Date(dateStr) : new Date();
      return {
        day: format(d, "dd.MM"),
        yandex: Math.round(engineMap.get("yandex")?.[i] || 0),
        google: Math.round(engineMap.get("google")?.[i] || 0),
      };
    });
  }, [searchData]);

  // Filtered + sorted
  const filtered = useMemo(() => {
    let result = queryTypeFilter === "all" ? keywords : keywords.filter(k => k.queryType === queryTypeFilter);
    result = [...result].sort((a, b) => {
      const va = a[sortKey];
      const vb = b[sortKey];
      return sortAsc ? (va as number) - (vb as number) : (vb as number) - (va as number);
    });
    return result;
  }, [keywords, queryTypeFilter, sortKey, sortAsc]);

  // KPIs
  const totalVisits = filtered.reduce((s, q) => s + q.visits, 0);
  const totalUsers = filtered.reduce((s, q) => s + q.users, 0);
  const avgBounce = filtered.length > 0 ? Math.round(filtered.reduce((s, q) => s + q.bounceRate, 0) / filtered.length * 10) / 10 : 0;
  const avgDuration = filtered.length > 0 ? Math.round(filtered.reduce((s, q) => s + q.avgDuration, 0) / filtered.length) : 0;

  // Type distribution for donut
  const typeCounts = useMemo(() => {
    const counts = { brand: 0, informational: 0, commercial: 0 };
    keywords.forEach(k => counts[k.queryType]++);
    return counts;
  }, [keywords]);

  const typeDistribution = useMemo(() => [
    { key: "brand", name: QUERY_TYPE_LABELS[lang].brand, value: typeCounts.brand, color: QUERY_TYPE_COLORS.brand },
    { key: "commercial", name: QUERY_TYPE_LABELS[lang].commercial, value: typeCounts.commercial, color: QUERY_TYPE_COLORS.commercial },
    { key: "informational", name: QUERY_TYPE_LABELS[lang].informational, value: typeCounts.informational, color: QUERY_TYPE_COLORS.informational },
  ].filter(d => d.value > 0), [typeCounts, lang]);

  // Engine distribution
  const engineDist = useMemo(() => {
    let yandex = 0, google = 0;
    keywords.forEach(k => k.engine === "yandex" ? yandex += k.visits : google += k.visits);
    return { yandex, google, total: yandex + google };
  }, [keywords]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const SortHeader = ({ label, sortField }: { label: string; sortField: SortKey }) => (
    <TableHead className="text-xs text-right cursor-pointer hover:text-foreground transition-colors" onClick={() => handleSort(sortField)}>
      <div className="flex items-center justify-end gap-1">
        {label}
        <ArrowUpDown className={cn("h-3 w-3", sortKey === sortField ? "text-primary" : "text-muted-foreground/40")} />
      </div>
    </TableHead>
  );

  const exportMeta = { projectName: projectName || "", tabName: i18n.language === "ru" ? "Ключевые слова" : "Keywords", periodA: `${dateFrom} — ${dateTo}`, language: i18n.language };

  // No integration
  if (!integration?.access_token || !integration?.counter_id) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <AlertCircle className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {i18n.language === "ru"
            ? "Подключите Яндекс.Метрику в Интеграциях для отображения поисковых запросов"
            : "Connect Yandex.Metrika in Integrations to view search queries"}
        </p>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (keywords.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center gap-3">
        <Search className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">
          {i18n.language === "ru" ? "Данные отсутствуют за выбранный период" : "No data available for the selected period"}
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 transition-opacity duration-300", isRefreshing && "opacity-60")}>
      <TabLoadingOverlay show={isRefreshing} />

      {/* Top bar */}
      <div className="flex items-center justify-between flex-wrap gap-3" data-export-ignore>
        <div className="flex items-center gap-3 flex-wrap">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <ToggleGroup type="single" value={queryTypeFilter} onValueChange={(v) => v && setQueryTypeFilter(v as any)}>
            {(["all", "brand", "informational", "commercial"] as const).map(type => (
              <ToggleGroupItem key={type} value={type} variant="outline" size="sm" className="text-xs gap-1.5 h-7">
                {QUERY_TYPE_LABELS[lang][type]}
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4">
                  {type === "all" ? keywords.length : typeCounts[type]}
                </Badge>
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>
        <ExportMenu
          onExportPdf={async () => { if (contentRef.current) await exportToPdf(contentRef.current, exportMeta); }}
          onExportExcel={async () => {
            const sheets: ExcelSheet[] = [{
              name: exportMeta.tabName,
              headers: [i18n.language === "ru" ? "Фраза" : "Query", i18n.language === "ru" ? "ПС" : "Engine", i18n.language === "ru" ? "Визиты" : "Visits", i18n.language === "ru" ? "Посетители" : "Users", i18n.language === "ru" ? "Отказы" : "Bounce", i18n.language === "ru" ? "Время" : "Duration"],
              rows: filtered.map(q => [q.query, q.engine, q.visits, q.users, `${q.bounceRate}%`, formatDuration(q.avgDuration)]),
            }];
            exportToExcel(sheets, exportMeta);
          }}
          onExportWord={async () => {
            const sections: WordSection[] = [{ title: exportMeta.tabName, table: { headers: ["Query", "Engine", "Visits", "Users"], rows: filtered.slice(0, 50).map(q => [q.query, q.engine, q.visits, q.users]) } }];
            await exportToWord(sections, exportMeta);
          }}
        />
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* === KPI ROW === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <StandardKpiCard label={i18n.language === "ru" ? "Визиты из поиска" : "Search Visits"} value={totalVisits.toLocaleString()} color="hsl(var(--chart-1))" sparkData={[]} />
          <StandardKpiCard label={i18n.language === "ru" ? "Посетители" : "Users"} value={totalUsers.toLocaleString()} color="hsl(var(--chart-2))" sparkData={[]} />
          <StandardKpiCard label={i18n.language === "ru" ? "Ср. отказы" : "Avg. Bounce"} value={`${avgBounce}%`} color="hsl(var(--chart-3))" sparkData={[]} />
          <StandardKpiCard label={i18n.language === "ru" ? "Ср. время" : "Avg. Duration"} value={formatDuration(avgDuration)} color="hsl(var(--chart-5))" sparkData={[]} />
        </div>

        {/* === ENGINE TREND + DISTRIBUTIONS === */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Trend chart */}
          {chartData.length > 0 && (
            <Card className="border-border bg-card lg:col-span-2">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  {i18n.language === "ru" ? "Динамика поискового трафика" : "Search Traffic Dynamics"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="kwYandexGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="kwGoogleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ENGINE_COLORS.google} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={ENGINE_COLORS.google} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<StandardChartTooltip />} />
                    <Legend />
                    <Area type="monotone" dataKey="yandex" name="Яндекс" stroke={ENGINE_COLORS.yandex} strokeWidth={2} fill="url(#kwYandexGrad)" dot={false} />
                    <Area type="monotone" dataKey="google" name="Google" stroke={ENGINE_COLORS.google} strokeWidth={2} fill="url(#kwGoogleGrad)" dot={false} />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}

          {/* Distribution cards */}
          <div className="space-y-4">
            {/* Engine split */}
            <Card className="border-border bg-card">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {i18n.language === "ru" ? "Поисковые системы" : "Search Engines"}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <YandexIcon />
                  <span className="text-sm text-foreground flex-1">Яндекс</span>
                  <span className="text-sm tabular-nums font-semibold">{engineDist.yandex.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {engineDist.total > 0 ? Math.round((engineDist.yandex / engineDist.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${engineDist.total > 0 ? (engineDist.yandex / engineDist.total) * 100 : 0}%`, background: ENGINE_COLORS.yandex }} />
                </div>
                <div className="flex items-center gap-3 mt-2">
                  <GoogleIcon />
                  <span className="text-sm text-foreground flex-1">Google</span>
                  <span className="text-sm tabular-nums font-semibold">{engineDist.google.toLocaleString()}</span>
                  <span className="text-xs text-muted-foreground w-10 text-right">
                    {engineDist.total > 0 ? Math.round((engineDist.google / engineDist.total) * 100) : 0}%
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${engineDist.total > 0 ? (engineDist.google / engineDist.total) * 100 : 0}%`, background: ENGINE_COLORS.google }} />
                </div>
              </CardContent>
            </Card>

            {/* Query type donut */}
            {typeDistribution.length > 0 && (
              <Card className="border-border bg-card">
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {i18n.language === "ru" ? "Типы запросов" : "Query Types"}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4">
                    <div className="w-[100px] h-[100px] shrink-0">
                      <ResponsiveContainer width="100%" height="100%">
                        <PieChart>
                          <Pie data={typeDistribution} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={28} outerRadius={45} paddingAngle={3} strokeWidth={0}>
                            {typeDistribution.map(d => <Cell key={d.key} fill={d.color} />)}
                          </Pie>
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="flex-1 space-y-2">
                      {typeDistribution.map(d => (
                        <div key={d.key} className="flex items-center gap-2">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: d.color }} />
                          <span className="text-xs text-foreground flex-1">{d.name}</span>
                          <span className="text-xs tabular-nums font-semibold">{d.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* === KEYWORDS TABLE === */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                {i18n.language === "ru" ? "Поисковые запросы" : "Search Queries"}
                <span className="text-xs text-muted-foreground/60">({filtered.length})</span>
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <div className="rounded-lg border border-border/60 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/30">
                    <TableHead className="text-xs w-8">#</TableHead>
                    <TableHead className="text-xs w-8"></TableHead>
                    <TableHead className="text-xs">{i18n.language === "ru" ? "Поисковая фраза" : "Search Query"}</TableHead>
                    <TableHead className="text-xs">{i18n.language === "ru" ? "Тип" : "Type"}</TableHead>
                    <SortHeader label={i18n.language === "ru" ? "Визиты" : "Visits"} sortField="visits" />
                    <SortHeader label={i18n.language === "ru" ? "Посетители" : "Users"} sortField="users" />
                    <SortHeader label={i18n.language === "ru" ? "Отказы" : "Bounce"} sortField="bounceRate" />
                    <SortHeader label={i18n.language === "ru" ? "Время" : "Duration"} sortField="duration" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q, i) => (
                    <TableRow key={`${q.query}-${q.engine}-${i}`} className="hover:bg-muted/20">
                      <TableCell className="text-xs text-muted-foreground tabular-nums">{i + 1}</TableCell>
                      <TableCell className="pr-0">
                        {q.engine === "yandex" ? <YandexIcon /> : <GoogleIcon />}
                      </TableCell>
                      <TableCell className="text-sm font-medium text-foreground max-w-[300px] truncate">{q.query}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className={cn("text-[10px] px-1.5 py-0 h-4",
                          q.queryType === "brand" && "border-primary/40 text-primary",
                          q.queryType === "commercial" && "border-emerald-500/40 text-emerald-600",
                          q.queryType === "informational" && "border-amber-500/40 text-amber-600",
                        )}>
                          {QUERY_TYPE_LABELS[lang][q.queryType]}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums font-semibold">{q.visits.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">{q.users.toLocaleString()}</TableCell>
                      <TableCell className="text-sm text-right tabular-nums">
                        <span className={cn(q.bounceRate > 50 ? "text-red-500" : q.bounceRate < 30 ? "text-emerald-500" : "text-foreground")}>
                          {q.bounceRate}%
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-right tabular-nums text-muted-foreground">{formatDuration(q.avgDuration)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
