import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, differenceInDays, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Link2, CalendarIcon, ArrowRightLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from "recharts";
import { KpiCard } from "@/components/KpiCard";
import { supabase } from "@/integrations/supabase/client";

interface AnalyticsTabProps {
  projectId: string;
}

type DateRange = { from: Date; to: Date };

const PRESETS = [
  { key: "7d", days: 7 },
  { key: "14d", days: 14 },
  { key: "30d", days: 30 },
  { key: "90d", days: 90 },
] as const;

type MetricKey = "visits" | "bounceRate" | "pageDepth" | "avgDuration";

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

// Date range picker inline component
function DateRangePicker({
  range,
  onChange,
  locale,
  label,
}: {
  range: DateRange;
  onChange: (r: DateRange) => void;
  locale: any;
  label: string;
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

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState<DateRange>(range);
  const [activePreset, setActivePreset] = useState<string>("30d");

  // Comparison state
  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>({
    from: subDays(today, 61),
    to: subDays(today, 31),
  });
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>(compRange);
  const [compMetric, setCompMetric] = useState<MetricKey>("visits");

  // Fetch metrika stats
  const { data: allStats = [], isLoading } = useQuery({
    queryKey: ["metrika-stats-all", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("*")
        .eq("project_id", projectId)
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
      return {
        date,
        dateStr: format(date, "dd.MM", { locale }),
        visits: entry.visits || 0,
      };
    });
  }, [latestStat, locale]);

  // Filter by applied range
  const filteredData = useMemo(
    () => dailyData.filter((d) => d.date >= appliedRange.from && d.date <= appliedRange.to),
    [dailyData, appliedRange]
  );

  // Filter by comparison range
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

  // Comparison chart data
  const comparisonChartData = useMemo(() => {
    const maxLen = Math.max(filteredData.length, filteredCompData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        day: i + 1,
        current: filteredData[i]?.visits || 0,
        previous: filteredCompData[i]?.visits || 0,
      });
    }
    return result;
  }, [filteredData, filteredCompData]);

  const handlePreset = (key: string, days: number) => {
    const newRange = { from: subDays(today, days), to: today };
    setActivePreset(key);
    setRange(newRange);
    setAppliedRange(newRange);
    // Auto-set comparison to preceding period
    setCompRange({ from: subDays(today, days * 2 + 1), to: subDays(today, days + 1) });
    setAppliedCompRange({ from: subDays(today, days * 2 + 1), to: subDays(today, days + 1) });
  };

  const handleApply = () => {
    setAppliedRange({ ...range });
    setActivePreset("");
    if (showComparison) {
      setAppliedCompRange({ ...compRange });
    }
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
    { label: t("publicReport.kpi.visits", "Визиты"), value: totalVisits.toLocaleString(), change: Math.round(visitsChange * 10) / 10, positive: visitsChange >= 0, sparkData, color: "hsl(var(--chart-1))" },
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
              size="sm"
              className="h-8 text-xs"
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
                numberOfMonths={2}
                locale={locale}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
            {t("project.analytics.apply", "Применить")}
          </Button>

          {/* Comparison toggle */}
          <div className="flex items-center gap-2 ml-2">
            <Switch
              id="comp-toggle"
              checked={showComparison}
              onCheckedChange={setShowComparison}
              className="scale-90"
            />
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

      {/* Row 2: Comparison controls (when enabled) */}
      {showComparison && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border bg-muted/30">
          <DateRangePicker
            range={compRange}
            onChange={(r) => setCompRange(r)}
            locale={locale}
            label={t("project.analytics.compareTo", "Сравнить с")}
          />
          <Select value={compMetric} onValueChange={(v) => setCompMetric(v as MetricKey)}>
            <SelectTrigger className="w-[160px] h-7 text-xs">
              <SelectValue />
            </SelectTrigger>
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
          <KpiCard
            key={i}
            label={kpi.label}
            value={kpi.value}
            change={kpi.change}
            positive={kpi.positive}
            sparkData={kpi.sparkData}
            chartColor={kpi.color}
          />
        ))}
      </div>

      {/* Traffic Chart */}
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
            <ResponsiveContainer width="100%" height={300}>
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
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
              {t("project.analytics.noData", "Нет данных за выбранный период")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Comparison Section */}
      {showComparison && (
        <>
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
              {compTotalVisits > 0 && (
                <p className={cn("text-sm font-semibold mt-1", visitsChange >= 0 ? "text-primary" : "text-destructive")}>
                  {visitsChange >= 0 ? "+" : ""}{Math.round(visitsChange * 10) / 10}%
                </p>
              )}
            </Card>
          </div>

          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("project.analytics.comparisonChart", "Сравнение периодов")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {comparisonChartData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={comparisonChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="current" name={t("project.analytics.currentPeriod", "Текущий период")} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="previous" name={t("project.analytics.previousPeriod", "Период сравнения")} stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                  {t("project.analytics.noCompData", "Недостаточно данных для сравнения")}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

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
