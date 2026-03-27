import { useState, useMemo, useRef } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subYears, differenceInDays, parseISO } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useDateRange } from "@/contexts/DateRangeContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Target, CalendarIcon, ArrowRightLeft, Loader2, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  Legend, LineChart, Line,
} from "recharts";
import { KpiCard } from "@/components/KpiCard";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";

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

type DateRange = { from: Date; to: Date };

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

export function GoalsTab({ projectId, projectName }: GoalsTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    range, setRange, appliedRange, apply,
    showComparison, setShowComparison,
    compRange, setCompRange, appliedCompRange,
    applyCompPreset, resetToDefault,
  } = useDateRange();

  const [selectedGoal, setSelectedGoal] = useState<string>("all");

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
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=fetch-goals`,
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
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=fetch-goals`,
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

  // KPI
  const totalReaches = displayGoals.reduce((s, g) => s + g.reaches, 0);
  const avgCR = displayGoals.length > 0
    ? Math.round((displayGoals.reduce((s, g) => s + g.conversionRate, 0) / displayGoals.length) * 100) / 100
    : 0;

  const compTotalReaches = compGoals.reduce((s, g) => s + g.reaches, 0);
  const reachesChange = compTotalReaches > 0 ? ((totalReaches - compTotalReaches) / compTotalReaches) * 100 : 0;

  // Chart data: aggregate daily across selected goals
  const chartData = useMemo(() => {
    if (displayGoals.length === 0) return [];
    const maxLen = Math.max(...displayGoals.map(g => g.daily?.length || 0));
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      const dayTotal = displayGoals.reduce((s, g) => s + (g.daily?.[i] || 0), 0);
      const dateObj = new Date(appliedRange.from);
      dateObj.setDate(dateObj.getDate() + i);
      result.push({
        day: format(dateObj, "dd.MM", { locale }),
        current: dayTotal,
      });
    }
    return result;
  }, [displayGoals, appliedRange, locale]);

  // Comparison chart overlay
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

  const handleApply = () => {
    apply();
  };

  const handleCompPreset = (type: "previous" | "lastYear") => {
    applyCompPreset(type);
  };

  // Table with comparison delta
  const goalsWithDelta = useMemo(() => {
    return displayGoals.map(g => {
      const compGoal = compGoals.find(cg => cg.id === g.id);
      const delta = compGoal && compGoal.reaches > 0
        ? ((g.reaches - compGoal.reaches) / compGoal.reaches) * 100
        : g.change;
      return { ...g, delta };
    });
  }, [displayGoals, compGoals]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6" ref={contentRef}>
      {/* Filters */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={selectedGoal} onValueChange={setSelectedGoal}>
            <SelectTrigger className="w-[200px] h-8 text-xs">
              <SelectValue placeholder={t("goalsTab.allGoals", "Все цели")} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("goalsTab.allGoals", "Все цели")}</SelectItem>
              {goals.map(g => (
                <SelectItem key={g.id} value={String(g.id)}>{g.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>

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
                  if (r?.from && r?.to) setRange({ from: r.from, to: r.to });
                  else if (r?.from) setRange({ from: r.from, to: r.from });
                }}
                numberOfMonths={2} locale={locale}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          <Button size="sm" className="h-8 text-xs" onClick={handleApply}>
            {t("project.analytics.apply", "Применить")}
          </Button>

          <ExportMenu
            onExportPdf={async () => { if (contentRef.current) await exportToPdf(contentRef.current, { projectName, tabName: t("project.tabs.goals"), periodA: dateFrom + " — " + dateTo, periodB: showComparison ? compDateFrom + " — " + compDateTo : undefined, language: i18n.language }); }}
            onExportExcel={async () => {
              const sheets: ExcelSheet[] = [{ name: t("project.tabs.goals"), headers: [t("goals.goalName"), t("goals.reaches"), t("goals.conversion"), t("goals.change")], rows: goalsWithDelta.map(g => [g.name, g.reaches, `${g.conversionRate}%`, `${g.delta > 0 ? "+" : ""}${Math.round(g.delta)}%`]) }];
              exportToExcel(sheets, { projectName, tabName: t("project.tabs.goals"), periodA: dateFrom + " — " + dateTo, language: i18n.language });
            }}
            onExportWord={async () => {
              const sections: WordSection[] = [{ title: t("project.tabs.goals"), table: { headers: [t("goals.goalName"), t("goals.reaches"), t("goals.conversion")], rows: goalsWithDelta.map(g => [g.name, g.reaches, `${g.conversionRate}%`]) } }];
              await exportToWord(sections, { projectName, tabName: t("project.tabs.goals"), periodA: dateFrom + " — " + dateTo, language: i18n.language });
            }}
          />

          <div className="flex items-center gap-2 ml-2">
            <Switch id="goals-comp" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90" />
            <Label htmlFor="goals-comp" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
              <ArrowRightLeft className="h-3 w-3" />
              {t("project.analytics.comparisonTab", "Сравнение")}
            </Label>
          </div>
        </div>
      </div>

      {/* Comparison row */}
      {showComparison && (
        <div className="flex items-center gap-3 flex-wrap p-3 rounded-lg border border-border bg-muted/30">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted-foreground whitespace-nowrap">{t("project.analytics.compareTo", "Сравнить с")}:</span>
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-xs gap-1.5 px-2">
                  <CalendarIcon className="h-3 w-3" />
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
                  numberOfMonths={2} locale={locale}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-1.5">
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCompPreset("previous")}>
              {t("project.analytics.prevPeriod", "Предыдущий период")}
            </Button>
            <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => handleCompPreset("lastYear")}>
              {t("project.analytics.lastYear", "Год назад")}
            </Button>
          </div>
          <Button size="sm" variant="secondary" className="h-7 text-xs" onClick={handleApply}>
            {t("project.analytics.apply", "Применить")}
          </Button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <KpiCard
          label={t("goalsTab.totalReaches", "Всего достижений")}
          value={totalReaches.toLocaleString()}
          change={showComparison ? Math.round(reachesChange * 10) / 10 : 0}
          positive={reachesChange >= 0}
          sparkData={chartData.map(d => ({ v: d.current }))}
          chartColor="hsl(var(--chart-1))"
        />
        <KpiCard
          label={t("goalsTab.avgCR", "Средний CR%")}
          value={`${avgCR}%`}
          change={0}
          positive={true}
          sparkData={[]}
          chartColor="hsl(var(--chart-2))"
        />
        <KpiCard
          label={t("goalsTab.goalsCount", "Целей отслеживается")}
          value={String(goals.length)}
          change={0}
          positive={true}
          sparkData={[]}
          chartColor="hsl(var(--chart-4))"
        />
      </div>

      {/* Conversion dynamics chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Target className="h-4 w-4" />
            {t("goalsTab.conversionDynamics", "Динамика конверсий")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartDataWithComp.length > 0 ? (
            <ResponsiveContainer width="100%" height={320}>
              {showComparison ? (
                <LineChart data={chartDataWithComp}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip content={<CustomTooltip />} />
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
                  <Tooltip content={<CustomTooltip />} />
                  <Area type="monotone" dataKey="current" name={t("goalsTab.reaches", "Достижения")}
                    stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#goalsGrad)" dot={false}
                    activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
                </AreaChart>
              )}
            </ResponsiveContainer>
          ) : (
            <div className="flex items-center justify-center h-[320px] text-sm text-muted-foreground">
              <div className="text-center">
                <Target className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                <p>{t("goals.empty")}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Goals table */}
      {goalsWithDelta.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {t("goalsTab.detailedTable", "Детальная таблица целей")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("goals.goalName")}</TableHead>
                  <TableHead className="text-xs">{t("goals.reaches")}</TableHead>
                  <TableHead className="text-xs">{t("goals.conversion")}</TableHead>
                  <TableHead className="text-xs">{t("goals.change")}</TableHead>
                  {showComparison && (
                    <TableHead className="text-xs">{t("goalsTab.periodDelta", "Δ период")}</TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {goalsWithDelta.map(g => (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium text-sm max-w-[250px] truncate">{g.name}</TableCell>
                    <TableCell className="text-sm tabular-nums">{g.reaches.toLocaleString()}</TableCell>
                    <TableCell className="text-sm tabular-nums">{g.conversionRate}%</TableCell>
                    <TableCell><ChangeIndicator value={g.change} /></TableCell>
                    {showComparison && (
                      <TableCell><ChangeIndicator value={g.delta} /></TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
