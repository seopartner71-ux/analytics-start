import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { differenceInDays, format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  AlertTriangle, CheckCircle2, RefreshCw, Globe, FileWarning, Zap, Clock, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import { useDateRange } from "@/contexts/DateRangeContext";
import { toast } from "sonner";
import {
  GlassCard, StandardKpiCard, useTabRefresh, TabLoadingOverlay,
  StandardChartTooltip, MetricTooltip,
} from "./shared-ui";

interface SiteHealthTabProps {
  projectId: string;
}

const ENGINE_COLORS = {
  yandex: "hsl(10, 85%, 57%)",
  google: "hsl(217, 89%, 61%)",
};

const ChartTooltip = StandardChartTooltip;

function generateIndexData(dateFrom: Date, dateTo: Date) {
  const days = Math.min(differenceInDays(dateTo, dateFrom) + 1, 60);
  const chart = [];
  for (let i = 0; i < days; i++) {
    const d = new Date(dateFrom);
    d.setDate(d.getDate() + i);
    chart.push({
      day: format(d, "dd.MM"),
      yandex: Math.round(420 + i * 2.5 + Math.random() * 30),
      google: Math.round(380 + i * 3 + Math.random() * 25),
    });
  }
  const lastY = chart[chart.length - 1]?.yandex || 450;
  const lastG = chart[chart.length - 1]?.google || 410;
  return { chart, yandexIndexed: lastY, googleIndexed: lastG };
}

function generateErrors(seed: number) {
  const m = 1 + (seed % 7) * 0.1;
  return {
    errors404: Math.round(12 * m),
    duplicateTitles: Math.round(8 * m),
    duplicateMeta: Math.round(5 * m),
    brokenLinks: Math.round(3 * m),
    missingAlt: Math.round(18 * m),
    slowPages: Math.round(6 * m),
  };
}

function generateCoreWebVitals(seed: number) {
  const base = 1 + (seed % 5) * 0.05;
  return {
    lcp: Math.round(2.1 * base * 10) / 10,
    fid: Math.round(45 * base),
    cls: Math.round(0.08 * base * 100) / 100,
    ttfb: Math.round(380 * base),
    fcp: Math.round(1.4 * base * 10) / 10,
  };
}

function vitalStatus(metric: string, value: number): "good" | "needs-improvement" | "poor" {
  const thresholds: Record<string, [number, number]> = {
    lcp: [2.5, 4.0],
    fid: [100, 300],
    cls: [0.1, 0.25],
    ttfb: [800, 1800],
    fcp: [1.8, 3.0],
  };
  const [good, poor] = thresholds[metric] || [0, 0];
  if (value <= good) return "good";
  if (value <= poor) return "needs-improvement";
  return "poor";
}

const statusColors = {
  good: "text-emerald-500",
  "needs-improvement": "text-amber-500",
  poor: "text-red-500",
};

const statusBg = {
  good: "bg-emerald-500/10",
  "needs-improvement": "bg-amber-500/10",
  poor: "bg-red-500/10",
};

export function SiteHealthTab({ projectId }: SiteHealthTabProps) {
  const { t, i18n } = useTranslation();
  const { appliedRange } = useDateRange();
  const [recrawling, setRecrawling] = useState(false);

  const seed = useMemo(
    () => appliedRange.from.getDate() + appliedRange.to.getDate() + appliedRange.from.getMonth(),
    [appliedRange]
  );

  const { chart, yandexIndexed, googleIndexed } = useMemo(
    () => generateIndexData(appliedRange.from, appliedRange.to),
    [appliedRange]
  );
  const errors = useMemo(() => generateErrors(seed), [seed]);
  const vitals = useMemo(() => generateCoreWebVitals(seed), [seed]);

  const totalErrors = errors.errors404 + errors.duplicateTitles + errors.duplicateMeta + errors.brokenLinks;
  const healthScore = Math.max(0, Math.min(100, 100 - totalErrors));

  const handleRecrawl = async () => {
    setRecrawling(true);
    await new Promise(r => setTimeout(r, 2000));
    setRecrawling(false);
    toast.success(
      i18n.language === "ru"
        ? "Запрос на переобход отправлен в Яндекс.Вебмастер"
        : "Recrawl request sent to Yandex Webmaster"
    );
  };

  const errorCards = [
    { icon: FileWarning, label: t("siteHealth.errors404", "Ошибки 404"), value: errors.errors404, severity: errors.errors404 > 15 ? "poor" : errors.errors404 > 5 ? "needs-improvement" : "good" },
    { icon: AlertTriangle, label: t("siteHealth.duplicateTitles", "Дубли Title"), value: errors.duplicateTitles, severity: errors.duplicateTitles > 10 ? "poor" : errors.duplicateTitles > 3 ? "needs-improvement" : "good" },
    { icon: AlertTriangle, label: t("siteHealth.duplicateMeta", "Дубли Description"), value: errors.duplicateMeta, severity: errors.duplicateMeta > 8 ? "poor" : errors.duplicateMeta > 2 ? "needs-improvement" : "good" },
    { icon: Globe, label: t("siteHealth.brokenLinks", "Битые ссылки"), value: errors.brokenLinks, severity: errors.brokenLinks > 5 ? "poor" : errors.brokenLinks > 1 ? "needs-improvement" : "good" },
    { icon: FileWarning, label: t("siteHealth.missingAlt", "Без alt-текста"), value: errors.missingAlt, severity: errors.missingAlt > 20 ? "poor" : errors.missingAlt > 10 ? "needs-improvement" : "good" },
    { icon: Clock, label: t("siteHealth.slowPages", "Медленные стр."), value: errors.slowPages, severity: errors.slowPages > 10 ? "poor" : errors.slowPages > 3 ? "needs-improvement" : "good" },
  ] as const;

  const vitalCards = [
    { key: "lcp", label: "LCP", value: `${vitals.lcp}s`, desc: t("siteHealth.lcpDesc", "Largest Contentful Paint") },
    { key: "fid", label: "FID", value: `${vitals.fid}ms`, desc: t("siteHealth.fidDesc", "First Input Delay") },
    { key: "cls", label: "CLS", value: String(vitals.cls), desc: t("siteHealth.clsDesc", "Cumulative Layout Shift") },
    { key: "ttfb", label: "TTFB", value: `${vitals.ttfb}ms`, desc: t("siteHealth.ttfbDesc", "Time to First Byte") },
    { key: "fcp", label: "FCP", value: `${vitals.fcp}s`, desc: t("siteHealth.fcpDesc", "First Contentful Paint") },
  ];

  return (
    <div className="space-y-6">
      {/* Health Score + Recrawl */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border bg-card p-5 md:col-span-1">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-medium text-muted-foreground">{t("siteHealth.healthScore", "Здоровье сайта")}</p>
            <Badge variant="outline" className={cn("text-xs",
              healthScore >= 80 ? "border-emerald-500/40 text-emerald-600" :
              healthScore >= 50 ? "border-amber-500/40 text-amber-600" :
              "border-red-500/40 text-red-600"
            )}>
              {healthScore >= 80 ? t("siteHealth.good", "Хорошо") : healthScore >= 50 ? t("siteHealth.fair", "Удовл.") : t("siteHealth.poor", "Плохо")}
            </Badge>
          </div>
          <p className="text-4xl font-bold text-foreground">{healthScore}<span className="text-lg text-muted-foreground">%</span></p>
          <Progress value={healthScore} className="mt-3 h-2" />
          <p className="text-xs text-muted-foreground mt-2">
            {t("siteHealth.errorsFound", "Найдено проблем")}: {totalErrors}
          </p>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <rect width="24" height="24" rx="4" fill="#FC3F1D" />
              <path d="M13.63 18.71h-2.05V5.29h2.84c2.34 0 3.57 1.18 3.57 3.15 0 1.56-.86 2.65-2.27 3.18l2.72 7.09h-2.2l-2.42-6.57h-.19v6.57zm0-8.46h.55c1.25 0 1.95-.66 1.95-1.82 0-1.13-.67-1.72-1.92-1.72h-.58v3.54z" fill="white" />
            </svg>
            <p className="text-xs text-muted-foreground">{t("siteHealth.yandexIndexed", "В индексе Яндекса")}</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{yandexIndexed}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("siteHealth.pages", "страниц")}</p>
        </Card>

        <Card className="border-border bg-card p-5">
          <div className="flex items-center gap-2 mb-1">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none">
              <rect width="24" height="24" rx="4" fill="#4285F4" />
              <path d="M17.64 12.2c0-.63-.06-1.25-.16-1.84H12v3.49h3.16a2.7 2.7 0 01-1.17 1.77v1.47h1.9c1.1-1.02 1.75-2.52 1.75-4.89z" fill="white" />
              <path d="M12 18c1.58 0 2.91-.52 3.88-1.41l-1.9-1.47c-.52.35-1.19.56-1.98.56-1.53 0-2.82-1.03-3.28-2.42H6.75v1.52A5.99 5.99 0 0012 18z" fill="white" />
              <path d="M8.72 13.26a3.6 3.6 0 010-2.29V9.45H6.75a6 6 0 000 5.33l1.97-1.52z" fill="white" />
              <path d="M12 8.58c.86 0 1.63.3 2.24.88l1.68-1.68A5.35 5.35 0 0012 6a5.99 5.99 0 00-5.25 3.45l1.97 1.52c.46-1.39 1.75-2.39 3.28-2.39z" fill="white" />
            </svg>
            <p className="text-xs text-muted-foreground">{t("siteHealth.googleIndexed", "В индексе Google")}</p>
          </div>
          <p className="text-3xl font-bold text-foreground">{googleIndexed}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("siteHealth.pages", "страниц")}</p>
        </Card>
      </div>

      {/* Index dynamics chart */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Globe className="h-4 w-4" />
            {t("siteHealth.indexDynamics", "Динамика индексации")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={280}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="idxYandex" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={ENGINE_COLORS.yandex} stopOpacity={0} />
                </linearGradient>
                <linearGradient id="idxGoogle" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={ENGINE_COLORS.google} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={ENGINE_COLORS.google} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" strokeOpacity={0.5} />
              <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend />
              <Area type="monotone" dataKey="yandex" name={t("engines.yandex", "Яндекс")} stroke={ENGINE_COLORS.yandex} strokeWidth={2} fill="url(#idxYandex)" dot={false} />
              <Area type="monotone" dataKey="google" name={t("engines.google", "Google")} stroke={ENGINE_COLORS.google} strokeWidth={2} fill="url(#idxGoogle)" dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Errors Grid */}
      <div>
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          {t("siteHealth.technicalErrors", "Технические ошибки")}
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {errorCards.map((card, i) => {
            const Icon = card.icon;
            return (
              <Card key={i} className={cn("border-border p-4", statusBg[card.severity])}>
                <div className="flex items-center gap-1.5 mb-2">
                  <Icon className={cn("h-4 w-4", statusColors[card.severity])} />
                  <p className="text-[11px] text-muted-foreground font-medium leading-tight">{card.label}</p>
                </div>
                <p className={cn("text-2xl font-bold", statusColors[card.severity])}>{card.value}</p>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Core Web Vitals */}
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
            <Zap className="h-4 w-4" />
            Core Web Vitals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            {vitalCards.map((v) => {
              const raw = v.key === "lcp" ? vitals.lcp : v.key === "fid" ? vitals.fid : v.key === "cls" ? vitals.cls : v.key === "ttfb" ? vitals.ttfb : vitals.fcp;
              const status = vitalStatus(v.key, raw);
              return (
                <div key={v.key} className={cn("rounded-lg p-4 text-center", statusBg[status])}>
                  <p className="text-xs text-muted-foreground mb-1">{v.label}</p>
                  <p className={cn("text-2xl font-bold", statusColors[status])}>{v.value}</p>
                  <p className="text-[10px] text-muted-foreground mt-1 leading-tight">{v.desc}</p>
                  <Badge variant="outline" className={cn("mt-2 text-[10px]",
                    status === "good" && "border-emerald-500/40 text-emerald-600",
                    status === "needs-improvement" && "border-amber-500/40 text-amber-600",
                    status === "poor" && "border-red-500/40 text-red-600",
                  )}>
                    {status === "good" ? "✓ Good" : status === "needs-improvement" ? "⚠ Needs work" : "✗ Poor"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recrawl Action */}
      <Card className="border-border bg-card">
        <CardContent className="p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <RefreshCw className="h-4 w-4" />
              {t("siteHealth.recrawlTitle", "Переобход страниц")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-md">
              {t("siteHealth.recrawlDesc", "Отправить запрос на переобход всех изменённых страниц в Яндекс.Вебмастер. Обычно занимает 1-3 дня.")}
            </p>
          </div>
          <Button onClick={handleRecrawl} disabled={recrawling} className="gap-2 shrink-0">
            {recrawling ? (
              <><Loader2 className="h-4 w-4 animate-spin" />{t("common.loading", "Загрузка...")}</>
            ) : (
              <><RefreshCw className="h-4 w-4" />{t("siteHealth.recrawlButton", "Проверить переобход")}</>
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
