import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Link2 } from "lucide-react";
import { toast } from "sonner";
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  BarChart, Bar, Cell,
} from "recharts";
import { trafficData, sourcesData, kpiData } from "@/data/projects";
import { KpiCard } from "@/components/KpiCard";

interface AnalyticsTabProps {
  projectId: string;
}

// Sparkline data generators
const visitsSpark = [
  { v: 420 }, { v: 510 }, { v: 680 }, { v: 620 }, { v: 590 },
  { v: 730 }, { v: 870 }, { v: 810 }, { v: 1020 }, { v: 960 },
  { v: 940 }, { v: 1080 }, { v: 1150 },
];
const usersSpark = [
  { v: 350 }, { v: 380 }, { v: 500 }, { v: 470 }, { v: 520 },
  { v: 610 }, { v: 700 }, { v: 680 }, { v: 820 }, { v: 790 },
  { v: 810 }, { v: 850 }, { v: 900 },
];
const bounceSpark = [
  { v: 38 }, { v: 37 }, { v: 36 }, { v: 35 }, { v: 34 },
  { v: 34 }, { v: 33 }, { v: 33 }, { v: 32 }, { v: 32 },
  { v: 32 }, { v: 31 }, { v: 32 },
];
const convSpark = [
  { v: 180 }, { v: 210 }, { v: 240 }, { v: 220 }, { v: 260 },
  { v: 280 }, { v: 290 }, { v: 300 }, { v: 310 }, { v: 320 },
  { v: 330 }, { v: 340 }, { v: 342 },
];

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md shadow-sm px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold text-foreground">
          {p.name}: {p.value?.toLocaleString()}
        </p>
      ))}
    </div>
  );
};

export function AnalyticsTab({ projectId }: AnalyticsTabProps) {
  const { t } = useTranslation();
  const [period, setPeriod] = useState("month");
  const [comparison, setComparison] = useState("prev_month");

  const handleGenerateReport = () => {
    const url = `${window.location.origin}/report/${projectId}`;
    navigator.clipboard.writeText(url);
    toast.success(t("project.analytics.linkCopied"));
  };

  const sourceLabels: Record<string, string> = {
    organic: t("project.analytics.organic"),
    direct: t("project.analytics.direct"),
    social: t("project.analytics.social"),
    referral: t("project.analytics.referral"),
  };

  const labeledSources = sourcesData.map((s) => ({
    ...s,
    label: sourceLabels[s.name] || s.name,
  }));

  const kpis = [
    { label: t("publicReport.kpi.visits"), value: kpiData.visits.value.toLocaleString(), change: kpiData.visits.change, positive: true, sparkData: visitsSpark, color: "hsl(var(--chart-1))" },
    { label: t("project.analytics.users"), value: "8,240", change: 12.3, positive: true, sparkData: usersSpark, color: "hsl(var(--chart-5))" },
    { label: t("publicReport.kpi.bounceRate"), value: `${kpiData.bounceRate.value}%`, change: kpiData.bounceRate.change, positive: kpiData.bounceRate.change < 0, sparkData: bounceSpark, color: "hsl(var(--chart-3))" },
    { label: t("project.analytics.conversions"), value: "342", change: 24.5, positive: true, sparkData: convSpark, color: "hsl(var(--chart-2))" },
  ];

  const barColors = [
    "hsl(var(--chart-1))",
    "hsl(var(--chart-2))",
    "hsl(var(--chart-3))",
    "hsl(var(--chart-4))",
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-[130px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="week">{t("project.analytics.week")}</SelectItem>
              <SelectItem value="month">{t("project.analytics.month")}</SelectItem>
              <SelectItem value="year">{t("project.analytics.year")}</SelectItem>
            </SelectContent>
          </Select>
          <Select value={comparison} onValueChange={setComparison}>
            <SelectTrigger className="w-[180px] h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="prev_week">{t("project.analytics.prevWeek")}</SelectItem>
              <SelectItem value="prev_month">{t("project.analytics.prevMonth")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <Button onClick={handleGenerateReport} size="sm" className="gap-2 h-9">
          <Link2 className="h-3.5 w-3.5" />
          {t("project.analytics.generateReport")}
        </Button>
      </div>

      {/* KPI Cards with Sparklines */}
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

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Area Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("project.analytics.traffic")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={trafficData}>
                <defs>
                  <linearGradient id="analyticsGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--chart-1))" stopOpacity={0.15} />
                    <stop offset="95%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="visitors" name={t("project.analytics.visitors")} stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#analyticsGrad)" dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "hsl(var(--card))" }} />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Bar Chart */}
        <Card className="border-border bg-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t("project.analytics.sources")}</CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={labeledSources}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
                <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                  {labeledSources.map((_, index) => (
                    <Cell key={index} fill={barColors[index % barColors.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
