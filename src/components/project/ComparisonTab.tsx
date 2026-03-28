import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import {
  ArrowUpDown, TrendingUp, TrendingDown, Minus, BarChart3,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableHeader, TableBody, TableRow, TableHead, TableCell,
} from "@/components/ui/table";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";
import {
  generateDailyVisits, computeKpis, calcDelta, type DateRange,
} from "@/lib/data-generators";
import { format, differenceInDays } from "date-fns";

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

export function ComparisonTab({ projectId, projectName }: ComparisonTabProps) {
  const { t } = useTranslation();
  const {
    appliedRange, appliedCompRange, showComparison,
    applyVersion, channel,
  } = useDateRange();

  const currentDaily = useMemo(
    () => generateDailyVisits(appliedRange),
    [appliedRange, applyVersion]
  );
  const compDaily = useMemo(
    () => generateDailyVisits(appliedCompRange),
    [appliedCompRange, applyVersion]
  );
  const currentKpis = useMemo(() => computeKpis(currentDaily), [currentDaily]);
  const compKpis = useMemo(() => computeKpis(compDaily), [compDaily]);

  // Apply channel filter multiplier
  const channelMultiplier = useMemo(() => {
    const map: Record<string, number> = {
      all: 1, organic: 0.55, direct: 0.2, referral: 0.1, social: 0.08, ad: 0.07,
    };
    return map[channel] || 1;
  }, [channel]);

  const applyChannel = (v: number) => Math.round(v * channelMultiplier);

  // Build chart data — align by day index
  const chartData = useMemo(() => {
    const maxLen = Math.max(currentDaily.length, compDaily.length);
    const data = [];
    for (let i = 0; i < maxLen; i++) {
      const cur = currentDaily[i];
      const comp = compDaily[i];
      data.push({
        dayIndex: i + 1,
        dateA: cur ? cur.dateStr : "",
        dateB: comp ? comp.dateStr : "",
        current: cur ? applyChannel(cur.visits) : null,
        previous: comp ? applyChannel(comp.visits) : null,
      });
    }
    return data;
  }, [currentDaily, compDaily, channelMultiplier]);

  // Metrics table
  const bounceA = Math.round((currentKpis.bounceRate + (channelMultiplier < 1 ? -3 : 0)) * 10) / 10;
  const bounceB = Math.round((compKpis.bounceRate + (channelMultiplier < 1 ? -1 : 0)) * 10) / 10;
  const daysA = differenceInDays(appliedRange.to, appliedRange.from) + 1;
  const depthA = Math.round((2.8 + (daysA % 5) * 0.1) * 10) / 10;
  const depthB = Math.round((2.5 + (daysA % 3) * 0.15) * 10) / 10;
  const timeA = Math.round(135 + (daysA % 7) * 8);
  const timeB = Math.round(120 + (daysA % 5) * 6);

  const metrics: MetricRow[] = [
    { key: "visits", label: t("comparison.metric.visits"), current: applyChannel(currentKpis.totalVisits), previous: applyChannel(compKpis.totalVisits), format: "number" },
    { key: "visitors", label: t("comparison.metric.visitors"), current: applyChannel(currentKpis.totalVisitors), previous: applyChannel(compKpis.totalVisitors), format: "number" },
    { key: "bounceRate", label: t("comparison.metric.bounceRate"), current: bounceA, previous: bounceB, format: "percent" },
    { key: "conversions", label: t("comparison.metric.conversions"), current: applyChannel(currentKpis.conversions), previous: applyChannel(compKpis.conversions), format: "number" },
    { key: "depth", label: t("comparison.metric.depth"), current: depthA, previous: depthB, format: "number" },
    { key: "avgTime", label: t("comparison.metric.avgTime"), current: timeA, previous: timeB, format: "seconds" },
  ];

  const periodALabel = `${format(appliedRange.from, "dd.MM.yy")} – ${format(appliedRange.to, "dd.MM.yy")}`;
  const periodBLabel = `${format(appliedCompRange.from, "dd.MM.yy")} – ${format(appliedCompRange.to, "dd.MM.yy")}`;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 text-primary-foreground">
            <ArrowUpDown className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">{t("comparison.title")}</h2>
            <p className="text-sm text-muted-foreground">
              {periodALabel} vs {periodBLabel}
            </p>
          </div>
        </div>
      </div>

      {/* Dual-line chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card p-5"
      >
        <h3 className="text-sm font-semibold text-foreground mb-4">{t("comparison.chartTitle")}</h3>
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis
                dataKey="dayIndex"
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                label={{ value: t("comparison.dayAxis"), position: "insideBottom", offset: -2, fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                tickLine={false}
                axisLine={false}
                width={50}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  fontSize: "12px",
                }}
                formatter={(value: number, name: string) => [
                  value?.toLocaleString(),
                  name === "current" ? `${t("comparison.periodA")} (${periodALabel})` : `${t("comparison.periodB")} (${periodBLabel})`,
                ]}
                labelFormatter={(label) => `${t("comparison.day")} ${label}`}
              />
              <Legend
                formatter={(value) =>
                  value === "current" ? t("comparison.periodA") : t("comparison.periodB")
                }
              />
              <Line
                type="monotone"
                dataKey="current"
                stroke="hsl(var(--primary))"
                strokeWidth={2.5}
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--primary))" }}
              />
              <Line
                type="monotone"
                dataKey="previous"
                stroke="hsl(var(--muted-foreground))"
                strokeWidth={2}
                strokeDasharray="6 3"
                dot={false}
                activeDot={{ r: 4, fill: "hsl(var(--muted-foreground))" }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      {/* Delta table */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl border border-border bg-card overflow-hidden"
      >
        <div className="p-5 pb-0">
          <h3 className="text-sm font-semibold text-foreground mb-1">{t("comparison.tableTitle")}</h3>
          <p className="text-xs text-muted-foreground mb-4">{t("comparison.tableSubtitle")}</p>
        </div>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">{t("comparison.col.metric")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.was")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.now")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.abs")}</TableHead>
              <TableHead className="text-xs text-right">{t("comparison.col.pct")}</TableHead>
              <TableHead className="text-xs text-center">{t("comparison.col.trend")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {metrics.map((m, i) => {
              const delta = calcDelta(m.current, m.previous);
              const absDiff = m.format === "percent"
                ? Math.round((m.current - m.previous) * 10) / 10
                : m.current - m.previous;
              // For bounce rate, down is good
              const isGood = m.key === "bounceRate" ? delta < 0 : delta > 0;
              const isNeutral = delta === 0;

              return (
                <TableRow key={m.key}>
                  <TableCell className="font-medium text-sm">{m.label}</TableCell>
                  <TableCell className="text-right text-sm text-muted-foreground">
                    {fmtVal(m.previous, m.format)}
                  </TableCell>
                  <TableCell className="text-right text-sm font-medium">
                    {fmtVal(m.current, m.format)}
                  </TableCell>
                  <TableCell className="text-right text-sm">
                    <span className={isNeutral ? "text-muted-foreground" : isGood ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}>
                      {absDiff > 0 ? "+" : ""}{fmtVal(absDiff, m.format)}
                    </span>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge
                      variant="outline"
                      className={`text-[11px] px-2 py-0.5 ${
                        isNeutral
                          ? "bg-muted text-muted-foreground border-border"
                          : isGood
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                            : "bg-red-500/10 text-red-600 border-red-500/20 dark:text-red-400"
                      }`}
                    >
                      {delta > 0 ? "+" : ""}{delta}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-center">
                    {isNeutral ? (
                      <Minus className="h-4 w-4 text-muted-foreground mx-auto" />
                    ) : isGood ? (
                      <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 mx-auto" />
                    ) : (
                      <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 mx-auto" />
                    )}
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
