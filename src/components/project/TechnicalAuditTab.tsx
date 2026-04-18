import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Download, ExternalLink } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Props { projectId: string; }

// Маппинг кодов из Python-краулера → человеко-читаемые названия
const TECH_CODE_LABELS: Record<string, string> = {
  no_https: "Нет HTTPS",
  redirect_chain: "Длинная цепочка редиректов",
  no_http_to_https_redirect: "HTTP не редиректит на HTTPS",
  no_robots_txt: "Нет robots.txt",
  robots_blocks_all: "robots.txt блокирует весь сайт",
  no_sitemap: "Нет sitemap.xml",
  missing_canonical: "Отсутствует canonical",
  canonical_mismatch: "Canonical не совпадает с URL",
  slow_ttfb: "Медленный ответ сервера",
  no_gzip: "Нет сжатия gzip",
  noindex_meta: "Страница закрыта от индексации",
  status_404: "Страницы с ошибкой 404",
  status_500: "Страницы с ошибкой 500",
  crawl_error: "Ошибка при сканировании",
};

const SEV_CLS: Record<string, string> = {
  critical: "bg-red-500/20 text-red-400 border-red-500/30",
  warning: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  info: "bg-blue-500/20 text-blue-400 border-blue-500/30",
};

const SEV_LABEL: Record<string, string> = {
  critical: "Критическая",
  warning: "Предупреждение",
  info: "Информация",
};

const SEV_ORDER: Record<string, number> = { critical: 0, warning: 1, info: 2 };

