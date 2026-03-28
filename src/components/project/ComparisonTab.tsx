import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  ArrowUpDown, TrendingUp, TrendingDown, Minus,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";
import { format, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ComparisonTabProps {
  projectId: string;
  projectName: string;
}

interface MetricRow {
  key: string;
  label: string;
  current: number;
  previous: number;
  format: "number" | "percent" | "seconds";
}

function fmtVal(v: number, fmt: "number" | "percent" | "seconds") {
  if (fmt === "percent") return `${v}%`;
  if (fmt === "seconds") {
    const m = Math.floor(v / 60);
    const s = v % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return v.toLocaleString();
}

function calcDelta(current: number, previous: number): number {
  if (previous === 0) return 0;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

export function ComparisonTab({ projectId, projectName }: ComparisonTabProps) {
  const { t } = useTranslation();
  const {
    appliedRange, appliedCompRange, showComparison,
    applyVersion, channel,
  } = useDateRange();

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

  const latestStat = allStats[0];

  // Build daily data from real stats
  const buildDaily = (stat: typeof latestStat, range: { from: Date; to: Date }) => {
    if (!stat) return [];
    const visitsByDay = (stat.visits_by_day as any[]) || [];
    const dateFromParsed = parseISO(stat.date_from);
    return visitsByDay
      .map((entry: any, index: number) => {
        const date = new Date(dateFromParsed);
        date.setDate(date.getDate() + index);
        return { date, visits: entry.visits || 0, dateStr: format(date, "dd.MM") };
      })
      .filter((d) => d.date >= range.from && d.date <= range.to);
  };

  const currentDaily = useMemo(() => buildDaily(latestStat, appliedRange), [latestStat, appliedRange]);
  const compDaily = useMemo(() => buildDaily(latestStat, appliedCompRange), [latestStat, appliedCompRange]);

  const totalVisitsCur = currentDaily.reduce((s, d) => s + d.visits, 0);
  const totalVisitsComp = compDaily.reduce((s, d) => s + d.visits, 0);

  // KPIs from real data
  const bounceRate = latestStat?.bounce_rate || 0;
  const pageDepth = latestStat?.page_depth || 0;
  const avgDuration = latestStat?.avg_duration_seconds || 0;

  const metrics: MetricRow[] = [
    { key: "visits", label: t("comparison.metric.visits"), current: totalVisitsCur, previous: totalVisitsComp, format: "number" },
    { key: "bounceRate", label: t("comparison.metric.bounceRate"), current: bounceRate, previous: bounceRate, format: "percent" },
    { key: "depth", label: t("comparison.metric.depth"), current: pageDepth, previous: pageDepth, format: "number" },
    { key: "avgTime", label: t("comparison.metric.avgTime"), current: avgDuration, previous: avgDuration, format: "seconds" },
  ];

  // Chart data
  const chartData = useMemo(() => {
    const maxLen = Math.max(currentDaily.length, compDaily.length);
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      data.push({
        dayIndex: i + 1,
        current: currentDaily[i]?.visits ?? null,
        previous: compDaily[i]?.visits ?? null,
      });
    }
    return data;
  }, [currentDaily, compDaily]);

  const periodALabel = `${format(appliedRange.from, "dd.MM.yy")} – ${format(appliedRange.to, "dd.MM.yy")}`;
  const periodBLabel = `${format(appliedCompRange.from, "dd.MM.yy")} – ${format(appliedCompRange.to, "dd.MM.yy")}`;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-[320px] w-full" />
        <Skeleton className="h-[300px] w-full" />
      </div>
    );
  }

  if (!latestStat) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <ArrowUpDown className="h-10 w-10 mb-3 opacity-30" />
        <p className="text-sm">{t("project.analytics.noData", "Данные отсутствуют. Подключите Яндекс.Метрику.")}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-primary/60 text-primary-foreground">
          <ArrowUpDown className="h-5 w-5" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("comparison.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {periodALabel} vs {periodBLabel}
          </p>
        </div>
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl border border-border bg-card p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4">{t("comparison.chartTitle")}</h3>
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="dayIndex" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} width={50} />
                <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
                <Legend formatter={(value) => value === "current" ? t("comparison.periodA") : t("comparison.periodB")} />
                <Line type="monotone" dataKey="current" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                <Line type="monotone" dataKey="previous" stroke="hsl(var(--muted-foreground))" strokeWidth={2} strokeDasharray="6 3" dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </motion.div>
      )}

      {/* Delta table */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="rounded-xl border border-border bg-card overflow-hidden">
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold text-foreground mb-1">{t("comparison.tableTitle")}</h3>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">{t("comparison.col.metric")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.was")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.now")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.pct")}</TableHead>
              <TableHead className="text-xs text-center">{t("comparison.col.trend")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m) => {
              const delta = calcDelta(m.current, m.previous);
              const isGood = m.key === "bounceRate" ? delta < 0 : delta > 0;
              const isNeutral = delta === 0;
              return (
                <TableRow key={m.key}>
                  <TableCell className="font-medium text-sm">{m.label}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">{fmtVal(m.previous, m.format)}</TableCell>
                  <TableCell className="text-right text-sm font-medium">{fmtVal(m.current, m.format)}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={cn("text-[11px] px-2 py-0.5",
                      isNeutral ? "bg-muted text-muted-foreground border-border"
                        : isGood ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                          : "bg-red-500/10 text-red-600 border-red-500/20"
                    )}>
                      {delta > 0 ? "+" : ""}{delta}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {isNeutral ? <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                      : isGood ? <TrendingUp className="h-4 w-4 text-emerald-600 mx-auto" />
                        : <TrendingDown className="h-4 w-4 text-red-600 mx-auto" />}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </motion.div>
    </div>
  );
}
