import { useState, useMemo, useRef, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { format, subDays, subYears, differenceInDays } from "date-fns";
import { ru, enUS } from "date-fns/locale";
import { useDateRange } from "@/contexts/DateRangeContext";
import { generatePagesData, calcDelta } from "@/lib/data-generators";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  CalendarIcon, ArrowRightLeft, ExternalLink, FileText, TrendingUp, TrendingDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell,
} from "recharts";
import { AiInsightsBlock } from "@/components/project/AiInsightsBlock";
import { ExportMenu } from "@/components/ExportMenu";
import { exportToPdf, exportToExcel, exportToWord, type ExcelSheet, type WordSection } from "@/lib/export-utils";
import { supabase } from "@/integrations/supabase/client";

interface PagesTabProps {
  projectId: string;
  projectName: string;
}

type DateRange = { from: Date; to: Date };

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

const SimpleTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-card border border-border rounded-md shadow-sm px-3 py-2">
      <p className="text-xs text-muted-foreground mb-0.5 max-w-[200px] truncate">{label}</p>
      {payload.map((p: any, i: number) => (
        <p key={i} className="text-sm font-semibold" style={{ color: p.color }}>
          {p.name}: {typeof p.value === "number" ? p.value.toLocaleString() : p.value}
        </p>
      ))}
    </div>
  );
};

// Demo pages data
function generatePagesData() {
  return [
    { url: "/", title: "Главная страница", visits: 4250, bounceRate: 28.5, avgTime: 185, growth: 12.3 },
    { url: "/catalog", title: "Каталог цветов", visits: 2830, bounceRate: 22.1, avgTime: 240, growth: 18.7 },
    { url: "/delivery", title: "Доставка", visits: 1920, bounceRate: 35.2, avgTime: 120, growth: 8.4 },
    { url: "/bouquets/roses", title: "Букеты из роз", visits: 1650, bounceRate: 19.8, avgTime: 195, growth: 25.1 },
    { url: "/corporate", title: "Корпоративным клиентам", visits: 980, bounceRate: 31.0, avgTime: 165, growth: 32.6 },
    { url: "/blog/spring-flowers", title: "Весенние цветы: гид", visits: 870, bounceRate: 15.3, avgTime: 310, growth: 45.2 },
    { url: "/contacts", title: "Контакты", visits: 750, bounceRate: 42.1, avgTime: 85, growth: 5.1 },
    { url: "/about", title: "О нас", visits: 620, bounceRate: 38.7, avgTime: 130, growth: -3.2 },
    { url: "/blog/wedding-bouquets", title: "Свадебные букеты", visits: 540, bounceRate: 12.8, avgTime: 280, growth: 38.9 },
    { url: "/promo", title: "Акции", visits: 480, bounceRate: 25.4, avgTime: 150, growth: 22.0 },
  ];
}

const CHART_COLORS = [
  "hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))",
  "hsl(var(--chart-4))", "hsl(var(--chart-5))",
];

