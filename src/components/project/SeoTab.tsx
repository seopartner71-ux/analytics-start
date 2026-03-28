import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Search, TrendingUp, TrendingDown, Filter } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip, SkeletonChart, MetricTooltip,
} from "./shared-ui";

interface SeoTabProps {
  projectId: string;
}

type QueryEngine = "yandex" | "google";
type QueryType = "brand" | "informational" | "commercial";

interface KeywordRow {
  query: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
  positionTrend: number[];
  engine: QueryEngine;
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

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={64} height={24}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", positive ? "text-emerald-500" : "text-red-500")}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{Math.round(value * 10) / 10}%
    </span>
  );
}

const ChartTooltip = StandardChartTooltip;

function generateKeywords(dateFrom: Date, dateTo: Date, seed: number): KeywordRow[] {
  const days = differenceInDays(dateTo, dateFrom) + 1;
  const m = 1 + (seed % 5) * 0.15;
  const base: Omit<KeywordRow, "clicks" | "impressions" | "ctr">[] = [
    { query: "купить цветы", position: 4.2, positionTrend: [5.1,4.8,4.5,4.3,4.2,4.0,4.2], engine: "yandex", queryType: "commercial" },
    { query: "buy flowers online", position: 5.1, positionTrend: [6.5,6.0,5.6,5.3,5.1,5.0,5.1], engine: "google", queryType: "commercial" },
    { query: "доставка цветов", position: 6.8, positionTrend: [8.2,7.5,7.1,6.9,6.8,6.5,6.8], engine: "yandex", queryType: "commercial" },
    { query: "flower delivery moscow", position: 7.2, positionTrend: [9.0,8.5,7.8,7.5,7.2,7.0,7.2], engine: "google", queryType: "commercial" },
    { query: "букет роз", position: 3.1, positionTrend: [4.0,3.8,3.5,3.2,3.1,3.0,3.1], engine: "yandex", queryType: "commercial" },
    { query: "souzcvettorg", position: 1.0, positionTrend: [1.0,1.0,1.0,1.0,1.0,1.0,1.0], engine: "yandex", queryType: "brand" },
    { query: "союзцветторг", position: 1.2, positionTrend: [1.5,1.3,1.2,1.2,1.1,1.2,1.2], engine: "yandex", queryType: "brand" },
    { query: "souzcvettorg отзывы", position: 2.3, positionTrend: [3.0,2.8,2.5,2.3,2.3,2.2,2.3], engine: "google", queryType: "brand" },
    { query: "как ухаживать за розами", position: 8.5, positionTrend: [12.0,10.5,9.5,8.8,8.5,8.3,8.5], engine: "yandex", queryType: "informational" },
    { query: "how to care for flowers", position: 9.1, positionTrend: [13.0,11.5,10.2,9.5,9.1,9.0,9.1], engine: "google", queryType: "informational" },
    { query: "какие цветы дарить", position: 11.3, positionTrend: [15.0,13.5,12.8,12.0,11.5,11.3,11.3], engine: "yandex", queryType: "informational" },
    { query: "wedding flowers guide", position: 12.1, positionTrend: [15.0,14.0,13.0,12.5,12.1,12.0,12.1], engine: "google", queryType: "informational" },
    { query: "цветы оптом москва", position: 5.5, positionTrend: [7.0,6.5,6.0,5.8,5.5,5.3,5.5], engine: "yandex", queryType: "commercial" },
    { query: "roses bouquet price", position: 8.3, positionTrend: [10.0,9.5,9.0,8.6,8.3,8.1,8.3], engine: "google", queryType: "commercial" },
  ];

  return base.map((b, i) => {
    const baseClicks = Math.round((400 - i * 25) * m * (days / 30));
    const baseImpressions = Math.round(baseClicks * (3 + Math.random() * 8));
    const ctr = baseImpressions > 0 ? Math.round((baseClicks / baseImpressions) * 1000) / 10 : 0;
    return { ...b, clicks: baseClicks, impressions: baseImpressions, ctr };
  });
}

