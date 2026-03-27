import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subYears, differenceInDays } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarIcon, ArrowRightLeft, TrendingUp, TrendingDown, Search, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AiInsightsBlock } from "@/components/project/AiInsightsBlock";
import { supabase } from "@/integrations/supabase/client";

interface SeoTabProps {
  projectId: string;
}

type DateRange = { from: Date; to: Date };

const ENGINE_COLORS = {
  yandex: "hsl(10, 85%, 57%)",
  google: "hsl(217, 89%, 61%)",
  other: "hsl(var(--muted-foreground))",
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

function ChangeIndicator({ value, className }: { value: number; className?: string }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value > 0;
  return (
    <span className={cn("inline-flex items-center gap-0.5 text-xs font-semibold", positive ? "text-emerald-500" : "text-red-500", className)}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{Math.round(value * 10) / 10}%
    </span>
  );
}

const DualTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: p.color }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

type QueryEngine = "yandex" | "google";

interface SeoQuery {
  query: string;
  clicks: number;
  impressions: number;
  position: number;
  positionTrend: number[];
  engine: QueryEngine;
}

function generateSeoData(dateFrom: Date, dateTo: Date) {
  const days = differenceInDays(dateTo, dateFrom) + 1;
  const queries: SeoQuery[] = [
    { query: "купить цветы", clicks: 342, impressions: 8200, position: 4.2, positionTrend: [5.1, 4.8, 4.5, 4.3, 4.2, 4.0, 4.2], engine: "yandex" },
    { query: "buy flowers online", clicks: 280, impressions: 6800, position: 5.1, positionTrend: [6.5, 6.0, 5.6, 5.3, 5.1, 5.0, 5.1], engine: "google" },
    { query: "доставка цветов", clicks: 218, impressions: 5600, position: 6.8, positionTrend: [8.2, 7.5, 7.1, 6.9, 6.8, 6.5, 6.8], engine: "yandex" },
    { query: "flower delivery moscow", clicks: 195, impressions: 4900, position: 7.2, positionTrend: [9.0, 8.5, 7.8, 7.5, 7.2, 7.0, 7.2], engine: "google" },
    { query: "букет роз", clicks: 187, impressions: 4100, position: 3.1, positionTrend: [4.0, 3.8, 3.5, 3.2, 3.1, 3.0, 3.1], engine: "yandex" },
    { query: "цветы москва", clicks: 156, impressions: 2900, position: 2.4, positionTrend: [3.5, 3.0, 2.8, 2.6, 2.4, 2.3, 2.4], engine: "yandex" },
    { query: "roses bouquet", clicks: 142, impressions: 3200, position: 8.3, positionTrend: [10.0, 9.5, 9.0, 8.6, 8.3, 8.1, 8.3], engine: "google" },
    { query: "свадебный букет", clicks: 134, impressions: 3800, position: 7.5, positionTrend: [9.0, 8.5, 8.0, 7.8, 7.5, 7.3, 7.5], engine: "yandex" },
    { query: "цветы оптом", clicks: 98, impressions: 2200, position: 11.3, positionTrend: [15.0, 13.5, 12.8, 12.0, 11.5, 11.3, 11.3], engine: "yandex" },
    { query: "wedding flowers", clicks: 88, impressions: 2100, position: 12.1, positionTrend: [15.0, 14.0, 13.0, 12.5, 12.1, 12.0, 12.1], engine: "google" },
  ];

  // Visibility by engine
  const engineData = [];
  for (let i = 0; i < Math.min(days, 30); i++) {
    const d = new Date(dateFrom);
    d.setDate(d.getDate() + i);
    engineData.push({
      day: format(d, "dd.MM"),
      yandex: Math.round(25 + Math.random() * 20 + i * 0.8),
      google: Math.round(18 + Math.random() * 15 + i * 1.2),
      other: Math.round(3 + Math.random() * 5),
    });
  }

  // Landing pages by engine
  const yandexLandings = [
    { url: "/catalog", title: "Каталог цветов", visits: 1250 },
    { url: "/bouquets/roses", title: "Букеты из роз", visits: 890 },
    { url: "/", title: "Главная", visits: 780 },
    { url: "/delivery", title: "Доставка", visits: 540 },
    { url: "/corporate", title: "Корпоративным клиентам", visits: 320 },
  ];
  const googleLandings = [
    { url: "/", title: "Главная", visits: 980 },
    { url: "/catalog", title: "Каталог цветов", visits: 720 },
    { url: "/blog/spring-flowers", title: "Весенние цветы: гид", visits: 560 },
    { url: "/bouquets/roses", title: "Букеты из роз", visits: 410 },
    { url: "/blog/wedding-bouquets", title: "Свадебные букеты", visits: 340 },
  ];

  return { queries, engineData, yandexLandings, googleLandings };
}

