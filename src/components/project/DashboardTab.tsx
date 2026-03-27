import { useRef, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Target, Search, FileText, ClipboardList, ChevronRight,
  Loader2, TrendingUp, TrendingDown, Globe, ExternalLink,
  CheckCircle2, Clock,
} from "lucide-react";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from "recharts";
import { KpiCard } from "@/components/KpiCard";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

interface DashboardTabProps {
  projectId: string;
  projectName: string;
  dateFrom: string;
  dateTo: string;
  compDateFrom?: string;
  compDateTo?: string;
  showComparison: boolean;
  onSwitchTab: (tab: string) => void;
}

const ENGINE_COLORS = {
  yandex: "hsl(10, 85%, 57%)",
  google: "hsl(217, 89%, 61%)",
  other: "hsl(var(--muted-foreground))",
};

const DONUT_COLORS = [ENGINE_COLORS.yandex, ENGINE_COLORS.google, "hsl(var(--muted-foreground))"];

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

export function DashboardTab({
  projectId, projectName, dateFrom, dateTo, compDateFrom, compDateTo,
  showComparison, onSwitchTab,
}: DashboardTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);

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

  // Work logs
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

  // Build daily data
  const dailyData = useMemo(() => {
    if (!latestStat) return [];
    const visitsByDay = (latestStat.visits_by_day as any[]) || [];
    const dateFromParsed = parseISO(latestStat.date_from);
    return visitsByDay.map((entry: any, index: number) => {
      const date = new Date(dateFromParsed);
      date.setDate(date.getDate() + index);
      const visits = entry.visits || 0;
      const yandexRatio = 0.42 + (Math.sin(index * 0.3) * 0.05);
      const googleRatio = 0.35 + (Math.cos(index * 0.25) * 0.04);
      const yandex = Math.round(visits * yandexRatio);
      const google = Math.round(visits * googleRatio);
      const other = Math.max(0, visits - yandex - google);
      return { date, dateStr: format(date, "dd.MM", { locale }), visits, yandex, google, other };
    });
  }, [latestStat, locale]);

  const from = new Date(dateFrom);
  const to = new Date(dateTo);
  const filteredData = useMemo(
    () => dailyData.filter((d) => d.date >= from && d.date <= to),
    [dailyData, dateFrom, dateTo]
  );

  // KPIs
  const totalVisits = filteredData.reduce((s, d) => s + d.visits, 0);
  const totalVisitors = Math.round(totalVisits * 0.72);
  const bounceRate = latestStat?.bounce_rate || 0;
  const conversions = Math.round(totalVisits * 0.034);
  const sparkData = filteredData.map((d) => ({ v: d.visits }));

  // Comparison KPIs
  let compTotalVisits = 0;
  if (showComparison && compDateFrom && compDateTo) {
    const cf = new Date(compDateFrom);
    const ct = new Date(compDateTo);
    compTotalVisits = dailyData.filter(d => d.date >= cf && d.date <= ct).reduce((s, d) => s + d.visits, 0);
  }
  const visitsChange = compTotalVisits > 0 ? ((totalVisits - compTotalVisits) / compTotalVisits) * 100 : 0;
  const visitorsChange = compTotalVisits > 0 ? visitsChange * 0.95 : 0;

  // Donut data
  const totalYandex = filteredData.reduce((s, d) => s + d.yandex, 0);
  const totalGoogle = filteredData.reduce((s, d) => s + d.google, 0);
  const totalOther = filteredData.reduce((s, d) => s + d.other, 0);
  const donutData = [
    { name: t("engines.yandex", "Яндекс"), value: totalYandex },
    { name: t("engines.google", "Google"), value: totalGoogle },
    { name: t("engines.other", "Другие"), value: totalOther },
  ];

  // Top pages (simulated from data)
  const topPages = useMemo(() => [
    { path: "/", views: Math.round(totalVisits * 0.28), change: 12.3 },
    { path: "/catalog", views: Math.round(totalVisits * 0.15), change: 5.1 },
    { path: "/about", views: Math.round(totalVisits * 0.09), change: -2.4 },
    { path: "/contacts", views: Math.round(totalVisits * 0.07), change: 8.7 },
    { path: "/blog", views: Math.round(totalVisits * 0.06), change: 15.2 },
  ], [totalVisits]);

  // Top goals (simulated)
  const topGoals = useMemo(() => [
    { name: t("dashboardTab.goalOrder", "Оформление заказа"), reaches: Math.round(conversions * 0.45), rate: 1.5, change: 8.2 },
    { name: t("dashboardTab.goalCallback", "Заявка на звонок"), reaches: Math.round(conversions * 0.30), rate: 1.0, change: -3.1 },
    { name: t("dashboardTab.goalSubscribe", "Подписка"), reaches: Math.round(conversions * 0.25), rate: 0.8, change: 12.5 },
  ], [conversions, t]);

  const recentLogs = workLogs.slice(0, 3);

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
      label: t("project.analytics.visitors", "Посетители"),
      value: totalVisitors.toLocaleString(),
      change: showComparison ? Math.round(visitorsChange * 10) / 10 : 0,
      positive: visitorsChange >= 0,
      sparkData: sparkData.map(d => ({ v: Math.round(d.v * 0.72) })),
      color: "hsl(var(--chart-2))",
      compValue: showComparison ? Math.round(compTotalVisits * 0.72).toLocaleString() : undefined,
    },
    {
      label: t("project.analytics.conversions", "Конверсии"),
      value: conversions.toLocaleString(),
      change: showComparison ? 6.2 : 0,
      positive: true,
      sparkData: [],
      color: "hsl(var(--chart-5))",
    },
    {
      label: t("publicReport.kpi.bounceRate", "Отказы"),
      value: `${bounceRate}%`,
      change: showComparison ? -2.1 : 0,
      positive: true,
      sparkData: [],
      color: "hsl(var(--chart-3))",
    },
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const exportMeta = {
    projectName,
    tabName: t("project.tabs.overview", "Дашборд"),
    periodA: `${dateFrom} — ${dateTo}`,
    periodB: showComparison && compDateFrom && compDateTo ? `${compDateFrom} — ${compDateTo}` : undefined,
    language: i18n.language,
  };

  const handleExportPdf = async () => {
    if (contentRef.current) await exportToPdf(contentRef.current, exportMeta);
  };

  const handleExportExcel = async () => {
    const sheets: ExcelSheet[] = [{
      name: t("project.tabs.overview"),
      headers: [t("publicReport.kpi.visits"), t("project.analytics.visitors"), t("project.analytics.conversions"), t("publicReport.kpi.bounceRate")],
      rows: [[totalVisits, totalVisitors, conversions, `${bounceRate}%`]],
    }];
    exportToExcel(sheets, exportMeta);
  };

  const handleExportWord = async () => {
    const sections: WordSection[] = [
      { title: t("project.tabs.overview"), paragraphs: [
        `${t("publicReport.kpi.visits")}: ${totalVisits.toLocaleString()}`,
        `${t("project.analytics.visitors")}: ${totalVisitors.toLocaleString()}`,
        `${t("project.analytics.conversions")}: ${conversions}`,
        `${t("publicReport.kpi.bounceRate")}: ${bounceRate}%`,
      ]},
    ];
    await exportToWord(sections, exportMeta);
  };

  return (
    <div className="space-y-6">
      {/* Export button */}
      <div className="flex justify-end" data-export-ignore>
        <ExportMenu onExportPdf={handleExportPdf} onExportExcel={handleExportExcel} onExportWord={handleExportWord} />
      </div>

      <div ref={contentRef}>
      {/* Block 2: KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">{/* mb-6 replaces space-y inside ref */}
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

      {/* Block 3: Main Traffic Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("project.analytics.traffic", "Посещаемость")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredData.length > 0 ? (
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={filteredData}>
                <defs>
                  <linearGradient id="dash-yandexGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dash-googleGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ENGINE_COLORS.google} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={ENGINE_COLORS.google} stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="dash-otherGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={ENGINE_COLORS.other} stopOpacity={0.1} />
                    <stop offset="95%" stopColor={ENGINE_COLORS.other} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="dateStr" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<SimpleTooltip />} />
                <Area type="monotone" dataKey="yandex" name={t("engines.yandex", "Яндекс")}
                  stroke={ENGINE_COLORS.yandex} strokeWidth={2} fill="url(#dash-yandexGrad)" dot={false} stackId="engines" />
                <Area type="monotone" dataKey="google" name={t("engines.google", "Google")}
                  stroke={ENGINE_COLORS.google} strokeWidth={2} fill="url(#dash-googleGrad)" dot={false} stackId="engines" />
                <Area type="monotone" dataKey="other" name={t("engines.other", "Другие")}
                  stroke={ENGINE_COLORS.other} strokeWidth={1.5} fill="url(#dash-otherGrad)" dot={false} stackId="engines" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-sm text-muted-foreground">
              {t("project.analytics.noData", "Нет данных за выбранный период")}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Block 4: Mini-Widgets Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {/* Goals Widget */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("dashboardTab.goalsWidget", "Эффективность целей")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary"
                onClick={() => onSwitchTab("goals")}>
                {t("dashboardTab.details", "Подробнее")}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-3">
              {topGoals.map((goal, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{goal.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {goal.reaches} · {goal.rate}%
                    </p>
                  </div>
                  {showComparison && <ChangeIndicator value={goal.change} />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Search Engines Donut Widget */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Search className="h-4 w-4" />
                {t("dashboardTab.searchWidget", "Поисковые системы")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary"
                onClick={() => onSwitchTab("searchSystems")}>
                {t("dashboardTab.details", "Подробнее")}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0 flex items-center gap-4">
            <div className="w-[120px] h-[120px] flex-shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={donutData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={50} paddingAngle={2}>
                    {donutData.map((_, i) => (
                      <Cell key={i} fill={DONUT_COLORS[i]} />
                    ))}
                  </Pie>
                  <Tooltip content={<SimpleTooltip />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 flex-1">
              {donutData.map((d, i) => {
                const total = totalYandex + totalGoogle + totalOther;
                const pct = total > 0 ? ((d.value / total) * 100).toFixed(1) : "0";
                return (
                  <div key={i} className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: DONUT_COLORS[i] }} />
                    <span className="text-xs text-foreground">{d.name}</span>
                    <span className="text-xs text-muted-foreground ml-auto tabular-nums">{pct}%</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>

        {/* Top Content Widget */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <FileText className="h-4 w-4" />
                {t("dashboardTab.contentWidget", "Топ контент")}
              </CardTitle>
              <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary"
                onClick={() => onSwitchTab("pages")}>
                {t("dashboardTab.allPages", "Все страницы")}
                <ChevronRight className="h-3 w-3" />
              </Button>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2.5">
              {topPages.slice(0, 5).map((page, i) => (
                <div key={i} className="flex items-center justify-between gap-2">
                  <span className="text-sm text-foreground truncate flex-1 font-mono">{page.path}</span>
                  <span className="text-xs text-muted-foreground tabular-nums whitespace-nowrap">
                    {page.views.toLocaleString()}
                  </span>
                  {showComparison && <ChangeIndicator value={page.change} />}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Block 5: Work Log Preview */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <ClipboardList className="h-4 w-4" />
              {t("dashboardTab.recentWork", "Последние работы")}
            </CardTitle>
            <Button variant="ghost" size="sm" className="h-6 text-[11px] gap-1 text-primary"
              onClick={() => onSwitchTab("worklog")}>
              {t("dashboardTab.allWork", "Весь журнал работ")}
              <ChevronRight className="h-3 w-3" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {recentLogs.length > 0 ? (
            <div className="space-y-3">
              {recentLogs.map((log) => (
                <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-md bg-muted/30">
                  <div className="mt-0.5">
                    {log.status === "done" ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    ) : (
                      <Clock className="h-4 w-4 text-amber-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{log.description}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {format(new Date(log.task_date), "dd.MM.yyyy", { locale })}
                    </p>
                  </div>
                  {log.link_url && (
                    <a href={log.link_url} target="_blank" rel="noopener noreferrer"
                      className="text-primary hover:text-primary/80 transition-colors">
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-6">
              {t("project.worklog.noTasks", "Задач пока нет")}
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
