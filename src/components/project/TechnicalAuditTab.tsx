import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { ChevronDown, ChevronRight, Download, ExternalLink, ShieldAlert, Link2, FileSearch, CheckCircle2, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface Props { projectId: string; }

// ============ КАТАЛОГ ПРОВЕРОК ============
type CheckDef = { code: string; label: string; severity: "critical" | "warning" | "info" };
type SectionDef = { id: string; title: string; types: string[]; checks: CheckDef[] };

const SECTIONS: SectionDef[] = [
  {
    id: "technical",
    title: "Технические ошибки",
    types: ["technical"],
    checks: [
      { code: "no_https", label: "Сайт не использует HTTPS", severity: "critical" },
      { code: "robots_blocks_all", label: "robots.txt блокирует весь сайт", severity: "critical" },
      { code: "slow_ttfb", label: "Медленный ответ сервера (>3 сек)", severity: "critical" },
      { code: "noindex_meta", label: "Страница закрыта от индексации", severity: "critical" },
      { code: "status_404", label: "Страницы с ошибкой 404", severity: "critical" },
      { code: "status_500", label: "Страницы с ошибкой 500", severity: "critical" },
      { code: "crawl_error", label: "Ошибка при сканировании", severity: "critical" },
      { code: "no_http_to_https_redirect", label: "HTTP не редиректит на HTTPS", severity: "warning" },
      { code: "redirect_chain", label: "Длинная цепочка редиректов", severity: "warning" },
      { code: "no_robots_txt", label: "Нет файла robots.txt", severity: "warning" },
      { code: "no_sitemap", label: "Нет sitemap.xml", severity: "warning" },
      { code: "sitemap_invalid", label: "Некорректный sitemap.xml", severity: "warning" },
      { code: "missing_canonical", label: "Отсутствует canonical", severity: "warning" },
      { code: "medium_ttfb", label: "Замедленный ответ сервера (>1.5 сек)", severity: "warning" },
      { code: "no_gzip", label: "Нет сжатия gzip/brotli", severity: "warning" },
      { code: "nofollow_meta", label: "Все ссылки закрыты nofollow", severity: "warning" },
      { code: "canonical_mismatch", label: "Canonical не совпадает с URL", severity: "info" },
    ],
  },
  {
    id: "links",
    title: "Ссылки и контент",
    types: ["links"],
    checks: [
      { code: "broken_link", label: "Битые внутренние ссылки", severity: "critical" },
      { code: "http_link", label: "Ссылки с HTTP на HTTPS сайте", severity: "warning" },
      { code: "redirect_301", label: "Внутренние ссылки ведут на редирект 301", severity: "warning" },
      { code: "external_link", label: "Исходящие внешние ссылки", severity: "info" },
    ],
  },
  {
    id: "onpage",
    title: "Ошибки парсера",
    types: ["onpage", "media"],
    checks: [
      { code: "missing_h1", label: "Страницы без H1", severity: "critical" },
      { code: "missing_title", label: "Страницы без title", severity: "critical" },
      { code: "multiple_h1", label: "Страницы с несколькими H1", severity: "warning" },
      { code: "duplicate_h1", label: "Дубли страниц по H1", severity: "warning" },
      { code: "multiple_title", label: "Страницы с несколькими title", severity: "warning" },
      { code: "duplicate_title", label: "Дубли страниц по title", severity: "warning" },
      { code: "title_too_long", label: "Title слишком длинный (>70 симв)", severity: "warning" },
      { code: "title_too_short", label: "Title слишком короткий (<30 симв)", severity: "warning" },
      { code: "title_equals_h1", label: "Title дублирует H1", severity: "warning" },
      { code: "missing_description", label: "Страницы без description", severity: "warning" },
      { code: "multiple_description", label: "Несколько description на странице", severity: "warning" },
      { code: "duplicate_description", label: "Дубли страниц по description", severity: "warning" },
      { code: "description_too_long", label: "Description слишком длинный (>160 симв)", severity: "warning" },
      { code: "missing_alt", label: "Картинки без alt", severity: "warning" },
      { code: "heavy_image", label: "Тяжёлые изображения (>200kb)", severity: "warning" },
      { code: "empty_page", label: "Пустые страницы (<50 слов)", severity: "warning" },
    ],
  },
];

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

function pageWord(n: number) {
  const mod10 = n % 10, mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "страница";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "страницы";
  return "страниц";
}

// ============ СЕКЦИЯ ============
function AuditSection({
  section,
  issues,
  baseUrl,
  defaultOpen,
}: {
  section: SectionDef;
  issues: any[];
  baseUrl?: string | null;
  defaultOpen?: boolean;
}) {
  const [sectionOpen, setSectionOpen] = useState<boolean>(!!defaultOpen);
  const [rowOpen, setRowOpen] = useState<Record<string, boolean>>({});

  const origin = (() => {
    try { return baseUrl ? new URL(baseUrl.startsWith("http") ? baseUrl : `https://${baseUrl}`).origin : null; }
    catch { return null; }
  })();

  // Группируем найденные issues этой секции по code
  const sectionIssues = (issues ?? []).filter((i) => section.types.includes(i.type));
  const groupMap = new Map<string, { urls: Set<string>; total: number; severity: string }>();
  for (const i of sectionIssues) {
    const code = i.code || "unknown";
    let g = groupMap.get(code);
    if (!g) { g = { urls: new Set(), total: 0, severity: i.severity || "info" }; groupMap.set(code, g); }
    g.total += 1;
    let url = extractUrl(i);
    if (url) {
      if (url.startsWith("/") && origin) url = origin + url;
      g.urls.add(url);
    }
    if ((SEV_ORDER[i.severity] ?? 9) < (SEV_ORDER[g.severity] ?? 9)) g.severity = i.severity;
  }

  // Строим финальный список: каталог + неизвестные коды
  const catalogCodes = new Set(section.checks.map((c) => c.code));
  const extraCodes = Array.from(groupMap.keys()).filter((c) => !catalogCodes.has(c));
  const rows = [
    ...section.checks.map((c) => ({
      code: c.code,
      label: c.label,
      severity: groupMap.get(c.code)?.severity ?? c.severity,
      group: groupMap.get(c.code),
    })),
    ...extraCodes.map((code) => ({
      code, label: code, severity: groupMap.get(code)!.severity, group: groupMap.get(code),
    })),
  ];

  // Сортировка: проблемы вверху по severity, "ОК" вниз
  rows.sort((a, b) => {
    const aHas = !!a.group, bHas = !!b.group;
    if (aHas !== bHas) return aHas ? -1 : 1;
    return (SEV_ORDER[a.severity] ?? 9) - (SEV_ORDER[b.severity] ?? 9);
  });

  const problemCount = rows.filter((r) => !!r.group).length;

  return (
    <Card className="bg-[#252525] border-[#333] overflow-hidden">
      <button
        type="button"
        onClick={() => setSectionOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-[#2a2a2a] transition-colors text-left"
      >
        {sectionOpen ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
        <h3 className="flex-1 text-[14px] font-semibold text-zinc-100">{section.title}</h3>
        {problemCount > 0 ? (
          <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px]">
            Найдено: {problemCount}
          </Badge>
        ) : (
          <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[11px]">
            Ошибок нет
          </Badge>
        )}
      </button>

      {sectionOpen && (
        <div className="border-t border-[#333] divide-y divide-[#2a2a2a]">
          {rows.map((r) => {
            const isOpen = !!rowOpen[r.code];
            const has = !!r.group;
            const urlList = r.group ? Array.from(r.group.urls) : [];
            const pages = urlList.length || r.group?.total || 0;

            return (
              <div key={r.code}>
                <button
                  type="button"
                  disabled={!has}
                  onClick={() => has && setRowOpen((p) => ({ ...p, [r.code]: !p[r.code] }))}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors",
                    has ? "hover:bg-[#2a2a2a]" : "bg-[#1f2a20]/30 cursor-default"
                  )}
                >
                  {has ? (
                    isOpen ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500 shrink-0" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                  ) : (
                    <span className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className={cn("flex-1 text-[13px] truncate", has ? "text-zinc-200" : "text-emerald-400")}>
                    {has ? r.label : `✅ ${r.label} — ошибок нет`}
                  </span>
                  {has && (
                    <>
                      <Badge className="bg-zinc-700 text-zinc-300 text-[11px] shrink-0">
                        {pages} {pageWord(pages)}
                      </Badge>
                      <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium shrink-0", SEV_CLS[r.severity] ?? SEV_CLS.info)}>
                        {SEV_LABEL[r.severity] ?? r.severity}
                      </span>
                    </>
                  )}
                </button>
                {has && isOpen && (
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
      )}
    </Card>
  );
}

// ============ ОСНОВНОЙ КОМПОНЕНТ ============
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
    queryKey: ["crawl-issues-all", jobId],
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

      {/* Карточки статистики */}
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

      {/* 3 раздела с проверками */}
      {scanStatus === "done" && (
        <div className="space-y-3">
          {SECTIONS.map((s, idx) => (
            <AuditSection
              key={s.id}
              section={s}
              issues={jobIssues}
              baseUrl={project?.url}
              defaultOpen={idx === 0}
            />
          ))}
        </div>
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