export function SeoTab({ projectId }: SeoTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState<DateRange>(range);

  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>({
    from: subYears(subDays(today, 30), 1), to: subYears(today, 1),
  });
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>(compRange);

  const { data: cachedReport } = useQuery({
    queryKey: ["cached_report", projectId],
    queryFn: async () => {
      const now = new Date();
      const { data } = await supabase.from("cached_reports").select("*")
        .eq("project_id", projectId).eq("report_year", now.getFullYear()).eq("report_month", now.getMonth()).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  const aiSummary = cachedReport?.report_data && typeof cachedReport.report_data === 'object' && 'ai_summary' in (cachedReport.report_data as any)
    ? (cachedReport.report_data as any).ai_summary : undefined;

  const { queries, engineData, yandexLandings, googleLandings } = useMemo(
    () => generateSeoData(appliedRange.from, appliedRange.to), [appliedRange]
  );

  const compData = useMemo(() => {
    if (!showComparison) return null;
    return generateSeoData(appliedCompRange.from, appliedCompRange.to);
  }, [showComparison, appliedCompRange]);

  // Merge engine data for comparison
  const mergedEngineData = useMemo(() => {
    if (!showComparison || !compData) return engineData;
    const maxLen = Math.max(engineData.length, compData.engineData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        day: engineData[i]?.day || `${i + 1}`,
        yandex: engineData[i]?.yandex || 0,
        google: engineData[i]?.google || 0,
        prevYandex: compData.engineData[i]?.yandex || 0,
        prevGoogle: compData.engineData[i]?.google || 0,
      });
    }
    return result;
  }, [engineData, compData, showComparison]);

  const queriesWithDelta = useMemo(() => {
    if (!showComparison || !compData) return queries.map(q => ({ ...q, clicksDelta: 0, positionDelta: 0 }));
    return queries.map(q => {
      const prev = compData.queries.find(cq => cq.query === q.query);
      return {
        ...q,
        clicksDelta: prev ? ((q.clicks - prev.clicks) / prev.clicks) * 100 : 0,
        positionDelta: prev ? q.position - prev.position : 0,
      };
    });
  }, [queries, compData, showComparison]);

  const handleApply = () => {
    setAppliedRange({ ...range });
    if (showComparison) setAppliedCompRange({ ...compRange });
  };

  const handleCompPreset = (type: "previous" | "lastYear") => {
    const days = differenceInDays(range.to, range.from);
    const nr = type === "previous"
      ? { from: subDays(range.from, days + 1), to: subDays(range.from, 1) }
      : { from: subYears(range.from, 1), to: subYears(range.to, 1) };
    setCompRange(nr);
  };

  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
  const avgPosition = queries.length > 0
    ? Math.round((queries.reduce((s, q) => s + q.position, 0) / queries.length) * 10) / 10 : 0;

  const yandexClicks = queries.filter(q => q.engine === "yandex").reduce((s, q) => s + q.clicks, 0);
  const googleClicks = queries.filter(q => q.engine === "google").reduce((s, q) => s + q.clicks, 0);
  const yandexShare = totalClicks > 0 ? Math.round((yandexClicks / totalClicks) * 1000) / 10 : 0;
  const googleShare = totalClicks > 0 ? Math.round((googleClicks / totalClicks) * 1000) / 10 : 0;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
              {t("comparison.a", "А")}
            </span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-[170px]">
                  <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                  {format(range.from, "dd.MM.yy", { locale })} — {format(range.to, "dd.MM.yy", { locale })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={{ from: range.from, to: range.to }}
                  onSelect={(r: any) => { if (r?.from) setRange({ from: r.from, to: r.to || r.from }); }}
                  numberOfMonths={1} locale={locale} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <span className="text-xs font-bold text-muted-foreground px-1">VS</span>

            <div className={cn("flex items-center gap-1.5 transition-opacity", !showComparison && "opacity-40 pointer-events-none")}>
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {t("comparison.b", "Б")}
              </span>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5 min-w-[170px]" disabled={!showComparison}>
                    <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
                    {format(compRange.from, "dd.MM.yy", { locale })} — {format(compRange.to, "dd.MM.yy", { locale })}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="range" selected={{ from: compRange.from, to: compRange.to }}
                    onSelect={(r: any) => { if (r?.from) setCompRange({ from: r.from, to: r.to || r.from }); }}
                    numberOfMonths={1} locale={locale} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2 ml-1">
              <Switch id="seo-comp" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90" />
              <Label htmlFor="seo-comp" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                {t("comparison.enable")}
              </Label>
            </div>

            <Button size="sm" className="h-8 text-xs ml-auto" onClick={handleApply}>
              {t("project.analytics.apply")}
            </Button>
          </div>

          {showComparison && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{t("comparison.presets")}:</span>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("previous")}>
                {t("project.analytics.prevPeriod")}
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("lastYear")}>
                {t("project.analytics.lastYear")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI row — with engine share */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("seoTab.totalClicks")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalClicks.toLocaleString()}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("seoTab.totalImpressions")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalImpressions.toLocaleString()}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("seoTab.avgPosition")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{avgPosition}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <YandexIcon />
            <p className="text-xs text-muted-foreground">{t("seoTab.yandexShare", "Доля Яндекса")}</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{yandexShare}%</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <div className="flex items-center gap-1.5 mb-1">
            <GoogleIcon />
            <p className="text-xs text-muted-foreground">{t("seoTab.googleShare", "Доля Google")}</p>
          </div>
          <p className="text-2xl font-bold text-foreground">{googleShare}%</p>
        </Card>
      </div>

      {/* Search Engine Dynamics Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("seoTab.engineDynamics", "Динамика по поисковым системам")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            {showComparison ? (
              <LineChart data={mergedEngineData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<DualTooltip />} />
                <Legend />
                <Line type="monotone" dataKey="yandex" name={t("engines.yandex")}
                  stroke={ENGINE_COLORS.yandex} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="google" name={t("engines.google")}
                  stroke={ENGINE_COLORS.google} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                <Line type="monotone" dataKey="prevYandex" name={`${t("engines.yandex")} (${t("comparison.periodB")})`}
                  stroke={ENGINE_COLORS.yandex} strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} />
                <Line type="monotone" dataKey="prevGoogle" name={`${t("engines.google")} (${t("comparison.periodB")})`}
                  stroke={ENGINE_COLORS.google} strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} />
              </LineChart>
            ) : (
              <AreaChart data={mergedEngineData}>
                <defs>
                  <linearGradient id="seoYandexGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="seoGoogleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ENGINE_COLORS.google} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={ENGINE_COLORS.google} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<DualTooltip />} />
                <Legend />
                <Area type="monotone" dataKey="yandex" name={t("engines.yandex")}
                  stroke={ENGINE_COLORS.yandex} strokeWidth={2} fill="url(#seoYandexGrad)" dot={false} activeDot={{ r: 3 }} />
                <Area type="monotone" dataKey="google" name={t("engines.google")}
                  stroke={ENGINE_COLORS.google} strokeWidth={2} fill="url(#seoGoogleGrad)" dot={false} activeDot={{ r: 3 }} />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Queries Table with engine icons */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("seoTab.queriesTable")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs w-8"></TableHead>
                  <TableHead className="text-xs">{t("seoTab.query")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.clicks")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.impressions")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.position")}</TableHead>
                  <TableHead className="text-xs text-center">{t("seoTab.trend")}</TableHead>
                  {showComparison && <TableHead className="text-xs text-right">{t("seoTab.change")}</TableHead>}
                  {showComparison && <TableHead className="text-xs text-right">{t("seoTab.posChange")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {queriesWithDelta.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="pr-0">
                      {q.engine === "yandex" ? <YandexIcon /> : <GoogleIcon />}
                    </TableCell>
                    <TableCell className="text-sm font-medium">{q.query}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.position.toFixed(1)}</TableCell>
                    <TableCell className="text-center">
                      <Sparkline data={q.positionTrend} color={q.positionTrend[0] > q.positionTrend[q.positionTrend.length - 1] ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} />
                    </TableCell>
                    {showComparison && (
                      <TableCell className="text-right"><ChangeIndicator value={q.clicksDelta} /></TableCell>
                    )}
                    {showComparison && (
                      <TableCell className="text-right">
                        <span className={cn("text-xs font-semibold", q.positionDelta < 0 ? "text-emerald-500" : q.positionDelta > 0 ? "text-red-500" : "text-muted-foreground")}>
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

      {/* Landing Pages by Engine */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Yandex Top Landing Pages */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <YandexIcon />
              {t("seoTab.yandexLandings", "Топ-5 страниц из Яндекса")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">{t("pagesTab.page", "Страница")}</TableHead>
                  <TableHead className="text-xs text-right">{t("pagesTab.visits", "Визиты")}</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {yandexLandings.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <p className="text-sm font-medium truncate max-w-[180px]">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground">{p.url}</p>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.visits.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Google Top Landing Pages */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <GoogleIcon />
              {t("seoTab.googleLandings", "Топ-5 страниц из Google")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">{t("pagesTab.page", "Страница")}</TableHead>
                  <TableHead className="text-xs text-right">{t("pagesTab.visits", "Визиты")}</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {googleLandings.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <p className="text-sm font-medium truncate max-w-[180px]">{p.title}</p>
                      <p className="text-[11px] text-muted-foreground">{p.url}</p>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.visits.toLocaleString()}</TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-6 w-6" asChild>
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3 w-3 text-muted-foreground" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      {/* AI Insights - SEO context */}
      <AiInsightsBlock
        projectId={projectId}
        summary={aiSummary}
        isAdmin={true}
        trafficSources={[]}
      />
    </div>
  );
}
