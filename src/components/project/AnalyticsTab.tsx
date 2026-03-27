import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subYears, differenceInDays, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link2, CalendarIcon, ArrowRightLeft, Loader2, TrendingUp, TrendingDown } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
} from "recharts";
import { KpiCard } from "@/components/KpiCard";
import { GoalsPerformance } from "@/components/project/GoalsPerformance";
import { supabase } from "@/integrations/supabase/client";

interface AnalyticsTabProps {
  projectId: string;
  onSwitchToGoals?: () => void;
}

type DateRange = { from: Date; to: Date };

const PRESETS = [
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
] as const;

type MetricKey = "visits" | "bounceRate" | "pageDepth" | "avgDuration";

const COMPARISON_COLORS = {
  current: "hsl(var(--chart-1))",
  previous: "hsl(var(--chart-3))",
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md shadow-sm px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

function DateRangePicker({ range, onChange, locale, label }: {
  range: DateRange; onChange: (r: DateRange) => void; locale: any; label: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs text-muted-foreground whitespace-nowrap">{label}:</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2">
            <CalendarIcon className="h-3 w-3" />
            {format(range.from, "dd.MM.yy", { locale })} — {format(range.to, "dd.MM.yy", { locale })}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={{ from: range.from, to: range.to }}
            onSelect={(r: any) => {
              if (r?.from && r?.to) onChange({ from: r.from, to: r.to });
              else if (r?.from) onChange({ from: r.from, to: r.from });
            }}
            numberOfMonths={2}
            locale={locale}
            className="p-3 pointer-events-auto"
          />
        </PopoverContent>
      </Popover>
    </div>
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

export function AnalyticsTab({ projectId, onSwitchToGoals }: AnalyticsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState<DateRange>(range);
  const [activePreset, setActivePreset] = useState<string>("30d");

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>({
    from: subDays(today, 61), to: subDays(today, 31),
  });
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>(compRange);
  const [compMetric, setCompMetric] = useState<MetricKey>("visits");
  const [showCurrentLine, setShowCurrentLine] = useState(true);
  const [showPreviousLine, setShowPreviousLine] = useState(true);

  // Fetch metrika stats
  const { data: allStats = [], isLoading } = useQuery({
    queryKey: ["metrika-stats-all", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats").select("*").eq("project_id", projectId)
        .order("fetched_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const latestStat = allStats[0];

  // Build daily data array with real dates
  const dailyData = useMemo(() => {
    if (!latestStat) return [];
    const visitsByDay = (latestStat.visits_by_day as any[]) || [];
    const dateFrom = parseISO(latestStat.date_from);
    return visitsByDay.map((entry: any, index: number) => {
      const date = new Date(dateFrom);
      date.setDate(date.getDate() + index);
      return { date, dateStr: format(date, "dd.MM", { locale }), visits: entry.visits || 0 };
    });
  }, [latestStat, locale]);

  // Filter by applied range
  const filteredData = useMemo(
    () => dailyData.filter((d) => d.date >= appliedRange.from && d.date <= appliedRange.to),
    [dailyData, appliedRange]
  );

  const filteredCompData = useMemo(
    () => dailyData.filter((d) => d.date >= appliedCompRange.from && d.date <= appliedCompRange.to),
    [dailyData, appliedCompRange]
  );

  // KPI calculations
  const totalVisits = filteredData.reduce((s, d) => s + d.visits, 0);
  const avgVisits = filteredData.length > 0 ? Math.round(totalVisits / filteredData.length) : 0;
  const bounceRate = latestStat?.bounce_rate || 0;
  const pageDepth = latestStat?.page_depth || 0;
  const avgDuration = latestStat?.avg_duration_seconds || 0;
  const sparkData = filteredData.map((d) => ({ v: d.visits }));

  const compTotalVisits = filteredCompData.reduce((s, d) => s + d.visits, 0);
  const visitsChange = compTotalVisits > 0 ? ((totalVisits - compTotalVisits) / compTotalVisits) * 100 : 0;

  // Traffic sources
  const TRAFFIC_COLORS = [
    "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
    "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(210 70% 50%)",
    "hsl(340 65% 50%)", "hsl(160 60% 40%)",
  ];

  const trafficSourcesData = useMemo(() => {
    if (!latestStat) return [];
    const sources = (latestStat as any).traffic_sources as { source: string; visits: number }[] | undefined;
    if (!sources?.length) return [];
    return sources.sort((a, b) => b.visits - a.visits);
  }, [latestStat]);

  // Merged comparison chart data (current + previous aligned by day index)
  const comparisonChartData = useMemo(() => {
    const maxLen = Math.max(filteredData.length, filteredCompData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        day: filteredData[i]?.dateStr || `${i + 1}`,
        current: filteredData[i]?.visits || 0,
        previous: filteredCompData[i]?.visits || 0,
      });
    }
    return result;
  }, [filteredData, filteredCompData]);

  // Merged main chart data for overlay mode
  const mainChartData = useMemo(() => {
    if (!showComparison) return filteredData;
    return filteredData.map((d, i) => ({
      ...d,
      previousVisits: filteredCompData[i]?.visits || 0,
    }));
  }, [filteredData, filteredCompData, showComparison]);

  const handlePreset = (key: string, days: number) => {
    const newRange = { from: subDays(today, days), to: today };
    setActivePreset(key);
    setRange(newRange);
    setAppliedRange(newRange);
    setCompRange({ from: subDays(today, days * 2 + 1), to: subDays(today, days + 1) });
    setAppliedCompRange({ from: subDays(today, days * 2 + 1), to: subDays(today, days + 1) });
  };

  const handleCompPreset = (type: "previous" | "lastYear") => {
    const days = differenceInDays(appliedRange.to, appliedRange.from);
    if (type === "previous") {
      const nr = { from: subDays(appliedRange.from, days + 1), to: subDays(appliedRange.from, 1) };
      setCompRange(nr);
      setAppliedCompRange(nr);
    } else {
      const nr = { from: subYears(appliedRange.from, 1), to: subYears(appliedRange.to, 1) };
      setCompRange(nr);
      setAppliedCompRange(nr);
    }
  };

  const handleApply = () => {
    setAppliedRange({ ...range });
    setActivePreset("");
    if (showComparison) setAppliedCompRange({ ...compRange });
    toast.success(t("project.analytics.applied", "Период применён"));
  };

  const handleGenerateReport = () => {
    const url = `${window.location.origin}/report/${projectId}`;
    navigator.clipboard.writeText(url);
    toast.success(t("project.analytics.linkCopied"));
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const kpis = [
    { label: t("publicReport.kpi.visits", "Визиты"), value: totalVisits.toLocaleString(), change: showComparison ? Math.round(visitsChange * 10) / 10 : 0, positive: visitsChange >= 0, sparkData, color: "hsl(var(--chart-1))" },
    { label: t("project.analytics.avgVisits", "Ср. визитов/день"), value: avgVisits.toLocaleString(), change: 0, positive: true, sparkData, color: "hsl(var(--chart-5))" },
    { label: t("publicReport.kpi.bounceRate", "Отказы"), value: `${bounceRate}%`, change: 0, positive: false, sparkData: [], color: "hsl(var(--chart-3))" },
    { label: t("project.analytics.pageDepth", "Глубина просмотра"), value: String(pageDepth), change: 0, positive: true, sparkData: [], color: "hsl(var(--chart-2))" },
  ];

  const metricOptions: { value: MetricKey; label: string }[] = [
    { value: "visits", label: t("publicReport.kpi.visits", "Визиты") },
    { value: "bounceRate", label: t("publicReport.kpi.bounceRate", "Отказы") },
    { value: "pageDepth", label: t("project.analytics.pageDepth", "Глубина просмотра") },
    { value: "avgDuration", label: t("project.analytics.avgDuration", "Ср. время на сайте") },
  ];

  const dateFromStr = format(appliedRange.from, "yyyy-MM-dd");
  const dateToStr = format(appliedRange.to, "yyyy-MM-dd");

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Row 1: Presets + date range + apply */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm" className="h-8 text-xs"
              onClick={() => handlePreset(p.key, p.days)}
            >
              {`${p.days}д`}
            </Button>
          ))}

          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
                <CalendarIcon className="h-3.5 w-3.5" />
                {format(range.from, "dd.MM.yy", { locale })} — {format(range.to, "dd.MM.yy", { locale })}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: range.from, to: range.to }}
                onSelect={(r: any) => {
                  if (r?.from && r?.to) { setRange({ from: r.from, to: r.to }); setActivePreset(""); }
                  else if (r?.from) { setRange({ from: r.from, to: r.from }); setActivePreset(""); }
                }}
                numberOfMonths={2} locale={locale}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
            {t("project.analytics.apply", "Применить")}
          </Button>

          {/* Comparison toggle */}
          <div className="flex items-center gap-2 ml-2">
            <Switch id="comp-toggle" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90" />
            <Label htmlFor="comp-toggle" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3" />
              {t("project.analytics.comparisonTab", "Сравнение")}
            </Label>
          </div>
        </div>

        <Button onClick={handleGenerateReport} size="sm" className="gap-2 h-8">
          <Link2 className="h-3.5 w-3.5" />
          {t("project.analytics.generateReport")}
        </Button>
      </div>

      {/* Row 2: Comparison controls */}
      {showComparison && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border bg-muted/30">
          <DateRangePicker range={compRange} onChange={setCompRange} locale={locale} label={t("project.analytics.compareTo", "Сравнить с")} />

          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCompPreset("previous")}>
              {t("project.analytics.prevPeriod", "Предыдущий период")}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCompPreset("lastYear")}>
              {t("project.analytics.lastYear", "Год назад")}
            </Button>
          </div>

          <Select value={compMetric} onValueChange={(v) => setCompMetric(v as MetricKey)}>
            <SelectTrigger className="w-[160px] h-7 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {metricOptions.map((m) => (
                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleApply}>
            {t("project.analytics.apply", "Применить")}
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard key={i} label={kpi.label} value={kpi.value} change={kpi.change} positive={kpi.positive} sparkData={kpi.sparkData} chartColor={kpi.color} />
        ))}
      </div>

      {/* Traffic Chart - with optional comparison overlay */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("project.analytics.traffic")}
            <span className="ml-2 text-xs font-normal">
              {format(appliedRange.from, "dd.MM.yy", { locale })} — {format(appliedRange.to, "dd.MM.yy", { locale })}
            </span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                {showComparison ? (
                  <LineChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    {showCurrentLine && (
                      <Line type="monotone" dataKey="current" name={t("project.analytics.currentPeriod", "Текущий период")}
                        stroke={COMPARISON_COLORS.current} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    )}
                    {showPreviousLine && (
                      <Line type="monotone" dataKey="previous" name={t("project.analytics.previousPeriod", "Период сравнения")}
                        stroke={COMPARISON_COLORS.previous} strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
                    )}
                  </LineChart>
                ) : (
                  <AreaChart data={filteredData}>
                    <defs>
                      <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="dateStr" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Area type="monotone" dataKey="visits" name={t("project.analytics.visitors", "Визиты")} stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#analyticsGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>

              {/* Legend toggles for comparison */}
              {showComparison && (
                <div className="flex items-center gap-4 mt-3 ml-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showCurrentLine} onChange={(e) => setShowCurrentLine(e.target.checked)} className="accent-[hsl(var(--chart-1))]" />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-4 h-0.5 rounded" style={{ background: COMPARISON_COLORS.current }} />
                      {t("project.analytics.currentPeriod", "Текущий период")}
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={showPreviousLine} onChange={(e) => setShowPreviousLine(e.target.checked)} className="accent-[hsl(var(--chart-3))]" />
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <span className="w-4 h-0.5 rounded border-b border-dashed" style={{ borderColor: COMPARISON_COLORS.previous }} />
                      {t("project.analytics.previousPeriod", "Период сравнения")}
                    </span>
                  </label>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              {t("project.analytics.noData", "Нет данных за выбранный период")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison period cards */}
      {showComparison && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{t("project.analytics.currentPeriod", "Текущий период")}</p>
            <p className="text-sm font-semibold text-foreground">
              {format(appliedRange.from, "dd.MM.yy", { locale })} — {format(appliedRange.to, "dd.MM.yy", { locale })}
            </p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {totalVisits.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">{t("project.analytics.visits", "визитов")}</span>
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <p className="text-xs text-muted-foreground mb-1">{t("project.analytics.previousPeriod", "Период сравнения")}</p>
            <p className="text-sm font-semibold text-foreground">
              {format(appliedCompRange.from, "dd.MM.yy", { locale })} — {format(appliedCompRange.to, "dd.MM.yy", { locale })}
            </p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {compTotalVisits > 0 ? compTotalVisits.toLocaleString() : "—"}
              <span className="text-sm font-normal text-muted-foreground ml-1">{t("project.analytics.visits", "визитов")}</span>
            </p>
            {compTotalVisits > 0 && <ChangeIndicator value={visitsChange} className="text-sm mt-1" />}
          </Card>
        </div>
      )}

      {/* Traffic Sources */}
      {trafficSourcesData.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("project.analytics.trafficSources", "Источники трафика")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={trafficSourcesData} layout="vertical" margin={{ left: 80 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis type="category" dataKey="source" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={80} />
                  <Tooltip content={<CustomTooltip />} />
                  <Bar dataKey="visits" name={t("publicReport.kpi.visits", "Визиты")} radius={[0, 4, 4, 0]}>
                    {trafficSourcesData.map((_, i) => (
                      <Cell key={i} fill={TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("project.analytics.trafficShare", "Доля трафика")}
              </CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={280}>
                <PieChart>
                  <Pie data={trafficSourcesData} dataKey="visits" nameKey="source" cx="50%" cy="50%" outerRadius={100} innerRadius={50} paddingAngle={2}
                    label={({ source, percent }) => `${source} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1 }} fontSize={11}>
                    {trafficSourcesData.map((_, i) => (
                      <Cell key={i} fill={TRAFFIC_COLORS[i % TRAFFIC_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip content={<CustomTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Goals Performance Module */}
      <GoalsPerformance projectId={projectId} dateFrom={dateFromStr} dateTo={dateToStr} onShowAllGoals={onSwitchToGoals} />

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("project.analytics.avgDuration", "Ср. время на сайте")}</p>
          <p className="text-xl font-bold text-foreground mt-1">{formatDuration(avgDuration)}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("project.analytics.totalDays", "Дней в периоде")}</p>
          <p className="text-xl font-bold text-foreground mt-1">{filteredData.length}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("project.analytics.maxVisits", "Макс. визитов/день")}</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {filteredData.length > 0 ? Math.max(...filteredData.map((d) => d.visits)).toLocaleString() : "—"}
          </p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("project.analytics.minVisits", "Мин. визитов/день")}</p>
          <p className="text-xl font-bold text-foreground mt-1">
            {filteredData.length > 0 ? Math.min(...filteredData.map((d) => d.visits)).toLocaleString() : "—"}
          </p>
        </Card>
      </div>
    </div>
  );
}
