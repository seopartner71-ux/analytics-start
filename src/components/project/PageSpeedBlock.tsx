import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Loader2, Smartphone, Monitor, Zap, ExternalLink, AlertTriangle, AlertCircle, Info, CheckCircle2, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

const PAGESPEED_API_KEY = "AIzaSyAMOvxAXLpg9HZLg_hisIevjRvannKU8Pc";

type Strategy = "mobile" | "desktop";

type AuditItem = {
  id: string;
  title: string;
  description: string; // markdown с рекомендациями от Lighthouse
  displayValue?: string;
  score: number | null;
  scoreDisplayMode: string;
  savingsMs?: number;
  savingsBytes?: number;
  severity: "critical" | "warning" | "info";
};

type PageSpeedMetrics = {
  score: number; // 0-100
  lcp?: { display: string; numeric?: number };
  tbt?: { display: string; numeric?: number };
  cls?: { display: string; numeric?: number };
  fcp?: { display: string; numeric?: number };
  speedIndex?: { display: string; numeric?: number };
  opportunities: AuditItem[]; // экономия времени
  diagnostics: AuditItem[]; // диагностика
  failed: AuditItem[]; // прочие проваленные
};

type Results = Partial<Record<Strategy, PageSpeedMetrics>>;

function pickAudit(audits: any, key: string) {
  const a = audits?.[key];
  if (!a) return undefined;
  return { display: a.displayValue ?? "—", numeric: a.numericValue };
}

function classifyAudit(a: any): "critical" | "warning" | "info" {
  if (a.score == null) return "info";
  if (a.score < 0.5) return "critical";
  if (a.score < 0.9) return "warning";
  return "info";
}

function extractAudits(lh: any): { opportunities: AuditItem[]; diagnostics: AuditItem[]; failed: AuditItem[] } {
  const audits = lh?.audits ?? {};
  const categoryRefs: any[] = lh?.categories?.performance?.auditRefs ?? [];

  const opportunities: AuditItem[] = [];
  const diagnostics: AuditItem[] = [];
  const failed: AuditItem[] = [];

  for (const ref of categoryRefs) {
    const a = audits[ref.id];
    if (!a) continue;
    // Пропускаем метрики (LCP/TBT/CLS и т.п.) — они показаны отдельно
    if (ref.group === "metrics" || a.scoreDisplayMode === "informative" && ref.group === "hidden") continue;
    if (a.scoreDisplayMode === "notApplicable" || a.scoreDisplayMode === "manual") continue;

    // Не показываем пройденные (score === 1)
    if (a.score === 1) continue;
    // Скрываем чисто-информативные без полезной нагрузки
    if (a.scoreDisplayMode === "informative" && !a.displayValue && !a.description) continue;

    const item: AuditItem = {
      id: ref.id,
      title: a.title,
      description: a.description ?? "",
      displayValue: a.displayValue,
      score: a.score,
      scoreDisplayMode: a.scoreDisplayMode,
      savingsMs: a.details?.overallSavingsMs,
      savingsBytes: a.details?.overallSavingsBytes,
      severity: classifyAudit(a),
    };

    if (ref.group === "load-opportunities") opportunities.push(item);
    else if (ref.group === "diagnostics") diagnostics.push(item);
    else failed.push(item);
  }

  // Сортируем по экономии / серьёзности
  const sevOrder = { critical: 0, warning: 1, info: 2 } as const;
  const cmp = (a: AuditItem, b: AuditItem) => {
    const s = sevOrder[a.severity] - sevOrder[b.severity];
    if (s !== 0) return s;
    return (b.savingsMs ?? 0) - (a.savingsMs ?? 0);
  };
  opportunities.sort((a, b) => (b.savingsMs ?? 0) - (a.savingsMs ?? 0));
  diagnostics.sort(cmp);
  failed.sort(cmp);

  return { opportunities, diagnostics, failed };
}

