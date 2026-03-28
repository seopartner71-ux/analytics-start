import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subYears, differenceInDays, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link2, CalendarIcon, ArrowRightLeft, Loader2, TrendingUp, TrendingDown, Globe } from "lucide-react";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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
  onSwitchToSeo?: () => void;
  onSwitchToPages?: () => void;
}

type DateRange = { from: Date; to: Date };

const PRESETS = [
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
] as const;

const COMPARISON_COLORS = {
  current: "hsl(var(--chart-1))",
  previous: "hsl(var(--chart-3))",
};

// Dual-period tooltip
const DualTooltip = ({ active, payload, label, showComparison, periodALabel, periodBLabel }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => {
        const isPeriodB = p.dataKey === "previous";
        return (
          <div key={i} className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-1.5 text-xs">
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: p.color }}
              />
              {isPeriodB ? (periodBLabel || "Б") : (periodALabel || "А")}
            </span>
            <span className="text-sm font-semibold tabular-nums" style={{ color: p.color }}>
              {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
            </span>
          </div>
        );
      })}
      {showComparison && payload.length === 2 && payload[0].value > 0 && payload[1].value > 0 && (
        <div className="border-t border-border mt-1.5 pt-1">
          <span className={cn(
            "text-xs font-semibold",
            payload[0].value >= payload[1].value ? "text-emerald-500" : "text-red-500"
          )}>
            Δ {payload[0].value >= payload[1].value ? "+" : ""}
            {Math.round(((payload[0].value - payload[1].value) / payload[1].value) * 1000) / 10}%
          </span>
        </div>
      )}
    </div>
  );
};

