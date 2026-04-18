import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Smartphone, Monitor, Zap, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGESPEED_API_KEY = "AIzaSyAMOvxAXLpg9HZLg_hisIevjRvannKU8Pc";

type Strategy = "mobile" | "desktop";

type PageSpeedMetrics = {
  score: number; // 0-100
  lcp?: { display: string; numeric?: number };
  tbt?: { display: string; numeric?: number };
  cls?: { display: string; numeric?: number };
  fcp?: { display: string; numeric?: number };
  speedIndex?: { display: string; numeric?: number };
};

type Results = Partial<Record<Strategy, PageSpeedMetrics>>;

function pickAudit(audits: any, key: string) {
  const a = audits?.[key];
  if (!a) return undefined;
  return { display: a.displayValue ?? "—", numeric: a.numericValue };
}

async function fetchPageSpeed(url: string, strategy: Strategy): Promise<PageSpeedMetrics> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url,
  )}&key=${PAGESPEED_API_KEY}&strategy=${strategy}&category=performance`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const lh = data.lighthouseResult;
  const score = Math.round((lh?.categories?.performance?.score ?? 0) * 100);
  const audits = lh?.audits ?? {};
  return {
    score,
    lcp: pickAudit(audits, "largest-contentful-paint"),
    tbt: pickAudit(audits, "total-blocking-time"),
    cls: pickAudit(audits, "cumulative-layout-shift"),
    fcp: pickAudit(audits, "first-contentful-paint"),
    speedIndex: pickAudit(audits, "speed-index"),
  };
}

function scoreColor(score: number) {
  if (score >= 90) return { text: "text-emerald-400", bg: "bg-emerald-500/15", ring: "ring-emerald-500/40", stroke: "stroke-emerald-400" };
  if (score >= 50) return { text: "text-yellow-400", bg: "bg-yellow-500/15", ring: "ring-yellow-500/40", stroke: "stroke-yellow-400" };
  return { text: "text-red-400", bg: "bg-red-500/15", ring: "ring-red-500/40", stroke: "stroke-red-400" };
}

function ScoreCircle({ score }: { score: number }) {
  const c = scoreColor(score);
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  return (
    <div className="relative h-32 w-32 shrink-0">
      <svg className="h-full w-full -rotate-90" viewBox="0 0 120 120">
        <circle cx="60" cy="60" r={radius} className="stroke-muted" strokeWidth="8" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          className={cn("transition-all", c.stroke)}
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <div className={cn("text-3xl font-bold tabular-nums", c.text)}>{score}</div>
        <div className="text-[10px] uppercase tracking-wider text-muted-foreground">из 100</div>
      </div>
    </div>
  );
}

function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className="mt-1 text-lg font-semibold text-foreground tabular-nums">{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground mt-0.5">{hint}</div>}
    </div>
  );
}

function ResultPanel({ data }: { data: PageSpeedMetrics }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5 rounded-xl border border-border bg-card p-4">
        <ScoreCircle score={data.score} />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground">Performance Score</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            Общая оценка скорости по данным Google PageSpeed Insights (Lighthouse). Цвет:
            <span className="text-emerald-400"> 90–100 хорошо</span>,
            <span className="text-yellow-400"> 50–89 средне</span>,
            <span className="text-red-400"> 0–49 плохо</span>.
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <MetricCard label="LCP" value={data.lcp?.display ?? "—"} hint="Largest Contentful Paint" />
        <MetricCard label="TBT" value={data.tbt?.display ?? "—"} hint="Total Blocking Time" />
        <MetricCard label="CLS" value={data.cls?.display ?? "—"} hint="Cumulative Layout Shift" />
        <MetricCard label="FCP" value={data.fcp?.display ?? "—"} hint="First Contentful Paint" />
        <MetricCard label="Speed Index" value={data.speedIndex?.display ?? "—"} hint="Скорость отображения" />
      </div>
    </div>
  );
}

export function PageSpeedBlock({ siteUrl }: { siteUrl?: string | null }) {
  const [loading, setLoading] = useState<Strategy | "both" | null>(null);
  const [results, setResults] = useState<Results>({});
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Strategy>("mobile");

  const url = siteUrl?.trim();

  const handleCheck = async () => {
    if (!url) {
      toast.error("Не указан URL сайта в проекте");
      return;
    }
    setLoading("both");
    setError(null);
    try {
      const [mobile, desktop] = await Promise.allSettled([
        fetchPageSpeed(url, "mobile"),
        fetchPageSpeed(url, "desktop"),
      ]);
      const next: Results = {};
      if (mobile.status === "fulfilled") next.mobile = mobile.value;
      if (desktop.status === "fulfilled") next.desktop = desktop.value;
      setResults(next);
      if (mobile.status === "rejected" && desktop.status === "rejected") {
        const msg = (mobile.reason as Error)?.message ?? "Ошибка PageSpeed API";
        setError(msg);
        toast.error("Не удалось получить данные PageSpeed");
      } else {
        toast.success("Данные PageSpeed получены");
      }
    } catch (e: any) {
      setError(e?.message ?? "Ошибка запроса");
      toast.error("Ошибка запроса PageSpeed");
    } finally {
      setLoading(null);
    }
  };

  const hasResults = !!(results.mobile || results.desktop);

  return (
    <Card className="p-5 space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="h-10 w-10 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-semibold text-foreground">PageSpeed Insights</div>
            <div className="text-xs text-muted-foreground mt-0.5 break-all">
              {url ? (
                <span className="inline-flex items-center gap-1">
                  {url}
                  <a href={url} target="_blank" rel="noreferrer" className="text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </span>
              ) : (
                "URL сайта не указан в проекте"
              )}
            </div>
          </div>
        </div>
        <Button onClick={handleCheck} disabled={!url || loading !== null} size="sm">
          {loading ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Проверяем…
            </>
          ) : hasResults ? (
            "Перепроверить"
          ) : (
            "Проверить скорость"
          )}
        </Button>
      </div>

      {error && !hasResults && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          {error}
        </div>
      )}

      {!hasResults && !loading && !error && (
        <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          Нажмите «Проверить скорость», чтобы запросить данные Google PageSpeed Insights для мобильной и десктопной версий.
        </div>
      )}

      {hasResults && (
        <Tabs value={tab} onValueChange={(v) => setTab(v as Strategy)}>
          <TabsList>
            <TabsTrigger value="mobile" className="gap-2">
              <Smartphone className="h-4 w-4" /> Мобильная
            </TabsTrigger>
            <TabsTrigger value="desktop" className="gap-2">
              <Monitor className="h-4 w-4" /> Десктоп
            </TabsTrigger>
          </TabsList>
          <TabsContent value="mobile" className="mt-4">
            {results.mobile ? (
              <ResultPanel data={results.mobile} />
            ) : (
              <div className="text-sm text-muted-foreground">Нет данных для мобильной версии.</div>
            )}
          </TabsContent>
          <TabsContent value="desktop" className="mt-4">
            {results.desktop ? (
              <ResultPanel data={results.desktop} />
            ) : (
              <div className="text-sm text-muted-foreground">Нет данных для десктопной версии.</div>
            )}
          </TabsContent>
        </Tabs>
      )}
    </Card>
  );
}