async function fetchPageSpeed(url: string, strategy: Strategy): Promise<PageSpeedMetrics> {
  const apiUrl = `https://www.googleapis.com/pagespeedonline/v5/runPagespeed?url=${encodeURIComponent(
    url,
  )}&key=${PAGESPEED_API_KEY}&strategy=${strategy}&category=performance&locale=ru`;
  const res = await fetch(apiUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const lh = data.lighthouseResult;
  const score = Math.round((lh?.categories?.performance?.score ?? 0) * 100);
  const audits = lh?.audits ?? {};
  const grouped = extractAudits(lh);
  return {
    score,
    lcp: pickAudit(audits, "largest-contentful-paint"),
    tbt: pickAudit(audits, "total-blocking-time"),
    cls: pickAudit(audits, "cumulative-layout-shift"),
    fcp: pickAudit(audits, "first-contentful-paint"),
    speedIndex: pickAudit(audits, "speed-index"),
    ...grouped,
  };
}

function scoreColor(score: number) {
  if (score >= 90) return { text: "text-emerald-400", stroke: "stroke-emerald-400" };
  if (score >= 50) return { text: "text-yellow-400", stroke: "stroke-yellow-400" };
  return { text: "text-red-400", stroke: "stroke-red-400" };
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

const SEV_META: Record<AuditItem["severity"], { label: string; ring: string; bg: string; text: string; Icon: any }> = {
  critical: { label: "Критично", ring: "border-red-500/30", bg: "bg-red-500/10", text: "text-red-400", Icon: AlertCircle },
  warning: { label: "Предупреждение", ring: "border-yellow-500/30", bg: "bg-yellow-500/10", text: "text-yellow-400", Icon: AlertTriangle },
  info: { label: "Инфо", ring: "border-blue-500/30", bg: "bg-blue-500/10", text: "text-blue-400", Icon: Info },
};

/** Обрезает markdown-сноски Lighthouse вида "[Подробнее](https://...)." */
function cleanDescription(md: string): { text: string; learnMore?: string } {
  if (!md) return { text: "" };
  const linkRe = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)\.?/;
  const m = md.match(linkRe);
  let learnMore: string | undefined;
  let text = md;
  if (m) {
    learnMore = m[2];
    text = md.replace(linkRe, "").trim();
  }
  // Убираем оставшиеся markdown-ссылки
  text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, "$1");
  return { text, learnMore };
}

