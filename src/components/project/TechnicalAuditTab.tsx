import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Search, ChevronDown, ChevronRight, Download, ExternalLink, LayoutList, LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

type CheckType = "auto" | "external" | "manual";
type Importance = "high" | "medium" | "low";
type Result = "unchecked" | "ok" | "error";

interface AuditCheck {
  id: string;
  number: string;
  name: string;
  section: string;
  importance: Importance;
  difficulty: Importance;
  type: CheckType;
  externalUrl?: string;
  result: Result;
  comment: string;
  status: string;
  urls?: string[];
}

const SECTION_1: Omit<AuditCheck, "id" | "result" | "comment" | "status" | "urls">[] = [
  { number: "1.1", name: "Главное зеркало", section: "technical", importance: "high", difficulty: "low", type: "auto" },
  { number: "1.2", name: "Протокол HTTPS", section: "technical", importance: "medium", difficulty: "high", type: "external", externalUrl: "https://www.ssllabs.com/ssltest/analyze.html?d={domain}" },
  { number: "1.3", name: "XML-карта сайта", section: "technical", importance: "high", difficulty: "low", type: "auto" },
  { number: "1.4", name: "Файл Robots.txt", section: "technical", importance: "high", difficulty: "low", type: "external", externalUrl: "https://{domain}/robots.txt" },
  { number: "1.5", name: "Аптайм сервера", section: "technical", importance: "high", difficulty: "medium", type: "external", externalUrl: "https://uptimerobot.com" },
  { number: "1.6", name: "Ошибки валидации", section: "technical", importance: "medium", difficulty: "medium", type: "external", externalUrl: "https://validator.w3.org/nu/?doc=https://{domain}" },
  { number: "1.7", name: "Проверка аффилированности", section: "technical", importance: "high", difficulty: "medium", type: "manual" },
  { number: "1.8", name: "Структура заголовков H1-H6", section: "technical", importance: "medium", difficulty: "medium", type: "auto" },
  { number: "1.9", name: "Проверка на вирусы", section: "technical", importance: "high", difficulty: "medium", type: "external", externalUrl: "https://yandex.ru/safety/?url={domain}" },
  { number: "1.10", name: "Корректность URL адресов", section: "technical", importance: "high", difficulty: "low", type: "auto" },
  { number: "1.11", name: "Заголовки Last Modified", section: "technical", importance: "medium", difficulty: "low", type: "external", externalUrl: "https://last-modified.com/ru/check.html?url={domain}" },
  { number: "1.12", name: "Циклические ссылки", section: "technical", importance: "medium", difficulty: "low", type: "auto" },
  { number: "1.13", name: "Ссылки в сквозных элементах", section: "technical", importance: "high", difficulty: "low", type: "manual" },
  { number: "1.14", name: "Мусорные и пустые страницы", section: "technical", importance: "high", difficulty: "low", type: "auto" },
  { number: "1.15", name: "Полные дубли страниц", section: "technical", importance: "high", difficulty: "medium", type: "auto" },
  { number: "1.16", name: "Элемент canonical", section: "technical", importance: "high", difficulty: "medium", type: "auto" },
  { number: "1.17", name: "Индексация JS, CSS, изображений", section: "technical", importance: "high", difficulty: "low", type: "auto" },
  { number: "1.18", name: "Элемент meta robots", section: "technical", importance: "medium", difficulty: "low", type: "auto" },
  { number: "1.19", name: "Редиректы со слешем и без", section: "technical", importance: "medium", difficulty: "low", type: "auto" },
  { number: "1.20", name: "Код ответа несуществующих страниц", section: "technical", importance: "medium", difficulty: "medium", type: "auto" },
  { number: "1.21", name: "Оформление страницы 404", section: "technical", importance: "medium", difficulty: "medium", type: "manual" },
];

