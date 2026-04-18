import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Smartphone,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Eye,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const PAGESPEED_API_KEY = "AIzaSyAMOvxAXLpg9HZLg_hisIevjRvannKU8Pc";

// Ключевые аудиты Lighthouse, отвечающие за адаптивность и мобильную версию
const MOBILE_AUDIT_IDS = [
  "viewport",
  "content-width",
  "tap-targets",
  "font-size",
  "image-aspect-ratio",
  "image-size-responsive",
  "color-contrast",
] as const;

const AUDIT_LABEL: Record<string, { title: string; hint: string }> = {
  viewport: {
    title: "Meta viewport",
    hint: "Тег <meta name=\"viewport\"> позволяет странице корректно масштабироваться на мобильных устройствах.",
  },
  "content-width": {
    title: "Ширина контента",
    hint: "Содержимое страницы помещается по ширине экрана и не требует горизонтальной прокрутки.",
  },
  "tap-targets": {
    title: "Размер тап-целей",
    hint: "Кнопки и ссылки достаточно крупные и не расположены слишком близко друг к другу для удобного нажатия пальцем.",
  },
  "font-size": {
    title: "Читаемость шрифта",
    hint: "Размер шрифта на мобильном устройстве не меньше 12px — текст читается без увеличения.",
  },
  "image-aspect-ratio": {
    title: "Пропорции изображений",
    hint: "Изображения отображаются с корректным соотношением сторон и не искажаются.",
  },
  "image-size-responsive": {
    title: "Адаптивные изображения",
    hint: "Изображения подгружаются в подходящем разрешении под экран устройства.",
  },
  "color-contrast": {
    title: "Контрастность текста",
    hint: "Цвет текста имеет достаточный контраст с фоном для чтения на мобильном экране.",
  },
};

type MobileAudit = {
  id: string;
  title: string;
  hint: string;
  score: number | null;
  scoreDisplayMode: string;
  displayValue?: string;
  description?: string;
  status: "pass" | "warn" | "fail" | "na";
};

type MobileResult = {
  performanceScore: number; // 0-100, моб.
  accessibilityScore: number; // 0-100
  bestPracticesScore: number; // 0-100
  audits: MobileAudit[];
  finalUrl: string;
  fetchedAt: string;
};

const STATUS_META = {
  pass: { label: "OK", text: "text-emerald-400", bg: "bg-emerald-500/10", ring: "border-emerald-500/30", Icon: CheckCircle2 },
  warn: { label: "Внимание", text: "text-yellow-400", bg: "bg-yellow-500/10", ring: "border-yellow-500/30", Icon: AlertTriangle },
  fail: { label: "Проблема", text: "text-red-400", bg: "bg-red-500/10", ring: "border-red-500/30", Icon: AlertCircle },
  na: { label: "Н/Д", text: "text-muted-foreground", bg: "bg-muted/40", ring: "border-border", Icon: AlertCircle },
} as const;

function classify(score: number | null, mode: string): MobileAudit["status"] {
  if (mode === "notApplicable" || mode === "manual") return "na";
  if (score == null) return "na";
  if (score >= 0.9) return "pass";
  if (score >= 0.5) return "warn";
  return "fail";
}

function scoreColor(s: number) {
  if (s >= 90) return "text-emerald-400";
  if (s >= 50) return "text-yellow-400";
  return "text-red-400";
}

async function fetchMobileFriendly(url: string): Promise<MobileResult> {
  const apiUrl =
    `https://www.googleapis.com/pagespeedonline/v5/runPagespeed` +
    `?url=${encodeURIComponent(url)}` +
    `&key=${PAGESPEED_API_KEY}` +
    `&strategy=mobile` +
    `&category=performance&category=accessibility&category=best-practices` +
    `&locale=ru`;

  const res = await fetch(apiUrl);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`PageSpeed API ${res.status}: ${text.slice(0, 200)}`);
  }
  const data = await res.json();
  const lh = data.lighthouseResult;
  const audits = lh?.audits ?? {};
  const cats = lh?.categories ?? {};

  const collected: MobileAudit[] = MOBILE_AUDIT_IDS.map((id) => {
    const a = audits[id];
    const meta = AUDIT_LABEL[id];
    if (!a) {
      return {
        id,
        title: meta.title,
        hint: meta.hint,
        score: null,
        scoreDisplayMode: "notApplicable",
        status: "na",
      };
    }
    return {
      id,
      title: meta.title,
      hint: meta.hint,
      score: a.score ?? null,
      scoreDisplayMode: a.scoreDisplayMode ?? "binary",
      displayValue: a.displayValue,
      description: a.description,
      status: classify(a.score ?? null, a.scoreDisplayMode ?? "binary"),
    };
  });

  return {
    performanceScore: Math.round((cats.performance?.score ?? 0) * 100),
    accessibilityScore: Math.round((cats.accessibility?.score ?? 0) * 100),
    bestPracticesScore: Math.round((cats["best-practices"]?.score ?? 0) * 100),
    audits: collected,
    finalUrl: lh?.finalUrl ?? url,
    fetchedAt: new Date().toISOString(),
  };
}

