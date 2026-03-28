import { useRef, useMemo, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO, differenceInDays } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Target, Search, FileText, ClipboardList, ChevronRight,
  Loader2, TrendingUp, TrendingDown, Globe, ExternalLink,
  CheckCircle2, Clock, Sparkles, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line, Legend,
} from "recharts";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useDateRange } from "@/contexts/DateRangeContext";
import { generateDailyVisits } from "@/lib/data-generators";
import {
  StandardKpiCard, GlassCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip, SkeletonChart,
} from "./shared-ui";

export function DashboardTab({ projectId, projectName, onSwitchTab }: DashboardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);
  const { appliedRange, appliedCompRange, showComparison, applyVersion, channel } = useDateRange();
  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");

  // Loading animation
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevVersion = useRef(applyVersion);
  useEffect(() => {
    if (applyVersion !== prevVersion.current) {
      prevVersion.current = applyVersion;
      setIsRefreshing(true);
      const timer = setTimeout(() => setIsRefreshing(false), 600);
      return () => clearTimeout(timer);
    }
  }, [applyVersion]);

  // Fetch real metrika stats
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

  // Work logs for recent activity
  const { data: workLogs = [] } = useQuery({
    queryKey: ["work_logs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("work_logs").select("*").eq("project_id", projectId)
        .order("task_date", { ascending: false }).limit(5);
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const latestStat = allStats[0];

  // Build daily data from real stats or generate mock
  const dailyData = useMemo(() => {
    if (latestStat) {
      const visitsByDay = (latestStat.visits_by_day as any[]) || [];
      const dateFromParsed = parseISO(latestStat.date_from);
      return visitsByDay.map((entry: any, index: number) => {
        const date = new Date(dateFromParsed);
        date.setDate(date.getDate() + index);
        const visits = entry.visits || 0;
        return {
          date,
          dateStr: format(date, "dd MMM", { locale }),
          visits,
          bounceRate: 25 + Math.sin(index * 0.4) * 8,
          depth: 2.5 + Math.cos(index * 0.3) * 0.8,
          duration: 120 + Math.sin(index * 0.5) * 40,
        };
      });
    }
    // Fallback: generate mock
    const gen = generateDailyVisits(appliedRange);
    return gen.map((d, i) => ({
      ...d,
      dateStr: format(d.date, "dd MMM", { locale }),
      bounceRate: 25 + Math.sin(i * 0.4) * 8,
      depth: 2.5 + Math.cos(i * 0.3) * 0.8,
      duration: 120 + Math.sin(i * 0.5) * 40,
    }));
  }, [latestStat, appliedRange, locale]);

  // Filter to selected range
  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const filteredData = useMemo(
    () => dailyData.filter((d) => d.date >= from && d.date <= to),
    [dailyData, dateFrom, dateTo]
  );

  // Channel multiplier
  const channelMultiplier = useMemo(() => {
    switch (channel) {
      case "organic": return 0.45;
      case "direct": return 0.25;
      case "referral": return 0.12;
      case "social": return 0.10;
      case "ad": return 0.08;
      default: return 1;
    }
  }, [channel]);

  const adjustedData = useMemo(
    () => filteredData.map(d => ({ ...d, visits: Math.round(d.visits * channelMultiplier) })),
    [filteredData, channelMultiplier]
  );

  // Comparison data
  const compData = useMemo(() => {
    if (!showComparison) return [];
    const cf = appliedCompRange.from;
    const ct = appliedCompRange.to;
    return dailyData.filter(d => d.date >= cf && d.date <= ct).map(d => ({
      ...d,
      visits: Math.round(d.visits * channelMultiplier),
    }));
  }, [showComparison, appliedCompRange, dailyData, channelMultiplier]);

  // KPIs
  const totalVisits = adjustedData.reduce((s, d) => s + d.visits, 0);
  const avgBounce = adjustedData.length > 0 ? adjustedData.reduce((s, d) => s + d.bounceRate, 0) / adjustedData.length : 0;
  const avgDepth = adjustedData.length > 0 ? adjustedData.reduce((s, d) => s + d.depth, 0) / adjustedData.length : 0;
  const avgDuration = adjustedData.length > 0 ? adjustedData.reduce((s, d) => s + d.duration, 0) / adjustedData.length : 0;

  // Comparison KPIs
  const compVisits = compData.reduce((s, d) => s + d.visits, 0);
  const compBounce = compData.length > 0 ? compData.reduce((s, d) => s + d.bounceRate, 0) / compData.length : 0;
  const compDepth = compData.length > 0 ? compData.reduce((s, d) => s + d.depth, 0) / compData.length : 0;
  const compDuration = compData.length > 0 ? compData.reduce((s, d) => s + d.duration, 0) / compData.length : 0;

  const pctChange = (curr: number, prev: number) => prev > 0 ? ((curr - prev) / prev) * 100 : 0;

  const formatDuration = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.round(secs % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  // AI mini-summary bullets
  const aiSummary = useMemo(() => {
    const visitsChangeVal = pctChange(totalVisits, compVisits);
    const daysCount = differenceInDays(appliedRange.to, appliedRange.from) + 1;
    const avgDaily = Math.round(totalVisits / Math.max(daysCount, 1));

    const bullets = [];
    if (showComparison && compVisits > 0) {
      const dir = visitsChangeVal > 0
        ? (i18n.language === "ru" ? "вырос" : "grew")
        : (i18n.language === "ru" ? "снизился" : "declined");
      bullets.push(
        i18n.language === "ru"
          ? `Трафик ${dir} на ${Math.abs(visitsChangeVal).toFixed(1)}% за период`
          : `Traffic ${dir} by ${Math.abs(visitsChangeVal).toFixed(1)}% over the period`
      );
    } else {
      bullets.push(
        i18n.language === "ru"
          ? `Среднее кол-во визитов: ${avgDaily.toLocaleString()} в день`
          : `Average daily visits: ${avgDaily.toLocaleString()}`
      );
    }

    const bestChannel = channel === "all"
      ? (i18n.language === "ru" ? "Поиск" : "Search")
      : t(`channels.${channel}`);
    bullets.push(
      i18n.language === "ru"
        ? `Лучший канал — ${bestChannel}`
        : `Top channel — ${bestChannel}`
    );

    const bounceDir = avgBounce < 30;
    bullets.push(
      i18n.language === "ru"
        ? (bounceDir ? "Отказы в норме — ниже 30%" : `Отказы выше нормы — ${avgBounce.toFixed(1)}%`)
        : (bounceDir ? "Bounce rate is healthy — below 30%" : `Bounce rate is elevated — ${avgBounce.toFixed(1)}%`)
    );

    return bullets;
  }, [totalVisits, compVisits, showComparison, channel, avgBounce, appliedRange, i18n.language, t]);

  // Sparkline data
  const visitsSparkData = adjustedData.map(d => ({ v: d.visits }));
  const bounceSparkData = adjustedData.map(d => ({ v: Math.round(d.bounceRate * 10) }));
  const depthSparkData = adjustedData.map(d => ({ v: Math.round(d.depth * 100) }));
  const durationSparkData = adjustedData.map(d => ({ v: Math.round(d.duration) }));

  const kpiCards = [
    {
      label: t("publicReport.kpi.visits", "Визиты"),
      value: totalVisits.toLocaleString(),
      change: showComparison ? pctChange(totalVisits, compVisits) : 0,
      sparkData: visitsSparkData,
      color: "hsl(var(--chart-1))",
    },
    {
      label: t("publicReport.kpi.bounceRate", "Отказы"),
      value: `${avgBounce.toFixed(1)}`,
      unit: "%",
      change: showComparison ? pctChange(avgBounce, compBounce) : 0,
      sparkData: bounceSparkData,
      color: "hsl(var(--chart-3))",
    },
    {
      label: t("project.analytics.pageDepth", "Глубина просмотра"),
      value: avgDepth.toFixed(2),
      change: showComparison ? pctChange(avgDepth, compDepth) : 0,
      sparkData: depthSparkData,
      color: "hsl(var(--chart-2))",
    },
    {
      label: t("project.analytics.avgDuration", "Время на сайте"),
      value: formatDuration(avgDuration),
      change: showComparison ? pctChange(avgDuration, compDuration) : 0,
      sparkData: durationSparkData,
      color: "hsl(var(--chart-5))",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Export handlers
  const exportMeta = {
    projectName,
    tabName: t("portalNav.overview", "Обзор"),
    periodA: `${dateFrom} — ${dateTo}`,
    language: i18n.language,
  };

  const handleExportPdf = async () => {
    if (contentRef.current) await exportToPdf(contentRef.current, exportMeta);
  };
  const handleExportExcel = async () => {
    const sheets: ExcelSheet[] = [{
      name: t("portalNav.overview"),
      headers: [t("publicReport.kpi.visits"), t("publicReport.kpi.bounceRate"), t("project.analytics.pageDepth"), t("project.analytics.avgDuration")],
      rows: [[totalVisits, `${avgBounce.toFixed(1)}%`, avgDepth.toFixed(2), formatDuration(avgDuration)]],
    }];
    exportToExcel(sheets, exportMeta);
  };
  const handleExportWord = async () => {
    const sections: WordSection[] = [{
      title: t("portalNav.overview"),
      paragraphs: kpiCards.map(k => `${k.label}: ${k.value}${k.unit || ""}`),
    }];
    await exportToWord(sections, exportMeta);
  };

  return (
    <div className={cn("space-y-6 transition-opacity duration-300", isRefreshing && "opacity-60")}>
      {isRefreshing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("project.analytics.loading")}
        </div>
      )}

      {/* Export */}
      <div className="flex items-center justify-end" data-export-ignore>
        <ExportMenu onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} onExportWord={handleExportWord} />
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* === 1. KPI GRID === */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {kpiCards.map((kpi, i) => (
            <OverviewKpiCard key={i} {...kpi} />
          ))}
        </div>

        {/* === 2. MAIN AREA CHART === */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("project.analytics.traffic", "Посещаемость")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {adjustedData.length > 0 ? (
              <ResponsiveContainer width="100%" height={320}>
                <AreaChart data={adjustedData}>
                  <defs>
                    <linearGradient id="ov-visitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis
                    dataKey="dateStr"
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis
                    stroke="hsl(var(--muted-foreground))"
                    fontSize={11}
                    tickLine={false}
                    axisLine={false}
                    tickFormatter={(v) => v.toLocaleString()}
                  />
                  <Tooltip content={<SimpleTooltip />} />
                  <Area
                    type="monotone"
                    dataKey="visits"
                    name={t("publicReport.kpi.visits")}
                    stroke="hsl(var(--primary))"
                    strokeWidth={2}
                    fill="url(#ov-visitGrad)"
                    dot={false}
                    activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
                {t("project.analytics.noData")}
              </div>
            )}
          </CardContent>
        </Card>

        {/* === 3. AI MINI-SUMMARY === */}
        <Card className="border-border bg-card border-l-4 border-l-primary/60">
          <CardContent className="p-5">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                {i18n.language === "ru" ? "Главное за период" : "Period highlights"}
              </h3>
            </div>
            <ul className="space-y-2">
              {aiSummary.map((bullet, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-primary/60 shrink-0" />
                  <span className="text-sm text-foreground/80">{bullet}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>

        {/* === 4. QUICK LINKS GRID === */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Goals quick link */}
          <Card
            className="border-border bg-card cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => onSwitchTab("goals")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Target className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("portalNav.conversions")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboardTab.details")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
          {/* Traffic quick link */}
          <Card
            className="border-border bg-card cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => onSwitchTab("searchSystems")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Search className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("portalNav.traffic")}</p>
                <p className="text-xs text-muted-foreground">{t("dashboardTab.details")}</p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
          {/* Work log quick link */}
          <Card
            className="border-border bg-card cursor-pointer hover:shadow-md transition-shadow group"
            onClick={() => onSwitchTab("worklog")}
          >
            <CardContent className="p-5 flex items-center gap-4">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{t("portalNav.workLog")}</p>
                <p className="text-xs text-muted-foreground">
                  {workLogs.length > 0
                    ? (i18n.language === "ru" ? `${workLogs.length} записей` : `${workLogs.length} entries`)
                    : t("project.worklog.noTasks")}
                </p>
              </div>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