const SECTION_2: Omit<AuditCheck, "id" | "result" | "comment" | "status" | "urls">[] = [
  { number: "2.1", name: "Пагинация", section: "links", importance: "medium", difficulty: "medium", type: "manual" },
  { number: "2.2", name: "Динамическая загрузка JS", section: "links", importance: "medium", difficulty: "high", type: "manual" },
  { number: "2.3", name: "Скрытый контент", section: "links", importance: "high", difficulty: "medium", type: "manual" },
  { number: "2.4", name: "Повторяющийся служебный текст", section: "links", importance: "high", difficulty: "medium", type: "manual" },
];

const SECTION_3: Omit<AuditCheck, "id" | "result" | "comment" | "status" | "urls">[] = [
  { number: "3.1.1", name: "Дубли страниц по H1", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.1.2", name: "Страницы без H1", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.1.3", name: "Страницы с несколькими H1", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.2.1", name: "Дубли страниц по title", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.2.2", name: "Страницы без title", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.2.3", name: "Страницы с несколькими title", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.2.4", name: "Title дублирует H1", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.3.1", name: "Дубли страниц по description", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.3.2", name: "Страницы без description", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.3.3", name: "Страницы с несколькими description", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.4", name: "Мета-теги keywords", section: "parser", importance: "medium", difficulty: "low", type: "auto" },
  { number: "3.5", name: "Ссылки с HTTP", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.6", name: "301 редиректы", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.7", name: "404 ошибки", section: "parser", importance: "high", difficulty: "medium", type: "auto" },
  { number: "3.8", name: "500 ошибки", section: "parser", importance: "high", difficulty: "high", type: "auto" },
  { number: "3.9", name: "Тяжёлые изображения", section: "parser", importance: "high", difficulty: "high", type: "auto" },
  { number: "3.10", name: "Пустые страницы", section: "parser", importance: "medium", difficulty: "medium", type: "auto" },
  { number: "3.11", name: "Исходящие ссылки", section: "parser", importance: "medium", difficulty: "medium", type: "auto" },
];

function buildChecks(defs: typeof SECTION_1): AuditCheck[] {
  return defs.map((d, i) => ({ ...d, id: `${d.section}-${i}`, result: "unchecked" as Result, comment: "", status: "new" }));
}