const SimpleTooltip = ({ active, payload, label }: any) => {
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

export function AnalyticsTab({ projectId, onSwitchToGoals, onSwitchToSeo, onSwitchToPages }: AnalyticsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState<DateRange>(range);
  const [activePreset, setActivePreset] = useState<string>("30d");

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>({
    from: subYears(subDays(today, 30), 1),
    to: subYears(today, 1),
  });
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>(compRange);
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
      const visits = entry.visits || 0;
      return {
        date, dateStr: format(date, "dd.MM", { locale }),
        visits,
      };
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

  // Search engine visibility toggles
  const [showYandex, setShowYandex] = useState(true);
  const [showGoogle, setShowGoogle] = useState(true);
  const [showOther, setShowOther] = useState(true);

  // KPI calculations
  const totalVisits = filteredData.reduce((s, d) => s + d.visits, 0);
  const avgVisits = filteredData.length > 0 ? Math.round(totalVisits / filteredData.length) : 0;
  const bounceRate = latestStat?.bounce_rate || 0;
  const pageDepth = latestStat?.page_depth || 0;
  const avgDuration = latestStat?.avg_duration_seconds || 0;
  const sparkData = filteredData.map((d) => ({ v: d.visits }));

  const compTotalVisits = filteredCompData.reduce((s, d) => s + d.visits, 0);
  const compAvgVisits = filteredCompData.length > 0 ? Math.round(compTotalVisits / filteredCompData.length) : 0;
  const visitsChange = compTotalVisits > 0 ? ((totalVisits - compTotalVisits) / compTotalVisits) * 100 : 0;
  const avgVisitsChange = compAvgVisits > 0 ? ((avgVisits - compAvgVisits) / compAvgVisits) * 100 : 0;

  // Traffic sources
  const TRAFFIC_COLORS = [
    "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
    "hsl(var(--chart-4))", "hsl(var(--chart-5))", "hsl(210 70% 50%)",
    "hsl(340 65% 50%)", "hsl(160 60% 40%)",
  ];

  // Search engine colors
  const ENGINE_COLORS = {
    yandex: "hsl(10, 85%, 57%)",   // Yandex red-orange
    google: "hsl(217, 89%, 61%)",  // Google blue
    other: "hsl(var(--muted-foreground))",
  };

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
      const currentDate = filteredData[i]?.date;
      const compDate = filteredCompData[i]?.date;
      result.push({
        day: filteredData[i]?.dateStr || `${i + 1}`,
        dayLabel: currentDate
          ? `${format(currentDate, "dd.MM.yy", { locale })}${compDate ? ` | ${format(compDate, "dd.MM.yy", { locale })}` : ""}`
          : `${i + 1}`,
        current: filteredData[i]?.visits || 0,
        previous: filteredCompData[i]?.visits || 0,
      });
    }
    return result;
  }, [filteredData, filteredCompData, locale]);

  const handlePreset = (key: string, days: number) => {
    const newRange = { from: subDays(today, days), to: today };
    setActivePreset(key);
    setRange(newRange);
    setAppliedRange(newRange);
    // Default comparison: YoY
    setCompRange({ from: subYears(newRange.from, 1), to: subYears(newRange.to, 1) });
    setAppliedCompRange({ from: subYears(newRange.from, 1), to: subYears(newRange.to, 1) });
  };

  const handleCompPreset = (type: "previous" | "lastYear") => {
    const days = differenceInDays(range.to, range.from);
    let nr: DateRange;
    if (type === "previous") {
      nr = { from: subDays(range.from, days + 1), to: subDays(range.from, 1) };
    } else {
      nr = { from: subYears(range.from, 1), to: subYears(range.to, 1) };
    }
    setCompRange(nr);
  };

  const handleToggleComparison = (on: boolean) => {
    setShowComparison(on);
    if (on) {
      // Default to YoY when turning on
      const nr = { from: subYears(range.from, 1), to: subYears(range.to, 1) };
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

  const periodALabel = t("comparison.periodA", "Период А");
  const periodBLabel = t("comparison.periodB", "Период Б");

  const kpis = [
    {
      label: t("publicReport.kpi.visits", "Визиты"),
      value: totalVisits.toLocaleString(),
      change: showComparison ? Math.round(visitsChange * 10) / 10 : 0,
      positive: visitsChange >= 0,
      sparkData,
      color: "hsl(var(--chart-1))",
      compValue: showComparison ? compTotalVisits.toLocaleString() : undefined,
    },
    {
      label: t("project.analytics.avgVisits", "Ср. визитов/день"),
      value: avgVisits.toLocaleString(),
      change: showComparison ? Math.round(avgVisitsChange * 10) / 10 : 0,
      positive: avgVisitsChange >= 0,
      sparkData,
      color: "hsl(var(--chart-5))",
      compValue: showComparison ? compAvgVisits.toLocaleString() : undefined,
    },
    {
      label: t("publicReport.kpi.bounceRate", "Отказы"),
      value: `${bounceRate}%`,
      change: 0,
      positive: false,
      sparkData: [],
      color: "hsl(var(--chart-3))",
    },
    {
      label: t("project.analytics.pageDepth", "Глубина просмотра"),
      value: String(pageDepth),
      change: 0,
      positive: true,
      sparkData: [],
      color: "hsl(var(--chart-2))",
    },
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
      {/* ═══════════════ NEW FILTER BAR ═══════════════ */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          {/* Row 1: Presets */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            {PRESETS.map((p) => (
              <Button
                key={p.key}
                variant={activePreset === p.key ? "default" : "outline"}
                size="sm" className="h-7 text-xs px-3"
                onClick={() => handlePreset(p.key, p.days)}
              >
                {`${p.days}${i18n.language === "ru" ? "д" : "d"}`}
              </Button>
            ))}
          </div>

          {/* Row 2: Period A | VS | Period B | Toggle | Apply */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Period A */}
            <div className="flex items-center gap-1.5">
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
                  <Calendar
                    mode="range"
                    selected={{ from: range.from, to: range.to }}
                    onSelect={(r: any) => {
                      if (r?.from && r?.to) { setRange({ from: r.from, to: r.to }); setActivePreset(""); }
                      else if (r?.from) { setRange({ from: r.from, to: r.from }); setActivePreset(""); }
                    }}
                    numberOfMonths={1} locale={locale}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* VS separator */}
            <span className="text-xs font-bold text-muted-foreground px-1">VS</span>

            {/* Period B */}
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
                  <Calendar
                    mode="range"
                    selected={{ from: compRange.from, to: compRange.to }}
                    onSelect={(r: any) => {
                      if (r?.from && r?.to) setCompRange({ from: r.from, to: r.to });
                      else if (r?.from) setCompRange({ from: r.from, to: r.from });
                    }}
                    numberOfMonths={1} locale={locale}
                    className="p-3 pointer-events-auto"
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Toggle */}
            <div className="flex items-center gap-2 ml-1">
              <Switch id="comp-toggle" checked={showComparison} onCheckedChange={handleToggleComparison} className="scale-90" />
              <Label htmlFor="comp-toggle" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                {t("comparison.enable", "Сравнение")}
              </Label>
            </div>

            {/* Apply */}
            <Button size="sm" className="h-8 text-xs ml-auto" onClick={handleApply}>
              {t("project.analytics.apply", "Применить")}
            </Button>
          </div>

          {/* Row 3: Comparison presets (only when comparison on) */}
          {showComparison && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{t("comparison.presets", "Пресеты")}:</span>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("previous")}>
                {t("project.analytics.prevPeriod", "Предыдущий период")}
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("lastYear")}>
                {t("project.analytics.lastYear", "Год назад")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi, i) => (
          <KpiCard
            key={i}
            label={kpi.label}
            value={kpi.value}
            change={kpi.change}
            positive={kpi.positive}
            sparkData={kpi.sparkData}
            chartColor={kpi.color}
            compValue={kpi.compValue}
            showComparison={showComparison}
          />
        ))}
      </div>

      {/* Traffic Chart — by Search Engine */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("project.analytics.traffic")}
            <span className="ml-2 text-xs font-normal">
              {format(appliedRange.from, "dd.MM.yy", { locale })} — {format(appliedRange.to, "dd.MM.yy", { locale })}
              {showComparison && (
                <span className="text-muted-foreground/60 ml-1">
                  vs {format(appliedCompRange.from, "dd.MM.yy", { locale })} — {format(appliedCompRange.to, "dd.MM.yy", { locale })}
                </span>
              )}
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
                    <Tooltip content={<DualTooltip showComparison periodALabel={periodALabel} periodBLabel={periodBLabel} />} />
                    <Legend />
                    {showCurrentLine && (
                      <Line type="monotone" dataKey="current" name={periodALabel}
                        stroke={COMPARISON_COLORS.current} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    )}
                    {showPreviousLine && (
                      <Line type="monotone" dataKey="previous" name={periodBLabel}
                        stroke={COMPARISON_COLORS.previous} strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
                    )}
                  </LineChart>
                ) : (
                  <AreaChart data={filteredData}>
                    <defs>
                      <linearGradient id="yandexGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="googleGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ENGINE_COLORS.google} stopOpacity={0.2} />
                        <stop offset="95%" stopColor={ENGINE_COLORS.google} stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="otherGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={ENGINE_COLORS.other} stopOpacity={0.1} />
                        <stop offset="95%" stopColor={ENGINE_COLORS.other} stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="dateStr" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<SimpleTooltip />} />
                    {showYandex && (
                      <Area type="monotone" dataKey="yandex" name={t("engines.yandex", "Яндекс")}
                        stroke={ENGINE_COLORS.yandex} strokeWidth={2} fill="url(#yandexGrad)" dot={false}
                        activeDot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--card))" }} stackId="engines" />
                    )}
                    {showGoogle && (
                      <Area type="monotone" dataKey="google" name={t("engines.google", "Google")}
                        stroke={ENGINE_COLORS.google} strokeWidth={2} fill="url(#googleGrad)" dot={false}
                        activeDot={{ r: 3, strokeWidth: 2, stroke: "hsl(var(--card))" }} stackId="engines" />
                    )}
                    {showOther && (
                      <Area type="monotone" dataKey="other" name={t("engines.other", "Другие")}
                        stroke={ENGINE_COLORS.other} strokeWidth={1.5} fill="url(#otherGrad)" dot={false}
                        activeDot={{ r: 3 }} stackId="engines" />
                    )}
                  </AreaChart>
                )}
              </ResponsiveContainer>

              {/* Interactive legend */}
              <div className="flex items-center gap-4 mt-3 ml-4 flex-wrap">
                {!showComparison ? (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showYandex} onChange={(e) => setShowYandex(e.target.checked)} className="accent-[hsl(10,85%,57%)] h-3.5 w-3.5" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ background: ENGINE_COLORS.yandex }} />
                        {t("engines.yandex", "Яндекс")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showGoogle} onChange={(e) => setShowGoogle(e.target.checked)} className="accent-[hsl(217,89%,61%)] h-3.5 w-3.5" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm" style={{ background: ENGINE_COLORS.google }} />
                        {t("engines.google", "Google")}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showOther} onChange={(e) => setShowOther(e.target.checked)} className="accent-gray-400 h-3.5 w-3.5" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-sm bg-muted-foreground/40" />
                        {t("engines.other", "Другие")}
                      </span>
                    </label>
                  </>
                ) : (
                  <>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showCurrentLine} onChange={(e) => setShowCurrentLine(e.target.checked)} className="accent-primary" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-4 h-0.5 rounded" style={{ background: COMPARISON_COLORS.current }} />
                        {periodALabel}
                      </span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={showPreviousLine} onChange={(e) => setShowPreviousLine(e.target.checked)} className="accent-muted-foreground" />
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <span className="w-4 h-0.5 rounded border-b border-dashed" style={{ borderColor: COMPARISON_COLORS.previous }} />
                        {periodBLabel}
                      </span>
                    </label>
                  </>
                )}
              </div>

              {/* Search engine breakdown table */}
              {(() => {
                const totalYandex = filteredData.reduce((s, d) => s + d.yandex, 0);
                const totalGoogle = filteredData.reduce((s, d) => s + d.google, 0);
                const totalOtherEng = filteredData.reduce((s, d) => s + d.other, 0);
                const totalAll = totalYandex + totalGoogle + totalOtherEng;

                const compYandex = filteredCompData.reduce((s, d) => s + d.yandex, 0);
                const compGoogle = filteredCompData.reduce((s, d) => s + d.google, 0);
                const compOtherEng = filteredCompData.reduce((s, d) => s + d.other, 0);

                const calcChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;
                const calcShare = (val: number) => totalAll > 0 ? ((val / totalAll) * 100) : 0;

                // Simulated bounce rates per engine
                const bounceMeta = { yandex: 38.2, google: 42.5, other: 55.1 };

                const engines = [
                  { key: "yandex", visits: totalYandex, compVisits: compYandex, bounce: bounceMeta.yandex },
                  { key: "google", visits: totalGoogle, compVisits: compGoogle, bounce: bounceMeta.google },
                  { key: "other", visits: totalOtherEng, compVisits: compOtherEng, bounce: bounceMeta.other },
                ];

                const handleEngineClick = (engineKey: string) => {
                  if (showComparison) return;
                  // Toggle: if only this engine is shown, show all; otherwise show only this one
                  const allOn = showYandex && showGoogle && showOther;
                  const onlyThis =
                    (engineKey === "yandex" && showYandex && !showGoogle && !showOther) ||
                    (engineKey === "google" && !showYandex && showGoogle && !showOther) ||
                    (engineKey === "other" && !showYandex && !showGoogle && showOther);

                  if (onlyThis) {
                    setShowYandex(true); setShowGoogle(true); setShowOther(true);
                  } else {
                    setShowYandex(engineKey === "yandex");
                    setShowGoogle(engineKey === "google");
                    setShowOther(engineKey === "other");
                  }
                };

                const YandexLogo = () => (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold text-white" style={{ background: ENGINE_COLORS.yandex }}>Я</span>
                );
                const GoogleLogo = () => (
                  <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold" style={{ background: ENGINE_COLORS.google, color: "#fff" }}>G</span>
                );

                return (
                  <div className="mt-4 border-t border-border pt-4">
                    <Table>
                      <TableHeader>
                        <TableRow className="border-border hover:bg-transparent">
                          <TableHead className="text-xs">{t("engineTable.engine", "Поисковая система")}</TableHead>
                          <TableHead className="text-xs text-right">{t("engineTable.visits", "Визиты")}</TableHead>
                          {showComparison && <TableHead className="text-xs text-right">{t("engineTable.change", "Изменение (%)")}</TableHead>}
                          <TableHead className="text-xs text-right">{t("engineTable.share", "Доля (%)")}</TableHead>
                          <TableHead className="text-xs text-right">{t("engineTable.bounce", "Отказы (%)")}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {engines.map((eng) => {
                          const change = calcChange(eng.visits, eng.compVisits);
                          const share = calcShare(eng.visits);
                          return (
                            <TableRow
                              key={eng.key}
                              className="border-border cursor-pointer hover:bg-muted/30 transition-colors"
                              onClick={() => handleEngineClick(eng.key)}
                            >
                              <TableCell className="py-2.5">
                                <div className="flex items-center gap-2">
                                  {eng.key === "yandex" && <YandexLogo />}
                                  {eng.key === "google" && <GoogleLogo />}
                                  {eng.key === "other" && <Globe className="h-5 w-5 text-muted-foreground" />}
                                  <span className="text-sm font-medium text-foreground">
                                    {t(`engines.${eng.key}`)}
                                  </span>
                                </div>
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <span className="text-sm font-semibold tabular-nums text-foreground">
                                  {eng.visits.toLocaleString()}
                                </span>
                                {showComparison && eng.compVisits > 0 && (
                                  <span className="block text-[11px] text-muted-foreground">
                                    {t("engineTable.was", "было")}: {eng.compVisits.toLocaleString()}
                                  </span>
                                )}
                              </TableCell>
                              {showComparison && (
                                <TableCell className="text-right py-2.5">
                                  <ChangeIndicator value={Math.round(change * 10) / 10} />
                                </TableCell>
                              )}
                              <TableCell className="text-right py-2.5">
                                <span className="text-sm tabular-nums text-foreground">{share.toFixed(1)}%</span>
                              </TableCell>
                              <TableCell className="text-right py-2.5">
                                <span className="text-sm tabular-nums text-foreground">{eng.bounce}%</span>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                );
              })()}
            </>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              {t("project.analytics.noData", "Нет данных за выбранный период")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison period summary cards */}
      {showComparison && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/10 px-1.5 py-0.5 rounded">
                {t("comparison.a", "А")}
              </span>
              <p className="text-xs text-muted-foreground">{periodALabel}</p>
            </div>
            <p className="text-sm font-semibold text-foreground">
              {format(appliedRange.from, "dd.MM.yy", { locale })} — {format(appliedRange.to, "dd.MM.yy", { locale })}
            </p>
            <p className="text-2xl font-bold text-foreground mt-2">
              {totalVisits.toLocaleString()}
              <span className="text-sm font-normal text-muted-foreground ml-1">{t("project.analytics.visits", "визитов")}</span>
            </p>
          </Card>
          <Card className="border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {t("comparison.b", "Б")}
              </span>
              <p className="text-xs text-muted-foreground">{periodBLabel}</p>
            </div>
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
                  <Tooltip content={<SimpleTooltip />} />
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
                  <Tooltip content={<SimpleTooltip />} />
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