function AuditRow({ item }: { item: AuditItem }) {
  const [open, setOpen] = useState(false);
  const meta = SEV_META[item.severity];
  const { text, learnMore } = cleanDescription(item.description);
  const Icon = meta.Icon;

  return (
    <div className={cn("rounded-lg border", meta.ring, meta.bg)}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-start gap-3 p-3 text-left"
      >
        <div className={cn("mt-0.5 shrink-0", meta.text)}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-sm font-medium text-foreground">{item.title}</div>
            {item.displayValue && (
              <span className={cn("text-[11px] px-1.5 py-0.5 rounded font-semibold tabular-nums", meta.text, "bg-background/40")}>
                {item.displayValue}
              </span>
            )}
            {item.savingsMs && item.savingsMs > 0 && (
              <span className="text-[11px] px-1.5 py-0.5 rounded bg-background/40 text-muted-foreground tabular-nums">
                экономия ~{Math.round(item.savingsMs)} мс
              </span>
            )}
          </div>
        </div>
        <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform", open && "rotate-180")} />
      </button>
      {open && text && (
        <div className="px-3 pb-3 pt-0 ml-7 text-[12.5px] text-muted-foreground leading-relaxed whitespace-pre-line">
          {text}
          {learnMore && (
            <>
              {" "}
              <a href={learnMore} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                Подробнее <ExternalLink className="h-3 w-3" />
              </a>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function AuditGroup({ title, subtitle, items }: { title: string; subtitle?: string; items: AuditItem[] }) {
  if (items.length === 0) return null;
  return (
    <div className="space-y-2">
      <div>
        <div className="text-sm font-semibold text-foreground">{title} · <span className="text-muted-foreground tabular-nums">{items.length}</span></div>
        {subtitle && <div className="text-[11px] text-muted-foreground">{subtitle}</div>}
      </div>
      <div className="space-y-2">
        {items.map((it) => (
          <AuditRow key={it.id} item={it} />
        ))}
      </div>
    </div>
  );
}

function ResultPanel({ data }: { data: PageSpeedMetrics }) {
  const opportunities = data.opportunities ?? [];
  const diagnostics = data.diagnostics ?? [];
  const failed = data.failed ?? [];
  const totalIssues = opportunities.length + diagnostics.length + failed.length;

  // Top-3 проблемы: сначала по экономии мс, затем по серьёзности
  const sevWeight = { critical: 3, warning: 2, info: 1 } as const;
  const top3 = [...opportunities, ...diagnostics, ...failed]
    .map((it) => ({ it, score: (it.savingsMs ?? 0) + sevWeight[it.severity] * 50 }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((x) => x.it);

  return (
    <div className="space-y-5">
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

      {totalIssues === 0 ? (
        <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-4 flex items-center gap-2 text-sm text-emerald-300">
          <CheckCircle2 className="h-4 w-4" />
          Проблем со скоростью не найдено — все аудиты Lighthouse пройдены.
        </div>
      ) : (
        <div className="space-y-5">
          {top3.length > 0 && (
            <div className="rounded-xl border border-yellow-500/30 bg-gradient-to-br from-yellow-500/10 via-orange-500/5 to-transparent p-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-7 w-7 rounded-lg bg-yellow-500/20 text-yellow-400 flex items-center justify-center">
                  <Zap className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-foreground">Топ-3 приоритета</div>
                  <div className="text-[11px] text-muted-foreground">Самые значимые проблемы по экономии времени и серьёзности</div>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                {top3.map((it, idx) => {
                  const meta = SEV_META[it.severity];
                  return (
                    <div key={it.id} className={cn("rounded-lg border p-3", meta.ring, meta.bg)}>
                      <div className="flex items-center gap-2 mb-1.5">
                        <span className={cn("h-5 w-5 rounded-full flex items-center justify-center text-[11px] font-bold", meta.text, "bg-background/40")}>
                          {idx + 1}
                        </span>
                        <span className={cn("text-[10px] uppercase tracking-wider font-semibold", meta.text)}>
                          {meta.label}
                        </span>
                      </div>
                      <div className="text-[13px] font-medium text-foreground leading-snug line-clamp-2">{it.title}</div>
                      {(it.savingsMs ?? 0) > 0 && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                          экономия ~{Math.round(it.savingsMs!)} мс
                        </div>
                      )}
                      {!it.savingsMs && it.displayValue && (
                        <div className="mt-1.5 text-[11px] text-muted-foreground">{it.displayValue}</div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <AuditGroup
            title="Возможности ускорения"
            subtitle="Что можно оптимизировать, чтобы сократить время загрузки"
            items={opportunities}
          />
          <AuditGroup
            title="Диагностика"
            subtitle="Сведения о работе страницы и потенциальных причинах замедления"
            items={diagnostics}
          />
          <AuditGroup
            title="Прочие найденные проблемы"
            items={failed}
          />
        </div>
      )}
    </div>
  );
}

const CACHE_PREFIX = "pagespeed_cache_v1:";

type CachedResults = { results: Results; checkedAt: string };

function loadCache(url: string): CachedResults | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedResults;
    if (!parsed?.results) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveCache(url: string, results: Results) {
  try {
    const payload: CachedResults = { results, checkedAt: new Date().toISOString() };
    localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(payload));
  } catch {
    // ignore quota errors
  }
}

function formatCheckedAt(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

export function PageSpeedBlock({ siteUrl }: { siteUrl?: string | null }) {
  const [loading, setLoading] = useState<"both" | null>(null);
  const [results, setResults] = useState<Results>({});
  const [checkedAt, setCheckedAt] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Strategy>("mobile");
  const [open, setOpen] = useState(false);

  const url = siteUrl?.trim();

  // Загружаем кэш при изменении URL
  useEffect(() => {
    if (!url) {
      setResults({});
      setCheckedAt(null);
      return;
    }
    const cached = loadCache(url);
    if (cached) {
      setResults(cached.results);
      setCheckedAt(cached.checkedAt);
    } else {
      setResults({});
      setCheckedAt(null);
    }
  }, [url]);

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
        const now = new Date().toISOString();
        setCheckedAt(now);
        saveCache(url, next);
        toast.success("Данные PageSpeed получены и сохранены");
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
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="flex items-start gap-3 text-left flex-1 min-w-0 group"
        >
          <div className="h-10 w-10 rounded-lg bg-yellow-500/15 text-yellow-400 flex items-center justify-center shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <div className="text-base font-semibold text-foreground">PageSpeed Insights</div>
              <ChevronDown className={cn("h-4 w-4 text-muted-foreground transition-transform", open && "rotate-180")} />
              {hasResults && (
                <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                  данные есть
                </span>
              )}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5 break-all">
              {url ? url : "URL сайта не указан в проекте"}
            </div>
            {checkedAt && hasResults && (
              <div className="text-[11px] text-muted-foreground mt-0.5">
                Последняя проверка: {formatCheckedAt(checkedAt)}
              </div>
            )}
          </div>
        </button>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-primary hover:underline self-start mt-3"
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
        <Button
          onClick={(e) => {
            e.stopPropagation();
            setOpen(true);
            handleCheck();
          }}
          disabled={!url || loading !== null}
          size="sm"
        >
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

      {open && (
        <>
          {error && !hasResults && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
              {error}
            </div>
          )}

          {!hasResults && !loading && !error && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Нажмите «Проверить скорость», чтобы запросить данные Google PageSpeed Insights для мобильной и десктопной версий. Будут показаны метрики, найденные проблемы и рекомендации Lighthouse.
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
        </>
      )}
    </Card>
  );
}