const CACHE_PREFIX = "mobile_friendly_v1:";

function loadCache(url: string): MobileResult | null {
  try {
    const raw = localStorage.getItem(CACHE_PREFIX + url);
    if (!raw) return null;
    return JSON.parse(raw) as MobileResult;
  } catch {
    return null;
  }
}
function saveCache(url: string, r: MobileResult) {
  try {
    localStorage.setItem(CACHE_PREFIX + url, JSON.stringify(r));
  } catch {
    /* ignore */
  }
}

function formatDate(iso: string) {
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

const VIEWPORTS: { id: string; label: string; w: number; h: number; icon: string }[] = [
  { id: "mobile", label: "iPhone 14", w: 390, h: 700, icon: "📱" },
  { id: "tablet", label: "iPad", w: 768, h: 700, icon: "📲" },
  { id: "desktop", label: "Desktop", w: 1280, h: 700, icon: "🖥️" },
];

function ScoreTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border bg-card p-3">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
      <div className={cn("mt-1 text-2xl font-bold tabular-nums", scoreColor(value))}>{value}</div>
      <div className="text-[10px] text-muted-foreground">из 100</div>
    </div>
  );
}

type Props = { projectId: string };

export function MobileFriendlyTab({ projectId }: Props) {
  const [siteUrl, setSiteUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<MobileResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewVp, setPreviewVp] = useState<string>("mobile");
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Получаем URL сайта проекта
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("url")
        .eq("id", projectId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        setError(error.message);
        return;
      }
      const url = (data?.url ?? "").trim() || null;
      setSiteUrl(url);
      if (url) {
        const cached = loadCache(url);
        if (cached) setResult(cached);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId]);

  const handleCheck = async () => {
    if (!siteUrl) {
      toast.error("Не указан URL сайта в проекте");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await fetchMobileFriendly(siteUrl);
      setResult(r);
      saveCache(siteUrl, r);
      toast.success("Проверка адаптивности завершена");
    } catch (e: any) {
      setError(e?.message ?? String(e));
      toast.error("Не удалось выполнить проверку");
    } finally {
      setLoading(false);
    }
  };

  const currentVp = VIEWPORTS.find((v) => v.id === previewVp)!;

  const failCount = result?.audits.filter((a) => a.status === "fail").length ?? 0;
  const warnCount = result?.audits.filter((a) => a.status === "warn").length ?? 0;
  const passCount = result?.audits.filter((a) => a.status === "pass").length ?? 0;

  return (
    <div className="space-y-5">
      {/* Шапка */}
      <Card className="p-4 bg-card border-border">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Smartphone className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-foreground">Адаптивность сайта</h3>
              <p className="text-[12px] text-muted-foreground mt-0.5">
                Проверка mobile-friendly критериев Google и предпросмотр на разных устройствах
              </p>
              {result?.fetchedAt && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  Последняя проверка: <span className="text-foreground">{formatDate(result.fetchedAt)}</span>
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {siteUrl && (
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 text-[12px] text-muted-foreground hover:text-foreground"
              >
                {siteUrl} <ExternalLink className="h-3 w-3" />
              </a>
            )}
            <Button onClick={handleCheck} disabled={!siteUrl || loading} size="sm" className="gap-1.5">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
              {result ? "Обновить" : "Проверить адаптивность"}
            </Button>
          </div>
        </div>
      </Card>

      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
          <div>
            <div className="font-medium">Ошибка при проверке</div>
            <div className="text-[12px] opacity-80 mt-0.5">{error}</div>
          </div>
        </div>
      )}

      {!result && !loading && !error && (
        <Card className="p-6 bg-card border-border text-center">
          <Smartphone className="h-10 w-10 text-muted-foreground/40 mx-auto mb-2" />
          <div className="text-sm text-foreground font-medium">Данные ещё не получены</div>
          <div className="text-[12px] text-muted-foreground mt-1">
            Нажмите «Проверить адаптивность», чтобы получить mobile-friendly отчёт от Google.
          </div>
        </Card>
      )}

      {result && (
        <>
          {/* Сводные баллы + статистика чеков */}
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
            <ScoreTile label="Mobile Performance" value={result.performanceScore} />
            <ScoreTile label="Accessibility" value={result.accessibilityScore} />
            <ScoreTile label="Best Practices" value={result.bestPracticesScore} />
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-emerald-300/80">Пройдено</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-emerald-400">{passCount}</div>
            </div>
            <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-yellow-300/80">Внимание</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-yellow-400">{warnCount}</div>
            </div>
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3">
              <div className="text-[10px] uppercase tracking-wider text-red-300/80">Проблем</div>
              <div className="mt-1 text-2xl font-bold tabular-nums text-red-400">{failCount}</div>
            </div>
          </div>

          {/* Чеки адаптивности */}
          <Card className="p-4 bg-card border-border">
            <div className="flex items-center gap-2 mb-3">
              <Smartphone className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Mobile-friendly проверки</h4>
              <Badge variant="outline" className="text-[10px] ml-auto">Google Lighthouse</Badge>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.audits.map((a) => {
                const meta = STATUS_META[a.status];
                const Icon = meta.Icon;
                return (
                  <div key={a.id} className={cn("rounded-lg border p-3 flex items-start gap-3", meta.ring, meta.bg)}>
                    <div className={cn("mt-0.5 shrink-0", meta.text)}>
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="text-sm font-medium text-foreground">{a.title}</div>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider", meta.text, "bg-background/40")}>
                          {meta.label}
                        </span>
                        {a.displayValue && (
                          <span className="text-[10px] text-muted-foreground tabular-nums">{a.displayValue}</span>
                        )}
                      </div>
                      <div className="text-[12px] text-muted-foreground mt-1 leading-snug">{a.hint}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        </>
      )}

      {/* Предпросмотр на устройствах */}
      {siteUrl && (
        <Card className="p-4 bg-card border-border">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <div className="flex items-center gap-2">
              <Eye className="h-4 w-4 text-primary" />
              <h4 className="text-sm font-semibold text-foreground">Предпросмотр на устройствах</h4>
            </div>
            <div className="flex items-center gap-1 bg-muted/40 rounded-lg p-1">
              {VIEWPORTS.map((v) => (
                <button
                  key={v.id}
                  onClick={() => {
                    setPreviewVp(v.id);
                    setIframeBlocked(false);
                  }}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-[12px] font-medium transition-colors",
                    previewVp === v.id
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span className="mr-1">{v.icon}</span>
                  {v.label}
                  <span className="ml-1.5 text-[10px] text-muted-foreground tabular-nums">{v.w}px</span>
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-center">
            <div
              className="relative rounded-2xl border-4 border-foreground/10 bg-background shadow-xl overflow-hidden transition-all"
              style={{ width: currentVp.w, maxWidth: "100%", height: currentVp.h }}
            >
              {iframeBlocked ? (
                <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 bg-muted/30">
                  <AlertTriangle className="h-8 w-8 text-yellow-400 mb-2" />
                  <div className="text-sm font-medium text-foreground">
                    Сайт запретил предпросмотр в iframe
                  </div>
                  <div className="text-[12px] text-muted-foreground mt-1 max-w-xs">
                    Это типичная защита через X-Frame-Options. Откройте сайт в новой вкладке для проверки вручную.
                  </div>
                  <a
                    href={siteUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex items-center gap-1 text-[12px] text-primary hover:underline"
                  >
                    Открыть сайт <ExternalLink className="h-3 w-3" />
                  </a>
                </div>
              ) : (
                <iframe
                  key={`${siteUrl}-${previewVp}`}
                  src={siteUrl}
                  title={`preview-${previewVp}`}
                  className="w-full h-full border-0 bg-white"
                  onError={() => setIframeBlocked(true)}
                  onLoad={(e) => {
                    // если iframe заблокирован, тело будет недоступно — это не вызывает onError,
                    // но пользователь увидит пустой блок. Кнопка "открыть в новой вкладке" всегда доступна.
                  }}
                />
              )}
            </div>
          </div>

          <div className="text-[11px] text-muted-foreground text-center mt-3">
            Некоторые сайты блокируют отображение в iframe (X-Frame-Options / CSP). В таком случае используйте оценку Mobile-friendly выше.
          </div>
        </Card>
      )}
    </div>
  );
}

export default MobileFriendlyTab;
