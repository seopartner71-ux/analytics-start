import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Target, Loader2, TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight, Minus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from "recharts";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";
import {
  StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip, MetricTooltip,
} from "./shared-ui";

interface GoalsTabProps {
  projectId: string;
  projectName: string;
}

interface GoalStat {
  id: number;
  name: string;
  type: string;
  reaches: number;
  conversionRate: number;
  change: number;
  daily: number[];
}

const ChartTooltip = StandardChartTooltip;

const GOAL_COLORS = [
  "hsl(var(--chart-1))",
  "hsl(var(--chart-2))",
  "hsl(var(--chart-3))",
  "hsl(var(--chart-4))",
  "hsl(var(--chart-5))",
];

export function GoalsTab({ projectId, projectName }: GoalsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    appliedRange, appliedCompRange,
    showComparison, applyVersion,
  } = useDateRange();

  const [selectedGoal, setSelectedGoal] = useState<string>("all");

  const isRefreshing = useTabRefresh();

  const dateFrom = format(appliedRange.from, "yyyy-MM-dd");
  const dateTo = format(appliedRange.to, "yyyy-MM-dd");
  const compDateFrom = format(appliedCompRange.from, "yyyy-MM-dd");
  const compDateTo = format(appliedCompRange.to, "yyyy-MM-dd");

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

  // Goals for current period
  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["metrika-goals", projectId, dateFrom, dateTo],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-goals`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: integration.access_token, counter_id: integration.counter_id,
            date1: dateFrom, date2: dateTo,
          }),
        }
      );
      const data = await resp.json();
      return (data.goals || []) as GoalStat[];
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 30 * 60 * 1000,
  });

  // Goals for comparison period
  const { data: compGoals = [] } = useQuery({
    queryKey: ["metrika-goals-comp", projectId, compDateFrom, compDateTo],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id || !showComparison) return [];
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];
      const resp = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/yandex-metrika-auth?action=fetch-goals`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({
            access_token: integration.access_token, counter_id: integration.counter_id,
            date1: compDateFrom, date2: compDateTo,
          }),
        }
      );
      const data = await resp.json();
      return (data.goals || []) as GoalStat[];
    },
    enabled: !!integration?.access_token && !!integration?.counter_id && showComparison,
    staleTime: 30 * 60 * 1000,
  });

  // Filtered goals
  const displayGoals = useMemo(() => {
    if (selectedGoal === "all") return goals;
    return goals.filter(g => String(g.id) === selectedGoal);
  }, [goals, selectedGoal]);

  // KPIs
  const totalReaches = displayGoals.reduce((s, g) => s + g.reaches, 0);
  const avgCR = displayGoals.length > 0
    ? Math.round((displayGoals.reduce((s, g) => s + g.conversionRate, 0) / displayGoals.length) * 100) / 100
    : 0;
  const compTotalReaches = compGoals.reduce((s, g) => s + g.reaches, 0);
  const reachesChange = compTotalReaches > 0 ? ((totalReaches - compTotalReaches) / compTotalReaches) * 100 : 0;

  // Chart data
  const chartData = useMemo(() => {
    if (displayGoals.length === 0) return [];
    const maxLen = Math.max(...displayGoals.map(g => g.daily?.length || 0));
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      const dayTotal = displayGoals.reduce((s, g) => s + (g.daily?.[i] || 0), 0);
      const dateObj = new Date(appliedRange.from);
      dateObj.setDate(dateObj.getDate() + i);
      result.push({ day: format(dateObj, "dd.MM", { locale }), current: dayTotal });
    }
    return result;
  }, [displayGoals, appliedRange, locale]);

  const chartDataWithComp = useMemo(() => {
    if (!showComparison || compGoals.length === 0) return chartData;
    const selectedCompGoals = selectedGoal === "all" ? compGoals : compGoals.filter(g => String(g.id) === selectedGoal);
    const maxLen = Math.max(chartData.length, ...selectedCompGoals.map(g => g.daily?.length || 0));
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      const prevTotal = selectedCompGoals.reduce((s, g) => s + (g.daily?.[i] || 0), 0);
      result.push({
        ...(chartData[i] || { day: `${i + 1}`, current: 0 }),
        previous: prevTotal,
      });
    }
    return result;
  }, [chartData, compGoals, showComparison, selectedGoal]);

  // Goals with delta and simulated targets
  const goalsWithDelta = useMemo(() => {
    return displayGoals.map((g, i) => {
      const compGoal = compGoals.find(cg => cg.id === g.id);
      const delta = compGoal && compGoal.reaches > 0
        ? ((g.reaches - compGoal.reaches) / compGoal.reaches) * 100
        : g.change;
      // Simulated target: ~120-200% of current reaches as target
      const target = Math.round(g.reaches * (1.2 + (i * 0.15)));
      const progress = target > 0 ? Math.min(100, Math.round((g.reaches / target) * 100)) : 0;
      return { ...g, delta, target, progress, color: GOAL_COLORS[i % GOAL_COLORS.length] };
    });
  }, [displayGoals, compGoals]);

  // Export
  const exportMeta = { projectName, tabName: t("portalNav.conversions"), periodA: `${dateFrom} — ${dateTo}`, language: i18n.language };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className={cn("space-y-6 transition-opacity duration-300", isRefreshing && "opacity-60")}>
      {isRefreshing && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          {t("project.analytics.loading")}
        </div>
      )}

      {/* Top bar: goal selector + export */}
      <div className="flex items-center justify-between flex-wrap gap-3" data-export-ignore>
        <Select value={selectedGoal} onValueChange={setSelectedGoal}>
          <SelectTrigger className="w-[220px] h-8 text-xs">
            <SelectValue placeholder={t("goalsTab.allGoals")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">{t("goalsTab.allGoals")}</SelectItem>
            {goals.map(g => (
              <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <ExportMenu
          onExportPdf={async () => { if (contentRef.current) await exportToPdf(contentRef.current, exportMeta); }}
          onExportExcel={async () => {
            const sheets: ExcelSheet[] = [{ name: t("portalNav.conversions"), headers: [t("goals.goalName"), t("goals.reaches"), t("goals.conversion"), t("goals.change")], rows: goalsWithDelta.map(g => [g.name, g.reaches, `${g.conversionRate}%`, `${g.delta > 0 ? "+" : ""}${Math.round(g.delta)}%`]) }];
            exportToExcel(sheets, exportMeta);
          }}
          onExportWord={async () => {
            const sections: WordSection[] = [{ title: t("portalNav.conversions"), table: { headers: [t("goals.goalName"), t("goals.reaches"), t("goals.conversion")], rows: goalsWithDelta.map(g => [g.name, g.reaches, `${g.conversionRate}%`]) } }];
            await exportToWord(sections, exportMeta);
          }}
        />
      </div>

      <div ref={contentRef} className="space-y-6">
        {/* === KPI CARDS === */}
        <div className="grid grid-cols-3 gap-4">
          {[
            { label: t("goalsTab.totalReaches"), value: totalReaches.toLocaleString(), change: showComparison ? reachesChange : 0, color: "hsl(var(--chart-1))" },
            { label: t("goalsTab.avgCR"), value: `${avgCR}%`, change: 0, color: "hsl(var(--chart-2))" },
            { label: t("goalsTab.goalsCount"), value: String(goals.length), change: 0, color: "hsl(var(--chart-4))" },
          ].map((kpi, i) => (
            <Card key={i} className="border-border bg-card">
              <CardContent className="p-5">
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">{kpi.label}</p>
                <div className="flex items-end justify-between">
                  <p className="text-2xl font-bold tracking-tight text-foreground">{kpi.value}</p>
                  {kpi.change !== 0 && (
                    <span className={cn(
                      "inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-1.5 py-0.5",
                      kpi.change > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
                    )}>
                      {kpi.change > 0 ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
                      {Math.abs(kpi.change).toFixed(1)}%
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* === GOALS TABLE WITH PROGRESS BARS === */}
        {goalsWithDelta.length > 0 ? (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Target className="h-4 w-4" />
                {t("goalsTab.detailedTable")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {goalsWithDelta.map((g) => (
                  <div key={g.id} className="p-4 rounded-xl border border-border/50 bg-muted/20 hover:bg-muted/40 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{g.name}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{g.type}</p>
                      </div>
                      <div className="flex items-center gap-3 ml-4">
                        {/* Delta badge */}
                        {g.delta !== 0 && (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-xs font-semibold rounded-full px-2 py-0.5",
                            g.delta > 0 ? "text-emerald-600 bg-emerald-500/10" : "text-red-500 bg-red-500/10"
                          )}>
                            {g.delta > 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                            {g.delta > 0 ? "+" : ""}{Math.round(g.delta)}%
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Metrics row */}
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{t("goals.reaches")}</p>
                        <p className="text-lg font-bold text-foreground tabular-nums">{g.reaches.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">CR%</p>
                        <p className="text-lg font-bold text-foreground tabular-nums">{g.conversionRate}%</p>
                      </div>
                      <div>
                        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">
                          {i18n.language === "ru" ? "Таргет" : "Target"}
                        </p>
                        <p className="text-lg font-bold text-foreground tabular-nums">{g.target.toLocaleString()}</p>
                      </div>
                    </div>

                    {/* Progress bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] text-muted-foreground">
                          {i18n.language === "ru" ? "Выполнение плана" : "Plan completion"}
                        </span>
                        <span className="text-xs font-semibold tabular-nums" style={{ color: g.color }}>
                          {g.progress}%
                        </span>
                      </div>
                      <div className="w-full h-2.5 rounded-full bg-muted overflow-hidden">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${g.progress}%`,
                            background: g.color,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-border bg-card">
            <CardContent className="py-16">
              <div className="text-center">
                <Target className="h-10 w-10 mx-auto text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">{t("goals.empty")}</p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* === CONVERSION DYNAMICS CHART === */}
        {chartDataWithComp.length > 0 && (
          <Card className="border-border bg-card">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                {t("goalsTab.conversionDynamics")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={320}>
                {showComparison ? (
                  <LineChart data={chartDataWithComp}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend />
                    <Line type="monotone" dataKey="current" name={t("project.analytics.currentPeriod")}
                      stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
                    <Line type="monotone" dataKey="previous" name={t("project.analytics.previousPeriod")}
                      stroke="hsl(var(--chart-3))" strokeWidth={2} strokeDasharray="6 3" dot={false} activeDot={{ r: 4 }} />
                  </LineChart>
                ) : (
                  <AreaChart data={chartDataWithComp}>
                    <defs>
                      <linearGradient id="goalsGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15} />
                        <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <Tooltip content={<ChartTooltip />} />
                    <Area type="monotone" dataKey="current" name={t("goalsTab.reaches")}
                      stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#goalsGrad)" dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