function generatePositionChart(dateFrom: Date, dateTo: Date) {
  const days = Math.min(differenceInDays(dateTo, dateFrom) + 1, 60);
  const data = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(dateFrom);
    d.setDate(d.getDate() + i);
    data.push({
      day: format(d, "dd.MM"),
      yandex: Math.round((25 + Math.random() * 20 + i * 0.8) * 10) / 10,
      google: Math.round((18 + Math.random() * 15 + i * 1.2) * 10) / 10,
    });
  }
  return data;
}

const QUERY_TYPE_LABELS: Record<string, Record<QueryType | "all", string>> = {
  ru: { all: "Все", brand: "Брендовые", informational: "Информационные", commercial: "Коммерческие" },
  en: { all: "All", brand: "Brand", informational: "Informational", commercial: "Commercial" },
};

export function SeoTab({ projectId }: SeoTabProps) {
  const { t, i18n } = useTranslation();
  const lang = i18n.language === "ru" ? "ru" : "en";
  const { appliedRange, showComparison, appliedCompRange } = useDateRange();
  const isRefreshing = useTabRefresh();
  const [queryTypeFilter, setQueryTypeFilter] = useState<QueryType | "all">("all");

  const seed = useMemo(() => appliedRange.from.getDate() + appliedRange.to.getDate() + appliedRange.from.getMonth(), [appliedRange]);

  const keywords = useMemo(() => generateKeywords(appliedRange.from, appliedRange.to, seed), [appliedRange, seed]);
  const compKeywords = useMemo(() => {
    if (!showComparison) return null;
    return generateKeywords(appliedCompRange.from, appliedCompRange.to, seed + 7);
  }, [showComparison, appliedCompRange, seed]);

  const chartData = useMemo(() => generatePositionChart(appliedRange.from, appliedRange.to), [appliedRange]);
  const compChartData = useMemo(() => {
    if (!showComparison) return null;
    return generatePositionChart(appliedCompRange.from, appliedCompRange.to);
  }, [showComparison, appliedCompRange]);

  const mergedChartData = useMemo(() => {
    if (!showComparison || !compChartData) return chartData;
    const maxLen = Math.max(chartData.length, compChartData.length);
    return Array.from({ length: maxLen }, (_, i) => ({
      day: chartData[i]?.day || `${i + 1}`,
      yandex: chartData[i]?.yandex || 0,
      google: chartData[i]?.google || 0,
      prevYandex: compChartData[i]?.yandex || 0,
      prevGoogle: compChartData[i]?.google || 0,
    }));
  }, [chartData, compChartData, showComparison]);

  const filtered = useMemo(() => {
    const base = queryTypeFilter === "all" ? keywords : keywords.filter(k => k.queryType === queryTypeFilter);
    return base.sort((a, b) => b.clicks - a.clicks);
  }, [keywords, queryTypeFilter]);

  const withDelta = useMemo(() => {
    if (!showComparison || !compKeywords) return filtered.map(k => ({ ...k, clicksDelta: 0, positionDelta: 0 }));
    return filtered.map(k => {
      const prev = compKeywords.find(c => c.query === k.query);
      return {
        ...k,
        clicksDelta: prev ? ((k.clicks - prev.clicks) / (prev.clicks || 1)) * 100 : 0,
        positionDelta: prev ? k.position - prev.position : 0,
      };
    });
  }, [filtered, compKeywords, showComparison]);

  const totalClicks = filtered.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = filtered.reduce((s, q) => s + q.impressions, 0);
  const avgCtr = totalImpressions > 0 ? Math.round((totalClicks / totalImpressions) * 1000) / 10 : 0;
  const avgPosition = filtered.length > 0 ? Math.round((filtered.reduce((s, q) => s + q.position, 0) / filtered.length) * 10) / 10 : 0;

  const typeCounts = useMemo(() => ({
    all: keywords.length,
    brand: keywords.filter(k => k.queryType === "brand").length,
    informational: keywords.filter(k => k.queryType === "informational").length,
    commercial: keywords.filter(k => k.queryType === "commercial").length,
  }), [keywords]);

  return (
    <div className="space-y-6">
      {/* Query Type Filter */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 flex-wrap">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">{t("seoTab.queryType", "Тип запроса")}:</span>
            <ToggleGroup type="single" value={queryTypeFilter} onValueChange={(v) => v && setQueryTypeFilter(v as any)}>
              {(["all", "brand", "informational", "commercial"] as const).map(type => (
                <ToggleGroupItem key={type} value={type} variant="outline" size="sm" className="text-xs gap-1.5 h-8">
                  {QUERY_TYPE_LABELS[lang][type]}
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 ml-0.5">{typeCounts[type]}</Badge>
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
        </CardContent>
      </Card>

      {/* KPI Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: t("seoTab.totalClicks", "Клики"), value: totalClicks.toLocaleString() },
          { label: t("seoTab.totalImpressions", "Показы"), value: totalImpressions.toLocaleString() },
          { label: "CTR", value: `${avgCtr}%` },
          { label: t("seoTab.avgPosition", "Ср. позиция"), value: String(avgPosition) },
        ].map((kpi, i) => (
          <Card key={i} className="border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
          </Card>
        ))}
      </div>

      {/* Visibility Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("seoTab.engineDynamics", "Динамика видимости")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {showComparison ? (
              <LineChart data={mergedChartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="yandex" name={t("engines.yandex", "Яндекс")} stroke={ENGINE_COLORS.yandex} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="google" name={t("engines.google", "Google")} stroke={ENGINE_COLORS.google} strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="prevYandex" name={`${t("engines.yandex", "Яндекс")} (Б)`} stroke={ENGINE_COLORS.yandex} strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} />
                <Line type="monotone" dataKey="prevGoogle" name={`${t("engines.google", "Google")} (Б)`} stroke={ENGINE_COLORS.google} strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} />
              </LineChart>
            ) : (
              <AreaChart data={mergedChartData}>
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
                <Tooltip content={<ChartTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="yandex" name={t("engines.yandex", "Яндекс")} stroke={ENGINE_COLORS.yandex} strokeWidth={2} fill="url(#kwYandexGrad)" dot={false} />
                <Area type="monotone" dataKey="google" name={t("engines.google", "Google")} stroke={ENGINE_COLORS.google} strokeWidth={2} fill="url(#kwGoogleGrad)" dot={false} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Keywords Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("seoTab.queriesTable", "Топ поисковых запросов")}
            <span className="ml-2 text-xs text-muted-foreground/70">({filtered.length})</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/60 overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs w-8"></TableHead>
                  <TableHead className="text-xs">{t("seoTab.query", "Фраза")}</TableHead>
                  <TableHead className="text-xs">{t("seoTab.queryType", "Тип")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.clicks", "Клики")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.impressions", "Показы")}</TableHead>
                  <TableHead className="text-xs text-right">CTR</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.position", "Позиция")}</TableHead>
                  <TableHead className="text-xs text-center">{t("seoTab.trend", "Тренд")}</TableHead>
                  {showComparison && <TableHead className="text-xs text-right">{t("seoTab.change", "Δ кликов")}</TableHead>}
                  {showComparison && <TableHead className="text-xs text-right">{t("seoTab.posChange", "Δ позиции")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {withDelta.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="pr-0">
                      {q.engine === "yandex" ? <YandexIcon /> : <GoogleIcon />}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{q.query}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={cn("text-[10px] px-1.5",
                        q.queryType === "brand" && "border-primary/40 text-primary",
                        q.queryType === "commercial" && "border-emerald-500/40 text-emerald-600",
                        q.queryType === "informational" && "border-amber-500/40 text-amber-600",
                      )}>
                        {QUERY_TYPE_LABELS[lang][q.queryType]}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.ctr}%</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.position.toFixed(1)}</TableCell>
                    <TableCell className="text-center">
                      <Sparkline
                        data={q.positionTrend}
                        color={q.positionTrend[0] > q.positionTrend[q.positionTrend.length - 1] ? "hsl(142,71%,45%)" : "hsl(0,84%,60%)"}
                      />
                    </TableCell>
                    {showComparison && (
                      <TableCell className="text-right"><ChangeIndicator value={q.clicksDelta} /></TableCell>
                    )}
                    {showComparison && (
                      <TableCell className="text-right">
                        <span className={cn("text-xs font-semibold",
                          q.positionDelta < 0 ? "text-emerald-500" : q.positionDelta > 0 ? "text-red-500" : "text-muted-foreground"
                        )}>
                          {q.positionDelta < 0 ? "↑" : q.positionDelta > 0 ? "↓" : "—"}
                          {q.positionDelta !== 0 ? Math.abs(q.positionDelta).toFixed(1) : ""}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
