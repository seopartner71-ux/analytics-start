import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subYears, differenceInDays } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarIcon, ArrowRightLeft, Loader2, TrendingUp, TrendingDown, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { AiInsightsBlock } from "@/components/project/AiInsightsBlock";
import { supabase } from "@/integrations/supabase/client";

interface SeoTabProps {
  projectId: string;
}

type DateRange = { from: Date; to: Date };

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data || data.length < 2) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={64} height={24}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

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

const DualTooltip = ({ active, payload, label, showComparison }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-lg shadow-lg px-3 py-2 min-w-[160px]">
      <p className="text-xs text-muted-foreground mb-1 font-medium">{label}</p>
      {payload.map((p: any, i: number) => (
        <div key={i} className="flex items-center justify-between gap-3">
          <span className="flex items-center gap-1.5 text-xs">
            <span className="w-2.5 h-2.5 rounded-full" style={{ background: p.color }} />
            {p.name}
          </span>
          <span className="text-sm font-semibold tabular-nums" style={{ color: p.color }}>
            {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
          </span>
        </div>
      ))}
    </div>
  );
};

// Demo SEO queries data - in production this would come from GSC/Webmaster API
function generateSeoData(dateFrom: Date, dateTo: Date) {
  const days = differenceInDays(dateTo, dateFrom) + 1;
  const queries = [
    { query: "купить цветы", clicks: 342, impressions: 8200, position: 4.2, positionTrend: [5.1, 4.8, 4.5, 4.3, 4.2, 4.0, 4.2] },
    { query: "доставка цветов", clicks: 218, impressions: 5600, position: 6.8, positionTrend: [8.2, 7.5, 7.1, 6.9, 6.8, 6.5, 6.8] },
    { query: "букет роз", clicks: 187, impressions: 4100, position: 3.1, positionTrend: [4.0, 3.8, 3.5, 3.2, 3.1, 3.0, 3.1] },
    { query: "цветы москва", clicks: 156, impressions: 2900, position: 2.4, positionTrend: [3.5, 3.0, 2.8, 2.6, 2.4, 2.3, 2.4] },
    { query: "свадебный букет", clicks: 134, impressions: 3800, position: 7.5, positionTrend: [9.0, 8.5, 8.0, 7.8, 7.5, 7.3, 7.5] },
    { query: "цветы оптом", clicks: 98, impressions: 2200, position: 11.3, positionTrend: [15.0, 13.5, 12.8, 12.0, 11.5, 11.3, 11.3] },
    { query: "комнатные растения", clicks: 76, impressions: 1800, position: 9.7, positionTrend: [12.0, 11.0, 10.5, 10.0, 9.8, 9.7, 9.7] },
    { query: "подарить цветы", clicks: 65, impressions: 1500, position: 5.4, positionTrend: [7.0, 6.5, 6.0, 5.8, 5.5, 5.4, 5.4] },
  ];

  // Visibility chart data
  const visibilityData = [];
  for (let i = 0; i < Math.min(days, 30); i++) {
    const d = new Date(dateFrom);
    d.setDate(d.getDate() + i);
    visibilityData.push({
      day: format(d, "dd.MM"),
      clicks: Math.round(40 + Math.random() * 30 + i * 1.5),
      impressions: Math.round(200 + Math.random() * 100 + i * 5),
    });
  }

  return { queries, visibilityData };
}