export function PagesTab({ projectId, projectName }: PagesTabProps) {
  const { t, i18n } = useTranslation();
  const locale = i18n.language === "ru" ? ru : enUS;
  const contentRef = useRef<HTMLDivElement>(null);

  const {
    range, setRange, appliedRange, apply,
    showComparison, setShowComparison,
    compRange, setCompRange, appliedCompRange,
    resetToDefault, applyVersion,
  } = useDateRange();

  // Loading animation on apply
  const [isRefreshing, setIsRefreshing] = useState(false);
  const prevVersion = useRef(applyVersion);
  useEffect(() => {
    if (applyVersion !== prevVersion.current) {
      prevVersion.current = applyVersion;
      setIsRefreshing(true);
      const timer = setTimeout(() => setIsRefreshing(false), 500);
      return () => clearTimeout(timer);
    }
  }, [applyVersion]);

  // Dynamic pages data based on applied date range
  const pages = useMemo(() => generatePagesData(appliedRange), [appliedRange]);
  const compPages = useMemo(
    () => showComparison ? generatePagesData(appliedCompRange) : [],
    [appliedCompRange, showComparison]
  );

  const top5Growing = useMemo(() => [...pages].sort((a, b) => b.growth - a.growth).slice(0, 5), [pages]);

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

  const handleApply = () => apply();

  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const totalVisits = pages.reduce((s, p) => s + p.visits, 0);
  const avgBounce = pages.length > 0 ? Math.round((pages.reduce((s, p) => s + p.bounceRate, 0) / pages.length) * 10) / 10 : 0;

  const compTotalVisits = compPages.reduce((s, p) => s + p.visits, 0);
  const compAvgBounce = compPages.length > 0 ? Math.round((compPages.reduce((s, p) => s + p.bounceRate, 0) / compPages.length) * 10) / 10 : 0;

  return (
    <div className="space-y-6" ref={contentRef}>
      {/* Filter Bar */}
      <Card className="border-border bg-card">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 flex-wrap">
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
                  numberOfMonths={1} locale={locale} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>

            <div className="flex items-center gap-2 ml-1">
              <Switch id="pages-comp" checked={showComparison} onCheckedChange={setShowComparison} className="scale-90" />
              <Label htmlFor="pages-comp" className="text-xs text-muted-foreground cursor-pointer flex items-center gap-1">
                <ArrowRightLeft className="h-3 w-3" />
                {t("comparison.enable")}
              </Label>
            </div>

            <Button size="sm" className="h-8 text-xs ml-auto" onClick={handleApply}>
              {t("project.analytics.apply")}
            </Button>
            <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground" onClick={resetToDefault}>
              {t("datePicker.reset", "Сбросить")}
            </Button>
            <ExportMenu
              onExportPdf={async () => { if (contentRef.current) await exportToPdf(contentRef.current, { projectName, tabName: t("project.tabs.pages"), periodA: format(appliedRange.from, "dd.MM.yy") + " — " + format(appliedRange.to, "dd.MM.yy"), language: i18n.language }); }}
              onExportExcel={async () => {
                const sheets: ExcelSheet[] = [{ name: t("project.tabs.pages"), headers: ["URL", t("pagesTab.title", "Страница"), t("publicReport.kpi.visits"), t("publicReport.kpi.bounceRate"), t("pagesTab.avgTime", "Ср. время")], rows: pages.map(p => [p.url, p.title, p.visits, `${p.bounceRate}%`, formatDuration(p.avgTime)]) }];
                exportToExcel(sheets, { projectName, tabName: t("project.tabs.pages"), periodA: format(appliedRange.from, "dd.MM.yy") + " — " + format(appliedRange.to, "dd.MM.yy"), language: i18n.language });
              }}
              onExportWord={async () => {
                const sections: WordSection[] = [{ title: t("project.tabs.pages"), table: { headers: ["URL", t("publicReport.kpi.visits"), t("publicReport.kpi.bounceRate")], rows: pages.map(p => [p.url, p.visits, `${p.bounceRate}%`]) } }];
                await exportToWord(sections, { projectName, tabName: t("project.tabs.pages"), periodA: format(appliedRange.from, "dd.MM.yy") + " — " + format(appliedRange.to, "dd.MM.yy"), language: i18n.language });
              }}
            />
          </div>
        </CardContent>
      </Card>

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("pagesTab.totalVisits", "Всего визитов")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{totalVisits.toLocaleString()}</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("pagesTab.avgBounce", "Ср. отказы")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{avgBounce}%</p>
        </Card>
        <Card className="border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">{t("pagesTab.pagesCount", "Страниц")}</p>
          <p className="text-2xl font-bold text-foreground mt-1">{pages.length}</p>
        </Card>
      </div>

      {/* Top Growing Pages Chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            {t("pagesTab.topGrowing", "Топ-5 быстрорастущих страниц")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={top5Growing} layout="vertical" margin={{ left: 120 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} horizontal={false} />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false}
                tickFormatter={(v) => `+${v}%`} />
              <YAxis type="category" dataKey="title" stroke="hsl(var(--muted-foreground))" fontSize={11}
                tickLine={false} axisLine={false} width={120} />
              <Tooltip content={<SimpleTooltip />} />
              <Bar dataKey="growth" name={t("pagesTab.growth", "Рост %")} radius={[0, 4, 4, 0]}>
                {top5Growing.map((_, i) => (
                  <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Pages Table */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <FileText className="h-4 w-4" />
            {t("pagesTab.topPages", "Топ страниц")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="rounded-lg border border-border/60 overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs">{t("pagesTab.page", "Страница")}</TableHead>
                  <TableHead className="text-xs text-right">{t("pagesTab.visits", "Визиты")}</TableHead>
                  <TableHead className="text-xs text-right">{t("pagesTab.bounce", "Отказы %")}</TableHead>
                  <TableHead className="text-xs text-right">{t("pagesTab.avgTime", "Ср. время")}</TableHead>
                  <TableHead className="text-xs text-right">{t("pagesTab.growth", "Рост")}</TableHead>
                  <TableHead className="text-xs w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pages.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell>
                      <div>
                        <p className="text-sm font-medium truncate max-w-[200px]">{p.title}</p>
                        <p className="text-[11px] text-muted-foreground">{p.url}</p>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.visits.toLocaleString()}</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{p.bounceRate}%</TableCell>
                    <TableCell className="text-sm text-right tabular-nums">{formatDuration(p.avgTime)}</TableCell>
                    <TableCell className="text-right">
                      <ChangeIndicator value={p.growth} />
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
                        <a href={p.url} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                        </a>
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* AI Insights - Pages context */}
      <AiInsightsBlock
        projectId={projectId}
        summary={aiSummary}
        isAdmin={true}
        trafficSources={[]}
      />
    </div>
  );
}