const TYPE_ICON: Record<CheckType, { icon: string; label: string; color: string }> = {
  auto: { icon: "🤖", label: "Авто", color: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  external: { icon: "🔗", label: "Внешний сервис", color: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30" },
  manual: { icon: "👤", label: "Вручную", color: "bg-amber-500/20 text-amber-400 border-amber-500/30" },
};

const IMP_STYLE: Record<Importance, { label: string; cls: string }> = {
  high: { label: "Высокая", cls: "bg-red-500/20 text-red-400 border-red-500/30" },
  medium: { label: "Средняя", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" },
  low: { label: "Низкая", cls: "bg-zinc-500/20 text-zinc-400 border-zinc-500/30" },
};

const RESULT_STYLE: Record<Result, { label: string; cls: string; border: string }> = {
  unchecked: { label: "Не проверено", cls: "bg-zinc-700 text-zinc-400", border: "border-l-zinc-600" },
  ok: { label: "✅ Ошибок нет", cls: "bg-emerald-500/20 text-emerald-400", border: "border-l-emerald-500" },
  error: { label: "❌ Ошибка", cls: "bg-red-500/20 text-red-400", border: "border-l-red-500" },
};

function getDomain(url?: string | null): string {
  if (!url) return "example.com";
  try { return new URL(url.startsWith("http") ? url : `https://${url}`).hostname; } catch { return url.replace(/^https?:\/\//, "").split("/")[0] || "example.com"; }
}

function TypeBadge({ type }: { type: CheckType }) {
  const t = TYPE_ICON[type];
  return <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", t.color)}>{t.icon} {t.label}</span>;
}

function ImportanceBadge({ imp }: { imp: Importance }) {
  const s = IMP_STYLE[imp];
  return <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium", s.cls)}>{s.label}</span>;
}

function ResultDropdown({ value, onChange }: { value: Result; onChange: (v: Result) => void }) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as Result)}>
      <SelectTrigger className={cn("h-7 w-[160px] text-[11px] border-0", RESULT_STYLE[value].cls)}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="unchecked">Не проверено</SelectItem>
        <SelectItem value="ok">✅ Ошибок нет</SelectItem>
        <SelectItem value="error">❌ Ошибка</SelectItem>
      </SelectContent>
    </Select>
  );
}

function CheckRow({ check, domain, onResultChange, onCommentChange }: {
  check: AuditCheck; domain: string;
  onResultChange: (id: string, r: Result) => void;
  onCommentChange: (id: string, c: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const resolvedUrl = check.externalUrl?.replace(/\{domain\}/g, domain);

  return (
    <div className={cn("border-l-[3px] rounded-r-lg", RESULT_STYLE[check.result].border)}>
      <div className="flex items-center gap-3 px-3 py-2.5 hover:bg-[#2a2a2a] cursor-pointer transition-colors" onClick={() => (check.type === "manual" || (check.urls && check.urls.length > 0)) && setExpanded(!expanded)}>
        <div className="w-[100px] shrink-0"><TypeBadge type={check.type} /></div>
        <span className="w-[50px] text-[12px] text-zinc-500 font-mono shrink-0">{check.number}</span>
        <span className="flex-1 text-[13px] text-zinc-200 truncate">{check.name}</span>
        <div className="w-[90px] shrink-0"><ImportanceBadge imp={check.importance} /></div>
        <div className="w-[90px] shrink-0"><ImportanceBadge imp={check.difficulty} /></div>
        <div className="w-[170px] shrink-0" onClick={e => e.stopPropagation()}>
          <ResultDropdown value={check.result} onChange={(r) => onResultChange(check.id, r)} />
        </div>
        <div className="w-[120px] shrink-0 flex justify-end" onClick={e => e.stopPropagation()}>
          {check.type === "external" && resolvedUrl && (
            <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1 border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10" onClick={() => window.open(resolvedUrl, "_blank")}>
              Открыть <ExternalLink className="h-3 w-3" />
            </Button>
          )}
          {check.type === "auto" && <span className="text-[11px] text-zinc-500">Ожидает запуска</span>}
          {check.type === "manual" && (
            <span className="text-[11px] text-amber-500">{expanded ? <ChevronDown className="h-3.5 w-3.5 inline" /> : <ChevronRight className="h-3.5 w-3.5 inline" />} Заполнить</span>
          )}
        </div>
      </div>
      {expanded && check.type === "manual" && (
        <div className="px-4 pb-3 pl-[160px]">
          <div className="flex items-start gap-3">
            <Checkbox className="mt-1" />
            <Textarea placeholder="Комментарий..." value={check.comment} onChange={e => onCommentChange(check.id, e.target.value)} className="bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] min-h-[60px]" />
          </div>
        </div>
      )}
      {expanded && check.urls && check.urls.length > 0 && (
        <div className="px-4 pb-3 pl-[160px] space-y-1">
          {check.urls.map((u, i) => <div key={i} className="text-[12px] text-zinc-400 font-mono">{u}</div>)}
        </div>
      )}
    </div>
  );
}

function SectionBlock({ title, checks, domain, banner, onResultChange, onCommentChange }: {
  title: string; checks: AuditCheck[]; domain: string; banner?: string;
  onResultChange: (id: string, r: Result) => void;
  onCommentChange: (id: string, c: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const errCount = checks.filter(c => c.result === "error").length;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger className="w-full">
        <div className="flex items-center gap-3 px-4 py-3 bg-[#252525] rounded-lg hover:bg-[#2a2a2a] transition-colors sticky top-0 z-10">
          {open ? <ChevronDown className="h-4 w-4 text-zinc-400" /> : <ChevronRight className="h-4 w-4 text-zinc-400" />}
          <span className="text-[14px] font-semibold text-zinc-100">{title}</span>
          <Badge className="bg-zinc-700 text-zinc-300 text-[11px]">{checks.length} проверок</Badge>
          {errCount > 0 && <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px]">{errCount} ошибок</Badge>}
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent>
        {banner && (
          <div className="mx-4 mt-2 mb-1 rounded-lg bg-blue-500/10 border border-blue-500/20 px-4 py-2 text-[12px] text-blue-400">{banner}</div>
        )}
        <div className="flex items-center gap-3 px-3 py-2 text-[11px] text-zinc-500 font-medium border-b border-[#333] mx-1">
          <div className="w-[100px] shrink-0">Тип</div>
          <div className="w-[50px] shrink-0">№</div>
          <div className="flex-1">Проверка</div>
          <div className="w-[90px] shrink-0">Важность</div>
          <div className="w-[90px] shrink-0">Сложность</div>
          <div className="w-[170px] shrink-0">Результат</div>
          <div className="w-[120px] shrink-0 text-right">Действие</div>
        </div>
        <div className="space-y-0.5 mt-1">
          {checks.map(c => <CheckRow key={c.id} check={c} domain={domain} onResultChange={onResultChange} onCommentChange={onCommentChange} />)}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}

interface Props { projectId: string; }

export function TechnicalAuditTab({ projectId }: Props) {
  const [filter, setFilter] = useState<"all" | "errors" | "high" | "unchecked">("all");
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"table" | "cards">("table");
  const [showSfPanel, setShowSfPanel] = useState(false);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "done">("idle");
  const [scanProgress, setScanProgress] = useState(0);

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

  const [s1, setS1] = useState(() => buildChecks(SECTION_1));
  const [s2, setS2] = useState(() => buildChecks(SECTION_2));
  const [s3, setS3] = useState(() => buildChecks(SECTION_3));

  const updateResult = (setter: typeof setS1) => (id: string, r: Result) => {
    setter(prev => prev.map(c => c.id === id ? { ...c, result: r } : c));
  };
  const updateComment = (setter: typeof setS1) => (id: string, comment: string) => {
    setter(prev => prev.map(c => c.id === id ? { ...c, comment } : c));
  };

  const applyFilter = (checks: AuditCheck[]) => {
    let filtered = checks;
    if (filter === "errors") filtered = filtered.filter(c => c.result === "error");
    if (filter === "high") filtered = filtered.filter(c => c.importance === "high");
    if (filter === "unchecked") filtered = filtered.filter(c => c.result === "unchecked");
    if (search) filtered = filtered.filter(c => c.name.toLowerCase().includes(search.toLowerCase()) || c.number.includes(search));
    return filtered;
  };

  const allChecks = [...s1, ...s2, ...s3];
  const errorChecks = allChecks.filter(c => c.result === "error");

  const handleStartScan = () => {
    setShowSfPanel(true);
    setScanStatus("scanning");
    setScanProgress(0);
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) { clearInterval(interval); setScanStatus("done"); return 100; }
        return prev + Math.random() * 8;
      });
    }, 500);
  };

  return (
    <div className="space-y-5">
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
            {scanStatus === "scanning" && <Badge className="bg-yellow-500/20 text-yellow-400 animate-pulse">Сканирование...</Badge>}
            {scanStatus === "done" && <Badge className="bg-emerald-500/20 text-emerald-400">Готов</Badge>}
            <Button variant="outline" size="sm" className="gap-1.5 text-[12px] border-[#444] text-zinc-300 hover:bg-[#333]">
              <Download className="h-3.5 w-3.5" /> Скачать PDF отчёт
            </Button>
            <Button size="sm" className="gap-1.5 text-[12px] bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white border-0" onClick={handleStartScan}>
              🔍 Запустить аудит (Screaming Frog)
            </Button>
          </div>
        </div>
      </Card>

      {showSfPanel && (
        <Card className="bg-[#252525] border-[#333] p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-semibold text-zinc-200">🤖 Screaming Frog — Сканирование</span>
            <Button variant="ghost" size="sm" className="text-zinc-500 text-[11px]" onClick={() => setShowSfPanel(false)}>Скрыть</Button>
          </div>
          <div className="flex items-center gap-3">
            <Input value={`https://${domain}`} readOnly className="bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] max-w-xs" />
            <span className="text-[11px] text-zinc-500">Время сканирования: 5-15 минут для сайтов до 500 страниц</span>
          </div>
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] text-zinc-400">
              <span>{scanStatus === "scanning" ? "Краулинг страниц..." : scanStatus === "done" ? "Сканирование завершено" : ""}</span>
              <span>{Math.round(scanProgress)}%</span>
            </div>
            <Progress value={Math.min(scanProgress, 100)} className="h-2 bg-[#333]" />
          </div>
        </Card>
      )}

      <div className="flex flex-wrap gap-2">
        {Object.entries(TYPE_ICON).map(([k, v]) => (
          <span key={k} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium", v.color)}>
            {v.icon} {v.label} — {k === "auto" ? "данные из Screaming Frog" : k === "external" ? "открывает сторонний инструмент" : "заполняет SEO-специалист"}
          </span>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {([["all", "Все"], ["errors", "Только ошибки"], ["high", "Высокая важность"], ["unchecked", "Не проверено"]] as const).map(([val, label]) => (
          <Button key={val} variant={filter === val ? "default" : "outline"} size="sm"
            className={cn("text-[11px] h-7", filter === val ? "bg-purple-600 hover:bg-purple-700 text-white border-0" : "border-[#444] text-zinc-400 hover:bg-[#333]")}
            onClick={() => setFilter(val)}>
            {label}
          </Button>
        ))}
        <div className="relative ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-zinc-500" />
          <Input placeholder="Поиск по названию проверки..." value={search} onChange={e => setSearch(e.target.value)} className="pl-8 bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] h-7 w-[240px]" />
        </div>
        <div className="flex gap-0.5 border border-[#444] rounded-md p-0.5">
          <Button variant="ghost" size="sm" className={cn("h-6 w-6 p-0", viewMode === "table" && "bg-[#333]")} onClick={() => setViewMode("table")}><LayoutList className="h-3.5 w-3.5 text-zinc-400" /></Button>
          <Button variant="ghost" size="sm" className={cn("h-6 w-6 p-0", viewMode === "cards" && "bg-[#333]")} onClick={() => setViewMode("cards")}><LayoutGrid className="h-3.5 w-3.5 text-zinc-400" /></Button>
        </div>
      </div>

      <div className="space-y-4">
        <SectionBlock title="Раздел 1 — Технические ошибки" checks={applyFilter(s1)} domain={domain} onResultChange={updateResult(setS1)} onCommentChange={updateComment(setS1)} />
        <SectionBlock title="Раздел 2 — Ссылки и контент" checks={applyFilter(s2)} domain={domain} onResultChange={updateResult(setS2)} onCommentChange={updateComment(setS2)} />
        <SectionBlock title="Раздел 3 — Ошибки выявленные парсером (Screaming Frog)" checks={applyFilter(s3)} domain={domain} banner="🤖 Все проверки этого раздела заполняются автоматически после запуска Screaming Frog" onResultChange={updateResult(setS3)} onCommentChange={updateComment(setS3)} />
      </div>

      {errorChecks.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-zinc-100">Раздел 4 — Рекомендации</h3>
            <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-[11px]">{errorChecks.length}</Badge>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            {errorChecks.map(c => (
              <Card key={c.id} className="bg-[#252525] border-[#333] p-4 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[12px] font-mono text-zinc-500">{c.number}</span>
                  <span className="text-[13px] font-medium text-zinc-200">{c.name}</span>
                  <ImportanceBadge imp={c.importance} />
                  <TypeBadge type={c.type} />
                </div>
                <Textarea placeholder="Задание для разработчика / специалиста..." className="bg-[#1e1e1e] border-[#333] text-zinc-300 text-[12px] min-h-[60px]" />
                <div className="flex items-center gap-2">
                  <Select defaultValue="new">
                    <SelectTrigger className="h-7 w-[130px] text-[11px] bg-[#1e1e1e] border-[#333] text-zinc-300"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="new">Новая</SelectItem>
                      <SelectItem value="inprogress">В работе</SelectItem>
                      <SelectItem value="done">Выполнено</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TechnicalAuditTab;