function getDomain(url?: string | null): string {
  if (!url) return "—";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; }
  catch { return url.replace(/^https?:\/\//, "").split("/")[0] || "—"; }
}

function extractUrl(issue: any): string | null {
  const fromPage = issue?.crawl_pages?.url;
  if (fromPage) return fromPage;
  const d = issue?.details;
  if (d && typeof d === "object") {
    if (typeof d.url === "string" && d.url) return d.url;
    if (typeof d.page_url === "string" && d.page_url) return d.page_url;
  }
  const msg: string | undefined = issue?.message;
  if (msg) {
    const m = msg.match(/(https?:\/\/\S+)/);
    if (m) return m[1];
  }
  return null;
}

function TechnicalIssuesList({
  issues,
  baseUrl,
  statsFallback,
}: {
  issues: any[];
  baseUrl?: string | null;
  statsFallback?: { critical_count: number; warning_count: number; info_count: number; total_issues: number } | null;
}) {
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const technical = (issues ?? []).filter((i) => i.type === "technical");

  if (technical.length === 0) {
    const s = statsFallback;
    if (s && s.total_issues > 0) {
      return (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2">
          <div className="text-[12px] text-yellow-300 font-medium">
            Краулер нашёл {s.total_issues} проблем, но детализация ещё не передана
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-md bg-[#1e1e1e] p-2">
              <div className="text-[10px] text-zinc-500 uppercase">Критических</div>
              <div className="text-[16px] font-bold text-red-400">{s.critical_count}</div>
            </div>
            <div className="rounded-md bg-[#1e1e1e] p-2">
              <div className="text-[10px] text-zinc-500 uppercase">Предупреждений</div>
              <div className="text-[16px] font-bold text-yellow-400">{s.warning_count}</div>
            </div>
            <div className="rounded-md bg-[#1e1e1e] p-2">
              <div className="text-[10px] text-zinc-500 uppercase">Информационных</div>
              <div className="text-[16px] font-bold text-blue-400">{s.info_count}</div>
            </div>
          </div>
          <div className="text-[11px] text-zinc-500 leading-relaxed">
            Список конкретных проверок появится после обновления Python-краулера — нужно, чтобы он отправлял каждую проблему через <code className="px-1 rounded bg-[#1e1e1e] text-zinc-300">action: "add_issues"</code> с полем <code className="px-1 rounded bg-[#1e1e1e] text-zinc-300">details.url</code>.
          </div>
        </div>
      );
    }
    return (
      <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4 text-[13px] text-emerald-300">
        ✅ Технических ошибок не обнаружено
      </div>
    );
  }

  const origin = (() => {
    try { return baseUrl ? new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`).origin : null; }
    catch { return null; }
  })();

  // Группируем по code
  const map = new Map<string, { code: string; severity: string; urls: Set<string>; total: number }>();
  for (const i of technical) {
    const code = i.code || "unknown";
    let g = map.get(code);
    if (!g) {
      g = { code, severity: i.severity || "info", urls: new Set(), total: 0 };
      map.set(code, g);
    }
    g.total += 1;
    let url = extractUrl(i);
    if (url) {
      if (url.startsWith("/") && origin) url = origin + url;
      g.urls.add(url);
    }
    if ((SEV_ORDER[i.severity] ?? 9) < (SEV_ORDER[g.severity] ?? 9)) g.severity = i.severity;
  }

  const groups = Array.from(map.values()).sort((a, b) => {
    const s = (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
    if (s !== 0) return s;
    return b.total - a.total;
  });

  return (
    <div className="rounded-lg border border-[#333] bg-[#1e1e1e] divide-y divide-[#2a2a2a] overflow-hidden">
      {groups.map((g) => {
        const isOpen = !!expanded[g.code];
        const label = TECH_CODE_LABELS[g.code] ?? g.code;
        const urlList = Array.from(g.urls);
        const pageCount = urlList.length || g.total;
        const pageWord = pageCount === 1 ? "страница" : pageCount > 1 && pageCount < 5 ? "страницы" : "страниц";
        return (
          <div key={g.code}>
            <button
              type="button"
              onClick={() => setExpanded((p) => ({ ...p, [g.code]: !p[g.code] }))}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#252525] transition-colors text-left"
            >
              {isOpen ? <ChevronDown className="h-4 w-4 text-zinc-500 shrink-0" /> : <ChevronRight className="h-4 w-4 text-zinc-500 shrink-0" />}
              <span className="flex-1 text-[13px] text-zinc-200 truncate">{label}</span>
              <Badge className="bg-zinc-700 text-zinc-300 text-[11px] shrink-0">
                {pageCount} {pageWord}
              </Badge>
              <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0", SEV_CLS[g.severity] ?? SEV_CLS.info)}>
                {SEV_LABEL[g.severity] ?? g.severity}
              </span>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 pl-11 space-y-1 bg-[#181818]">
                {urlList.length === 0 ? (
                  <div className="text-[11px] text-zinc-500 py-2">URL не переданы краулером</div>
                ) : (
                  urlList.slice(0, 100).map((u, i) => (
                    <a
                      key={i}
                      href={u}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[12px] text-blue-400 hover:text-blue-300 hover:underline font-mono py-0.5"
                    >
                      <ExternalLink className="h-3 w-3 shrink-0" />
                      <span className="truncate">{u}</span>
                    </a>
                  ))
                )}
                {urlList.length > 100 && (
                  <div className="text-[11px] text-zinc-500 pt-1">…и ещё {urlList.length - 100} URL</div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function TechnicalAuditTab({ projectId }: Props) {
  const [scanStatus, setScanStatus] = useState<"idle" | "pending" | "running" | "done" | "error">("idle");
  const [scanProgress, setScanProgress] = useState(0);
  const [jobId, setJobId] = useState<string | null>(null);
  const [stats, setStats] = useState<any>(null);
  const [showSfPanel, setShowSfPanel] = useState(false);
  const channelRef = useRef<any>(null);

  const { data: project } = useQuery({
    queryKey: ["project-detail-audit", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("*").eq("id", projectId).single();
      return data;
    },
  });

  const { data: specialist } = useQuery({
    queryKey: ["specialist-audit", project?.seo_specialist_id],
    enabled: !!project?.seo_specialist_id,
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("full_name").eq("id", project!.seo_specialist_id!).single();
      return data;
    },
  });

  const domain = getDomain(project?.url);

  // Восстановить последний job для проекта
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("crawl_jobs")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (data) {
        setJobId(data.id);
        setScanStatus(data.status as any);
        setScanProgress(data.progress ?? 0);
        if (data.status !== "idle") setShowSfPanel(true);
      }
    })();
  }, [projectId]);

  const { data: jobStats } = useQuery({
    queryKey: ["crawl-stats", jobId],
    enabled: !!jobId && scanStatus === "done",
    queryFn: async () => {
      const { data } = await supabase.from("crawl_stats").select("*").eq("job_id", jobId!).maybeSingle();
      return data;
    },
  });

  const { data: jobIssues = [] } = useQuery({
    queryKey: ["crawl-issues", jobId],
    enabled: !!jobId && scanStatus === "done",
    queryFn: async () => {
      const { data } = await supabase
        .from("crawl_issues")
        .select("id, type, severity, code, message, page_id, details, crawl_pages(url)")
        .eq("job_id", jobId!);
      return (data ?? []) as any[];
    },
  });

  const effectiveStats: any = stats ?? jobStats;

  const handleStartScan = async () => {
    setShowSfPanel(true);
    setScanProgress(0);
    setStats(null);
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) { toast.error("Войдите в систему"); return; }
    const targetUrl = project?.url || (domain !== "—" ? `https://${domain}` : "");
    if (!targetUrl) { toast.error("У проекта не указан URL"); return; }

    const { data: job, error } = await supabase
      .from("crawl_jobs")
      .insert({ project_id: projectId, user_id: userData.user.id, url: targetUrl, status: "pending", progress: 0 })
      .select()
      .single();
    if (error || !job) { toast.error("Не удалось создать задание: " + (error?.message ?? "")); return; }
    setJobId(job.id);
    setScanStatus("pending");
    toast.success("Задание создано — ожидает запуска краулера");
  };

  // Realtime подписка на job/stats
  useEffect(() => {
    if (!jobId) return;
    const ch = supabase
      .channel(`crawl-job-${jobId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crawl_jobs", filter: `id=eq.${jobId}` }, (payload: any) => {
        const row = payload.new;
        setScanStatus(row.status);
        setScanProgress(row.progress ?? 0);
        if (row.status === "done") toast.success("Аудит завершён");
        if (row.status === "error") toast.error("Ошибка аудита: " + (row.error_message ?? ""));
      })
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "crawl_stats", filter: `job_id=eq.${jobId}` }, (payload: any) => {
        setStats(payload.new);
      })
      .subscribe();
    channelRef.current = ch;
    return () => { supabase.removeChannel(ch); };
  }, [jobId]);

  return (
    <div className="space-y-5">
      {/* Шапка */}
      <Card className="bg-[#252525] border-[#333] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-bold text-zinc-100">Технический аудит</h2>
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-zinc-400">
              <span>Сайт: <span className="text-zinc-200 font-medium">{domain}</span></span>
              <span>Дата аудита: <span className="text-zinc-200">{format(new Date(), "dd.MM.yyyy")}</span></span>
              <span>Подготовил: <span className="text-zinc-200">{specialist?.full_name || project?.seo_specialist || "—"}</span></span>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            {scanStatus === "idle" && <Badge className="bg-zinc-700 text-zinc-400">Ожидает запуска</Badge>}
            {scanStatus === "pending" && <Badge className="bg-blue-500/20 text-blue-400">В очереди</Badge>}
            {scanStatus === "running" && <Badge className="bg-yellow-500/20 text-yellow-400 animate-pulse">Сканирование...</Badge>}
            {scanStatus === "done" && <Badge className="bg-emerald-500/20 text-emerald-400">Готов</Badge>}
            {scanStatus === "error" && <Badge className="bg-red-500/20 text-red-400">Ошибка</Badge>}
            <Button variant="outline" size="sm" className="gap-1.5 text-[12px] border-[#444] text-zinc-300 hover:bg-[#333]">
              <Download className="h-3.5 w-3.5" /> Скачать PDF отчёт
            </Button>
            <Button size="sm" className="gap-1.5 text-[12px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0" onClick={handleStartScan}>
              🔍 Запустить аудит
            </Button>
          </div>
        </div>
      </Card>

      {/* Панель прогресса */}
      {showSfPanel && (
        <Card className="bg-[#252525] border-[#333] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-zinc-200">🤖 Python краулер — Сканирование</span>
            <Button variant="ghost" size="sm" className="text-zinc-500 text-[11px]" onClick={() => setShowSfPanel(false)}>Скрыть</Button>
          </div>
          <div className="flex items-center gap-3">
            <Input value={domain !== "—" ? `https://${domain}` : ""} readOnly className="bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] max-w-xs" />
            <span className="text-[11px] text-zinc-500">Время сканирования: 5–15 минут для сайтов до 500 страниц</span>
          </div>
          {(scanStatus === "pending" || scanStatus === "running") && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-zinc-400">
                <span className="inline-flex items-center gap-2">
                  <span className="h-3 w-3 rounded-full border-2 border-yellow-400 border-t-transparent animate-spin" />
                  {scanStatus === "running" ? "Идёт сканирование..." : "В очереди..."}
                </span>
                <span>{Math.round(scanProgress)}%</span>
              </div>
              <Progress value={Math.min(scanProgress, 100)} className="h-2 bg-[#333]" />
            </div>
          )}
          {scanStatus === "error" && (
            <div className="text-[12px] text-red-400">Произошла ошибка при сканировании</div>
          )}
        </Card>
      )}

      {/* Блок статистики */}
      {scanStatus === "done" && effectiveStats && (
        <Card className="bg-[#252525] border-[#333] p-4 space-y-2">
          <div className="text-[13px] font-semibold text-zinc-200">Результаты сканирования</div>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Всего страниц</div><div className="text-[18px] font-bold text-zinc-100">{effectiveStats.total_pages}</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Критических</div><div className="text-[18px] font-bold text-red-400">{effectiveStats.critical_count}</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Предупреждений</div><div className="text-[18px] font-bold text-yellow-400">{effectiveStats.warning_count}</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Средний TTFB</div><div className="text-[18px] font-bold text-zinc-100">{effectiveStats.avg_load_time_ms} мс</div></div>
            <div className="rounded-lg bg-[#1e1e1e] p-3"><div className="text-[10px] text-zinc-500 uppercase">Оценка сайта</div><div className="text-[18px] font-bold text-emerald-400">{effectiveStats.score}/100</div></div>
          </div>
        </Card>
      )}

      {/* Раздел: Технические ошибки */}
      {scanStatus === "done" && (
        <Card className="bg-[#252525] border-[#333] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-zinc-100">Технические ошибки</h3>
            <Badge className="bg-zinc-700 text-zinc-300 text-[11px]">из Python краулера</Badge>
          </div>
          <TechnicalIssuesList
            issues={jobIssues}
            baseUrl={project?.url}
            statsFallback={effectiveStats ? {
              critical_count: effectiveStats.critical_count ?? 0,
              warning_count: effectiveStats.warning_count ?? 0,
              info_count: effectiveStats.info_count ?? 0,
              total_issues: effectiveStats.total_issues ?? 0,
            } : null}
          />
        </Card>
      )}

      {scanStatus !== "done" && !showSfPanel && (
        <Card className="bg-[#252525] border-[#333] p-8 text-center">
          <div className="text-[14px] text-zinc-400">Запустите аудит, чтобы получить технический анализ сайта</div>
        </Card>
      )}
    </div>
  );
}

export default TechnicalAuditTab;
