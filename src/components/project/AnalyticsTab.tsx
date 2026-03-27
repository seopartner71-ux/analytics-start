import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subMonths, startOfMonth, endOfMonth, differenceInDays, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Link2, CalendarIcon, ArrowRightLeft, BarChart3, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Legend, LineChart, Line,
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

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<DateRange>({
    from: subDays(today, 30),
    to: today,
  });
  const [appliedRange, setAppliedRange] = useState<DateRange>(range);
  const [activePreset, setActivePreset] = useState<string>("30d");
  const [viewTab, setViewTab] = useState<string>("overview");

  // Comparison range (same length, immediately before)
  const rangeDays = differenceInDays(appliedRange.to, appliedRange.from);
  const compRange: DateRange = {
    from: subDays(appliedRange.from, rangeDays + 1),
    to: subDays(appliedRange.from, 1),
  };

  // Fetch all metrika_stats for this project
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

  // Get the latest stat record (it has visits_by_day with full date info)
  const latestStat = allStats[0];

  // Parse visits_by_day from latest stat and build daily data with proper dates
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
        fullDate: format(date, "yyyy-MM-dd"),
        visits: entry.visits || 0,
      };
    });
  }, [latestStat, locale]);

  // Filter data by applied range
  const filteredData = useMemo(() => {
    return dailyData.filter((d) => d.date >= appliedRange.from && d.date <= appliedRange.to);
  }, [dailyData, appliedRange]);

  // Filter data by comparison range
  const compData = useMemo(() => {
    return dailyData.filter((d) => d.date >= compRange.from && d.date <= compRange.to);
  }, [dailyData, compRange]);

  // KPI calculations
  const totalVisits = filteredData.reduce((s, d) => s + d.visits, 0);
  const compTotalVisits = compData.reduce((s, d) => s + d.visits, 0);
  const visitsChange = compTotalVisits > 0
    ? ((totalVisits - compTotalVisits) / compTotalVisits) * 100
    : 0;

  const avgVisits = filteredData.length > 0 ? Math.round(totalVisits / filteredData.length) : 0;
  const bounceRate = latestStat?.bounce_rate || 0;
  const pageDepth = latestStat?.page_depth || 0;
  const avgDuration = latestStat?.avg_duration_seconds || 0;

  const sparkData = filteredData.map((d) => ({ v: d.visits }));

  const handlePreset = (key: string, days: number) => {
    setActivePreset(key);
    setRange({ from: subDays(today, days), to: today });
  };

  const handleApply = () => {
    setAppliedRange({ ...range });
    setActivePreset("");
    toast.success(t("project.analytics.applied", "Период применён"));
  };

  const handleGenerateReport = () => {
    const url = `${window.location.origin}/report/${projectId}`;
    navigator.clipboard.writeText(url);
    toast.success(t("project.analytics.linkCopied"));
  };

  // Comparison chart data: align by day index
  const comparisonChartData = useMemo(() => {
    const maxLen = Math.max(filteredData.length, compData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        day: i + 1,
        current: filteredData[i]?.visits || 0,
        currentLabel: filteredData[i]?.dateStr || "",
        previous: compData[i]?.visits || 0,
        previousLabel: compData[i]?.dateStr || "",
      });
    }
    return result;
  }, [filteredData, compData]);

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  };

  const kpis = [
    {
      label: t("publicReport.kpi.visits", "Визиты"),
      value: totalVisits.toLocaleString(),
      change: Math.round(visitsChange * 10) / 10,
      positive: visitsChange >= 0,
      sparkData,
      color: "hsl(var(--chart-1))",
    },
    {
      label: t("project.analytics.avgVisits", "Ср. визитов/день"),
      value: avgVisits.toLocaleString(),
      change: 0,
      positive: true,
      sparkData,
      color: "hsl(var(--chart-5))",
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Date Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Preset buttons */}
          {PRESETS.map((p) => (
            <Button
              key={p.key}
              variant={activePreset === p.key ? "default" : "outline"}
              size="sm"
              className="h-8 text-xs"
              onClick={() => handlePreset(p.key, p.days)}
            >
              {t(`project.analytics.preset.${p.key}`, `${p.days}д`)}
            </Button>
          ))}

          {/* Date range picker */}
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
                  if (r?.from && r?.to) {
                    setRange({ from: r.from, to: r.to });
                    setActivePreset("");
                  } else if (r?.from) {
                    setRange({ from: r.from, to: r.from });
                    setActivePreset("");
                  }
                }}
                numberOfMonths={2}
                locale={locale}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Apply button */}
          <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
            {t("project.analytics.apply", "Применить")}
          </Button>
        </div>

        <Button onClick={handleGenerateReport} size="sm" className="gap-2 h-8">
          <Link2 className="h-3.5 w-3.5" />
          {t("project.analytics.generateReport")}
        </Button>
      </div>

      {/* Tabs: Overview / Comparison */}
      <Tabs value={viewTab} onValueChange={setViewTab}>
        <TabsList className="h-9">
          <TabsTrigger value="overview" className="text-xs gap-1.5">
            <BarChart3 className="h-3.5 w-3.5" />
            {t("project.analytics.overviewTab", "Обзор")}
          </TabsTrigger>
          <TabsTrigger value="comparison" className="text-xs gap-1.5">
            <ArrowRightLeft className="h-3.5 w-3.5" />
            {t("project.analytics.comparisonTab", "Сравнение")}
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6 mt-4">
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
                    <Area
                      type="monotone"
                      dataKey="visits"
                      name={t("project.analytics.visitors", "Визиты")}
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      fill="url(#analyticsGrad)"
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                  {t("project.analytics.noData", "Нет данных за выбранный период")}
                </div>
              )}
            </CardContent>
          </Card>

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
        </TabsContent>

        {/* Comparison Tab */}
        <TabsContent value="comparison" className="space-y-6 mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card className="border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("project.analytics.currentPeriod", "Текущий период")}</p>
              <p className="text-sm font-semibold text-foreground">
                {format(appliedRange.from, "dd.MM.yy", { locale })} — {format(appliedRange.to, "dd.MM.yy", { locale })}
              </p>
              <p className="text-2xl font-bold text-foreground mt-2">{totalVisits.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t("project.analytics.visits", "визитов")}</span></p>
            </Card>
            <Card className="border-border bg-card p-4">
              <p className="text-xs text-muted-foreground mb-1">{t("project.analytics.previousPeriod", "Предыдущий период")}</p>
              <p className="text-sm font-semibold text-foreground">
                {format(compRange.from, "dd.MM.yy", { locale })} — {format(compRange.to, "dd.MM.yy", { locale })}
              </p>
              <p className="text-2xl font-bold text-foreground mt-2">
                {compTotalVisits > 0 ? compTotalVisits.toLocaleString() : "—"}{" "}
                <span className="text-sm font-normal text-muted-foreground">{t("project.analytics.visits", "визитов")}</span>
              </p>
              {compTotalVisits > 0 && (
                <p className={cn("text-sm font-semibold mt-1", visitsChange >= 0 ? "text-primary" : "text-destructive")}>
                  {visitsChange >= 0 ? "+" : ""}{Math.round(visitsChange * 10) / 10}%
                </p>
              )}
            </Card>
          </div>

          {/* Comparison Chart */}
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
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} label={{ value: t("project.analytics.dayNumber", "День"), position: "insideBottom", offset: -5, fontSize: 11 }} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<CustomTooltip />} />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="current"
                      name={t("project.analytics.currentPeriod", "Текущий период")}
                      stroke="hsl(var(--chart-1))"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="previous"
                      name={t("project.analytics.previousPeriod", "Предыдущий период")}
                      stroke="hsl(var(--chart-3))"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={false}
                      activeDot={{ r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-sm text-muted-foreground">
                  {t("project.analytics.noCompData", "Недостаточно данных для сравнения")}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