export function SeoTab({ projectId }: SeoTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;

  const today = new Date();
  const [range, setRange] = useState<DateRange>({ from: subDays(today, 30), to: today });
  const [appliedRange, setAppliedRange] = useState<DateRange>(range);

  const [showComparison, setShowComparison] = useState(false);
  const [compRange, setCompRange] = useState<DateRange>({
    from: subYears(subDays(today, 30), 1), to: subYears(today, 1),
  });
  const [appliedCompRange, setAppliedCompRange] = useState<DateRange>(compRange);

  // AI summary
  const { data: cachedReport } = useQuery({
    queryKey: ["cached_report", projectId],
    queryFn: async () => {
      const now = new Date();
      const { data } = await supabase.from("cached_reports").select("*")
        .eq("project_id", projectId).eq("report_year", now.getFullYear()).eq("report_month", now.getMonth()).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  const aiSummary = cachedReport?.report_data && typeof cachedReport.report_data === 'object' && 'ai_summary' in (cachedReport.report_data as any)
    ? (cachedReport.report_data as any).ai_summary : undefined;

  const { queries, visibilityData } = useMemo(
    () => generateSeoData(appliedRange.from, appliedRange.to), [appliedRange]
  );

  const compData = useMemo(() => {
    if (!showComparison) return null;
    return generateSeoData(appliedCompRange.from, appliedCompRange.to);
  }, [showComparison, appliedCompRange]);

  // Merge visibility for comparison
  const mergedVisibility = useMemo(() => {
    if (!showComparison || !compData) return visibilityData.map(d => ({ ...d }));
    const maxLen = Math.max(visibilityData.length, compData.visibilityData.length);
    const result = [];
    for (let i = 0; i < maxLen; i++) {
      result.push({
        day: visibilityData[i]?.day || `${i + 1}`,
        clicks: visibilityData[i]?.clicks || 0,
        impressions: visibilityData[i]?.impressions || 0,
        prevClicks: compData.visibilityData[i]?.clicks || 0,
        prevImpressions: compData.visibilityData[i]?.impressions || 0,
      });
    }
    return result;
  }, [visibilityData, compData, showComparison]);

  // Queries with delta
  const queriesWithDelta = useMemo(() => {
    if (!showComparison || !compData) return queries.map(q => ({ ...q, clicksDelta: 0, positionDelta: 0 }));
    return queries.map(q => {
      const prev = compData.queries.find(cq => cq.query === q.query);
      return {
        ...q,
        clicksDelta: prev ? ((q.clicks - prev.clicks) / prev.clicks) * 100 : 0,
        positionDelta: prev ? q.position - prev.position : 0,
      };
    });
  }, [queries, compData, showComparison]);

  const handleApply = () => {
    setAppliedRange({ ...range });
    if (showComparison) setAppliedCompRange({ ...compRange });
  };

  const handleCompPreset = (type: "previous" | "lastYear") => {
    const days = differenceInDays(range.to, range.from);
    const nr = type === "previous"
      ? { from: subDays(range.from, days + 1), to: subDays(range.from, 1) }
      : { from: subYears(range.from, 1), to: subYears(range.to, 1) };
    setCompRange(nr);
  };

  const totalClicks = queries.reduce((s, q) => s + q.clicks, 0);
  const totalImpressions = queries.reduce((s, q) => s + q.impressions, 0);
  const avgPosition = queries.length > 0
    ? Math.round((queries.reduce((s, q) => s + q.position, 0) / queries.length) * 10) / 10
    : 0;

  return (
    <div className="space-y-6">
      {/* Filter Bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
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
                <Calendar mode="range" selected={{ from: range.from, to: range.to }}
                  onSelect={(r: any) => { if (r?.from) setRange({ from: r.from, to: r.to || r.from }); }}
                  numberOfMonths={2} locale={locale} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <span className="text-xs font-bold text-muted-foreground px-1">VS</span>

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
                  <Calendar mode="range" selected={{ from: compRange.from, to: compRange.to }}
                    onSelect={(r: any) => { if (r?.from) setCompRange({ from: r.from, to: r.to || r.from }); }}
                    numberOfMonths={2} locale={locale} className="p-3 pointer-events-auto" />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex items-center gap-2 ml-1">
              <Switch id="seo-comp" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90" />
              <Label htmlFor="seo-comp" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                {t("comparison.enable", "Сравнение")}
              </Label>
            </div>

            <Button size="sm" className="h-8 text-xs ml-auto" onClick={handleApply}>
              {t("project.analytics.apply", "Применить")}
            </Button>
          </div>

          {showComparison && (
            <div className="flex items-center gap-2 mt-2 pt-2 border-t border-border">
              <span className="text-xs text-muted-foreground">{t("comparison.presets", "Пресеты")}:</span>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("previous")}>
                {t("project.analytics.prevPeriod")}
              </Button>
              <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={() => handleCompPreset("lastYear")}>
                {t("project.analytics.lastYear")}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* KPI row */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("seoTab.totalClicks", "Клики")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalClicks.toLocaleString()}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("seoTab.totalImpressions", "Показы")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalImpressions.toLocaleString()}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("seoTab.avgPosition", "Ср. позиция")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{avgPosition}</p>
        </Card>
      </div>

      {/* Visibility Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("seoTab.visibility", "Видимость: Показы vs Клики")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={mergedVisibility}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<DualTooltip showComparison={showComparison} />} />
              <Legend />
              <Line type="monotone" dataKey="clicks" name={t("seoTab.clicks", "Клики")}
                stroke="hsl(var(--chart-1))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} />
              <Line type="monotone" dataKey="impressions" name={t("seoTab.impressions", "Показы")}
                stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} activeDot={{ r: 4 }} />
              {showComparison && (
                <>
                  <Line type="monotone" dataKey="prevClicks" name={`${t("seoTab.clicks")} (${t("comparison.periodB")})`}
                    stroke="hsl(var(--chart-1))" strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} />
                  <Line type="monotone" dataKey="prevImpressions" name={`${t("seoTab.impressions")} (${t("comparison.periodB")})`}
                    stroke="hsl(var(--chart-2))" strokeWidth={1.5} strokeDasharray="6 3" dot={false} opacity={0.5} />
                </>
              )}
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Queries Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground">
            {t("seoTab.queriesTable", "Поисковые запросы")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">{t("seoTab.query", "Запрос")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.clicks", "Клики")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.impressions", "Показы")}</TableHead>
                  <TableHead className="text-xs text-right">{t("seoTab.position", "Ср. позиция")}</TableHead>
                  <TableHead className="text-xs text-center">{t("seoTab.trend", "Тренд")}</TableHead>
                  {showComparison && <TableHead className="text-xs text-right">{t("seoTab.change", "Δ Клики")}</TableHead>}
                  {showComparison && <TableHead className="text-xs text-right">{t("seoTab.posChange", "Δ Позиция")}</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {queriesWithDelta.map((q, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-sm font-medium">{q.query}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.clicks.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.impressions.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{q.position.toFixed(1)}</TableCell>
                    <TableCell className="text-center">
                      <Sparkline data={q.positionTrend} color={q.positionTrend[0] > q.positionTrend[q.positionTrend.length - 1] ? "hsl(142, 71%, 45%)" : "hsl(0, 84%, 60%)"} />
                    </TableCell>
                    {showComparison && (
                      <TableCell className="text-right">
                        <ChangeIndicator value={q.clicksDelta} />
                      </TableCell>
                    )}
                    {showComparison && (
                      <TableCell className="text-right">
                        <span className={cn("text-xs font-semibold", q.positionDelta < 0 ? "text-emerald-500" : q.positionDelta > 0 ? "text-red-500" : "text-muted-foreground")}>
                          {q.positionDelta < 0 ? "↑" : q.positionDelta > 0 ? "↓" : "—"}
                          {q.positionDelta !== 0 ? Math.abs(q.positionDelta).toFixed(1) : ""}
                        </span>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights - SEO context */}
      <AiInsightsBlock
        projectId={projectId}
        summary={aiSummary}
        isAdmin={true}
        trafficSources={[]}
      />
    </div>
  );
}
