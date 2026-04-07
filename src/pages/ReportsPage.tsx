import { useState, useRef, useCallback, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Download, Mail, Loader2, Calendar, CheckCircle2,
  ListOrdered, TrendingUp, ClipboardList, BarChart3, Send,
  FileDown, Eye, GitCompareArrows,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, subMonths, subYears, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToWord, type WordSection } from "@/lib/export-utils";
import jsPDF from "jspdf";

const COMPARISON_MODES = [
  { key: "none", label: "Без сравнения" },
  { key: "previous", label: "Предыдущий период" },
  { key: "lastYear", label: "Тот же период, прошлый год" },
] as const;

type ComparisonMode = typeof COMPARISON_MODES[number]["key"];

const PERIOD_PRESETS = [
  { key: "last30", label: "Последние 30 дней" },
  { key: "thisMonth", label: "Текущий месяц" },
  { key: "lastMonth", label: "Прошлый месяц" },
  { key: "last90", label: "Последние 90 дней" },
  { key: "custom", label: "Свой период" },
];

const SECTIONS = [
  { key: "tasks", label: "Выполненные задачи", icon: CheckCircle2, desc: "Список завершённых задач за период" },
  { key: "worklog", label: "Проделанная работа", icon: ClipboardList, desc: "Журнал работ по проекту" },
  { key: "positions", label: "Позиции", icon: ListOrdered, desc: "Ключевые слова и их позиции" },
  { key: "traffic", label: "Трафик", icon: TrendingUp, desc: "Данные по трафику из Метрики" },
];

function getDateRange(preset: string, customFrom: string, customTo: string) {
  const now = new Date();
  switch (preset) {
    case "last30": return { from: subDays(now, 30), to: now };
    case "thisMonth": return { from: startOfMonth(now), to: now };
    case "lastMonth": {
      const prev = subMonths(now, 1);
      return { from: startOfMonth(prev), to: endOfMonth(prev) };
    }
    case "last90": return { from: subDays(now, 90), to: now };
    case "custom":
      return {
        from: customFrom ? new Date(customFrom) : subDays(now, 30),
        to: customTo ? new Date(customTo) : now,
      };
    default: return { from: subDays(now, 30), to: now };
  }
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [periodPreset, setPeriodPreset] = useState("lastMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sections, setSections] = useState<Record<string, boolean>>({
    tasks: true, worklog: true, positions: true, traffic: true,
  });
  const [generating, setGenerating] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [lastGeneratedFormat, setLastGeneratedFormat] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("previous");

  // Load projects
  const { data: projects = [] } = useQuery({
    queryKey: ["reports-projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, url, logo_url, client_email").order("name");
      if (error) throw error;
      return data;
    },
  });

  const project = projects.find(p => p.id === selectedProject);
  const dateRange = getDateRange(periodPreset, customFrom, customTo);
  const periodLabel = `${format(dateRange.from, "dd.MM.yyyy")} — ${format(dateRange.to, "dd.MM.yyyy")}`;

  // Comparison period computation
  const compDateRange = useMemo(() => {
    if (comparisonMode === "none") return null;
    const days = differenceInDays(dateRange.to, dateRange.from);
    if (comparisonMode === "previous") {
      return { from: subDays(dateRange.from, days + 1), to: subDays(dateRange.from, 1) };
    }
    // lastYear
    return { from: subYears(dateRange.from, 1), to: subYears(dateRange.to, 1) };
  }, [dateRange, comparisonMode]);

  const compPeriodLabel = compDateRange
    ? `${format(compDateRange.from, "dd.MM.yyyy")} — ${format(compDateRange.to, "dd.MM.yyyy")}`
    : "";

  const enabledSections = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);

  // Load report data
  const { data: reportData, isLoading: loadingData } = useQuery({
    queryKey: ["report-data", selectedProject, periodPreset, customFrom, customTo],
    queryFn: async () => {
      if (!selectedProject) return null;

      const [tasksRes, workLogsRes, keywordsRes, analyticsRes] = await Promise.all([
        supabase.from("crm_tasks")
          .select("title, stage, priority, deadline, assignee:team_members!crm_tasks_assignee_id_fkey(full_name)")
          .eq("project_id", selectedProject)
          .eq("stage", "Завершена"),
        supabase.from("work_logs")
          .select("description, category, status, task_date, link_url")
          .eq("project_id", selectedProject)
          .gte("task_date", format(dateRange.from, "yyyy-MM-dd"))
          .lte("task_date", format(dateRange.to, "yyyy-MM-dd"))
          .order("task_date", { ascending: false }),
        supabase.from("project_keywords")
          .select("keyword, position, position_change")
          .eq("project_id", selectedProject)
          .order("position", { ascending: true })
          .limit(50),
        supabase.from("project_analytics")
          .select("month, organic_traffic, avg_position")
          .eq("project_id", selectedProject)
          .order("month", { ascending: false })
          .limit(12),
      ]);

      return {
        tasks: tasksRes.data || [],
        workLogs: workLogsRes.data || [],
        keywords: keywordsRes.data || [],
        analytics: analyticsRes.data || [],
      };
    },
    enabled: !!selectedProject,
  });

  // Load comparison period data
  const { data: compData } = useQuery({
    queryKey: ["report-comp-data", selectedProject, comparisonMode, periodPreset, customFrom, customTo],
    queryFn: async () => {
      if (!selectedProject || !compDateRange) return null;

      const [tasksRes, workLogsRes, analyticsRes] = await Promise.all([
        supabase.from("crm_tasks")
          .select("id")
          .eq("project_id", selectedProject)
          .eq("stage", "Завершена")
          .gte("updated_at", format(compDateRange.from, "yyyy-MM-dd"))
          .lte("updated_at", format(compDateRange.to, "yyyy-MM-dd")),
        supabase.from("work_logs")
          .select("id")
          .eq("project_id", selectedProject)
          .gte("task_date", format(compDateRange.from, "yyyy-MM-dd"))
          .lte("task_date", format(compDateRange.to, "yyyy-MM-dd")),
        supabase.from("project_analytics")
          .select("month, organic_traffic, avg_position")
          .eq("project_id", selectedProject)
          .gte("month", format(compDateRange.from, "yyyy-MM-dd"))
          .lte("month", format(compDateRange.to, "yyyy-MM-dd")),
      ]);

      const compAnalytics = analyticsRes.data || [];
      const compTraffic = compAnalytics.reduce((s, a) => s + (a.organic_traffic || 0), 0);
      const compAvgPos = compAnalytics.length > 0
        ? compAnalytics.reduce((s, a) => s + Number(a.avg_position || 0), 0) / compAnalytics.length
        : 0;

      return {
        tasksCount: tasksRes.data?.length || 0,
        workLogsCount: workLogsRes.data?.length || 0,
        totalTraffic: compTraffic,
        avgPosition: compAvgPos,
      };
    },
    enabled: !!selectedProject && comparisonMode !== "none" && !!compDateRange,
  });

  const toggleSection = (key: string) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  // Delta helper
  const calcDelta = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  const deltaLabel = (current: number, prev: number, invert = false) => {
    const d = calcDelta(current, prev);
    if (d === 0) return "0%";
    const sign = d > 0 ? "+" : "";
    return `${sign}${d}%`;
  };

  const deltaColor = (current: number, prev: number, invert = false) => {
    const d = calcDelta(current, prev);
    if (d === 0) return "text-muted-foreground";
    const isPositive = invert ? d < 0 : d > 0;
    return isPositive ? "text-green-500" : "text-destructive";
  };

  const buildWordSections = useCallback((): WordSection[] => {
    if (!reportData || !project) return [];
    const result: WordSection[] = [];

    if (sections.tasks && reportData.tasks.length > 0) {
      result.push({
        title: "Выполненные задачи",
        table: {
          headers: ["Задача", "Приоритет", "Исполнитель", "Дедлайн"],
          rows: reportData.tasks.map((t: any) => [
            t.title,
            t.priority === "high" ? "Высокий" : t.priority === "low" ? "Низкий" : "Средний",
            t.assignee?.full_name || "—",
            t.deadline ? format(new Date(t.deadline), "dd.MM.yyyy") : "—",
          ]),
        },
      });
    }

    if (sections.worklog && reportData.workLogs.length > 0) {
      result.push({
        title: "Проделанная работа",
        table: {
          headers: ["Дата", "Описание", "Категория", "Статус"],
          rows: reportData.workLogs.map((w: any) => [
            format(new Date(w.task_date), "dd.MM.yyyy"),
            w.description,
            w.category,
            w.status === "done" ? "Готово" : "В работе",
          ]),
        },
      });
    }

    if (sections.positions && reportData.keywords.length > 0) {
      result.push({
        title: "Позиции по ключевым словам",
        table: {
          headers: ["Запрос", "Позиция", "Изменение"],
          rows: reportData.keywords.map((k: any) => [
            k.keyword,
            k.position,
            k.position_change > 0 ? `+${k.position_change}` : String(k.position_change),
          ]),
        },
      });
    }

    if (sections.traffic && reportData.analytics.length > 0) {
      result.push({
        title: "Трафик",
        table: {
          headers: ["Месяц", "Органический трафик", "Средняя позиция"],
          rows: reportData.analytics.map((a: any) => [
            format(new Date(a.month), "MMMM yyyy"),
            a.organic_traffic,
            a.avg_position.toFixed(1),
          ]),
        },
      });
    }

    return result;
  }, [reportData, project, sections]);

  const handleGeneratePdf = useCallback(async () => {
    if (!reportData || !project) return;
    setGenerating(true);
    try {
      const pdf = new jsPDF("p", "mm", "a4");
      const pageW = 210;
      let y = 20;

      // Header
      const headerH = comparisonMode !== "none" ? 42 : 35;
      pdf.setFillColor(26, 26, 27);
      pdf.rect(0, 0, pageW, headerH, "F");
      pdf.setTextColor(255, 255, 255);
      pdf.setFontSize(18);
      pdf.text(`Отчёт: ${project.name}`, 14, 16);
      pdf.setFontSize(10);
      pdf.setTextColor(180, 180, 180);
      pdf.text(`Период: ${periodLabel}`, 14, 25);
      if (comparisonMode !== "none" && compPeriodLabel) {
        pdf.text(`Сравнение: ${compPeriodLabel} (${comparisonMode === "previous" ? "пред. период" : "прошлый год"})`, 14, 31);
      }
      if (project.url) pdf.text(project.url, 14, comparisonMode !== "none" ? 37 : 31);
      y = headerH + 10;

      pdf.setTextColor(40, 40, 40);

      // Comparison summary block
      if (comparisonMode !== "none" && compData) {
        pdf.setFillColor(245, 245, 245);
        pdf.roundedRect(14, y, pageW - 28, 22, 2, 2, "F");
        pdf.setFontSize(10);
        pdf.setFont("helvetica", "bold");
        pdf.text("Сравнение с " + (comparisonMode === "previous" ? "предыдущим периодом" : "прошлым годом"), 18, y + 6);
        pdf.setFont("helvetica", "normal");
        pdf.setFontSize(9);

        const curTasks = reportData.tasks.length;
        const curLogs = reportData.workLogs.length;
        const curTraffic = reportData.analytics.reduce((s: number, a: any) => s + (a.organic_traffic || 0), 0);
        const dTasks = calcDelta(curTasks, compData.tasksCount);
        const dLogs = calcDelta(curLogs, compData.workLogsCount);
        const dTraffic = calcDelta(curTraffic, compData.totalTraffic);

        const items = [
          `Задачи: ${curTasks} (${dTasks >= 0 ? "+" : ""}${dTasks}%)`,
          `Работы: ${curLogs} (${dLogs >= 0 ? "+" : ""}${dLogs}%)`,
          `Трафик: ${curTraffic.toLocaleString()} (${dTraffic >= 0 ? "+" : ""}${dTraffic}%)`,
        ];
        pdf.text(items.join("   |   "), 18, y + 14);
        y += 30;
      }

      const addSection = (title: string, headers: string[], rows: string[][]) => {
        if (y > 260) { pdf.addPage(); y = 20; }
        pdf.setFontSize(14);
        pdf.setFont("helvetica", "bold");
        pdf.text(title, 14, y);
        y += 8;

        pdf.setFontSize(9);
        pdf.setFont("helvetica", "bold");
        const colW = (pageW - 28) / headers.length;
        headers.forEach((h, i) => pdf.text(h, 14 + i * colW, y));
        y += 2;
        pdf.setDrawColor(200); pdf.line(14, y, pageW - 14, y);
        y += 5;

        pdf.setFont("helvetica", "normal");
        rows.forEach(row => {
          if (y > 275) { pdf.addPage(); y = 20; }
          row.forEach((cell, i) => {
            const text = String(cell).substring(0, 40);
            pdf.text(text, 14 + i * colW, y);
          });
          y += 5;
        });
        y += 8;
      };

      if (sections.tasks && reportData.tasks.length > 0) {
        addSection("Выполненные задачи",
          ["Задача", "Приоритет", "Исполнитель", "Дедлайн"],
          reportData.tasks.map((t: any) => [
            t.title,
            t.priority === "high" ? "Высокий" : t.priority === "low" ? "Низкий" : "Средний",
            t.assignee?.full_name || "—",
            t.deadline ? format(new Date(t.deadline), "dd.MM.yyyy") : "—",
          ])
        );
      }

      if (sections.worklog && reportData.workLogs.length > 0) {
        addSection("Проделанная работа",
          ["Дата", "Описание", "Категория", "Статус"],
          reportData.workLogs.map((w: any) => [
            format(new Date(w.task_date), "dd.MM.yyyy"),
            w.description,
            w.category,
            w.status === "done" ? "Готово" : "В работе",
          ])
        );
      }

      if (sections.positions && reportData.keywords.length > 0) {
        addSection("Позиции по ключевым словам",
          ["Запрос", "Позиция", "Изменение"],
          reportData.keywords.map((k: any) => [
            k.keyword,
            String(k.position),
            k.position_change > 0 ? `+${k.position_change}` : String(k.position_change),
          ])
        );
      }

      if (sections.traffic && reportData.analytics.length > 0) {
        addSection("Трафик",
          ["Месяц", "Органический трафик", "Ср. позиция"],
          reportData.analytics.map((a: any) => [
            format(new Date(a.month), "MM.yyyy"),
            String(a.organic_traffic),
            a.avg_position.toFixed(1),
          ])
        );
      }

      // Footer
      pdf.setFontSize(8);
      pdf.setTextColor(150);
      pdf.text(`Сгенерировано StatPulse · ${format(new Date(), "dd.MM.yyyy HH:mm")}`, 14, 290);

      pdf.save(`Отчёт_${project.name}_${format(dateRange.from, "dd.MM.yyyy")}.pdf`);
      setLastGeneratedFormat("pdf");
      toast.success("PDF-отчёт сгенерирован");
    } catch (err: any) {
      toast.error(err.message || "Ошибка генерации PDF");
    } finally {
      setGenerating(false);
    }
  }, [reportData, project, sections, periodLabel, dateRange]);

  const handleGenerateDocx = useCallback(async () => {
    if (!reportData || !project) return;
    setGenerating(true);
    try {
      const wordSections = buildWordSections();
      if (wordSections.length === 0) {
        toast.error("Нет данных для отчёта");
        return;
      }
      await exportToWord(wordSections, {
        projectName: project.name,
        tabName: "Отчёт",
        periodA: periodLabel,
        language: "ru",
      });
      setLastGeneratedFormat("docx");
      toast.success("DOCX-отчёт сгенерирован");
    } catch (err: any) {
      toast.error(err.message || "Ошибка генерации DOCX");
    } finally {
      setGenerating(false);
    }
  }, [reportData, project, buildWordSections, periodLabel]);

  const handleSendEmail = useCallback(async () => {
    if (!clientEmail.trim()) { toast.error("Введите email"); return; }
    setSending(true);
    try {
      // For now, generate the public report link
      const reportUrl = `${window.location.origin}/report/${selectedProject}`;
      // Copy to clipboard as a workaround until email integration is set up
      await navigator.clipboard.writeText(reportUrl);
      toast.success(`Ссылка на отчёт скопирована. Отправьте её на ${clientEmail}`);
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }, [clientEmail, selectedProject]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" /> Отчёты
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Генерация отчётов по проектам для клиентов
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left - Settings */}
        <div className="lg:col-span-2 space-y-5">
          {/* Project Selection */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-4">
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Проект</Label>
                <Select value={selectedProject} onValueChange={setSelectedProject}>
                  <SelectTrigger className="mt-1.5">
                    <SelectValue placeholder="Выберите проект..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
                      <SelectItem key={p.id} value={p.id}>
                        <div className="flex items-center gap-2">
                          {p.logo_url ? (
                            <img src={p.logo_url} alt="" className="h-4 w-4 rounded object-cover" />
                          ) : (
                            <div className="h-4 w-4 rounded bg-primary/20 text-[8px] flex items-center justify-center font-bold text-primary">
                              {p.name.slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span>{p.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <Separator />

              {/* Period */}
              <div>
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Период</Label>
                <div className="flex flex-wrap gap-1.5 mt-1.5">
                  {PERIOD_PRESETS.map(p => (
                    <Button
                      key={p.key}
                      variant={periodPreset === p.key ? "default" : "outline"}
                      size="sm"
                      className="text-xs h-7"
                      onClick={() => setPeriodPreset(p.key)}
                    >
                      {p.label}
                    </Button>
                  ))}
                </div>
                {periodPreset === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <Label className="text-[11px]">С</Label>
                      <Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="mt-1" />
                    </div>
                    <div>
                      <Label className="text-[11px]">По</Label>
                      <Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="mt-1" />
                    </div>
                  </div>
                )}
                {selectedProject && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{periodLabel}</span>
                  </div>
                )}

                <Separator className="my-3" />

                {/* Comparison Mode */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <GitCompareArrows className="h-3.5 w-3.5" /> Сравнение
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {COMPARISON_MODES.map(m => (
                      <Button
                        key={m.key}
                        variant={comparisonMode === m.key ? "default" : "outline"}
                        size="sm"
                        className="text-xs h-7"
                        onClick={() => setComparisonMode(m.key)}
                      >
                        {m.label}
                      </Button>
                    ))}
                  </div>
                  {comparisonMode !== "none" && compPeriodLabel && (
                    <div className="flex items-center gap-1.5 mt-2">
                      <GitCompareArrows className="h-3.5 w-3.5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">vs {compPeriodLabel}</span>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <Card className="border-border bg-card">
            <CardContent className="p-4">
              <Label className="text-xs uppercase tracking-wider text-muted-foreground">Разделы отчёта</Label>
              <div className="space-y-2 mt-3">
                {SECTIONS.map(s => {
                  const Icon = s.icon;
                  const enabled = sections[s.key];
                  const count = reportData
                    ? s.key === "tasks" ? reportData.tasks.length
                    : s.key === "worklog" ? reportData.workLogs.length
                    : s.key === "positions" ? reportData.keywords.length
                    : s.key === "traffic" ? reportData.analytics.length
                    : 0
                    : 0;
                  return (
                    <div key={s.key} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      enabled ? "border-primary/30 bg-primary/5" : "border-border bg-card opacity-60"
                    )}>
                      <div className={cn(
                        "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                        enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Icon className="h-4 w-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-foreground">{s.label}</p>
                          {selectedProject && (
                            <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                              {loadingData ? "..." : count}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{s.desc}</p>
                      </div>
                      <Switch checked={enabled} onCheckedChange={() => toggleSection(s.key)} />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right - Actions */}
        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" /> Скачать отчёт
              </h3>
              <Button
                className="w-full gap-2 justify-start"
                variant="outline"
                disabled={!selectedProject || enabledSections.length === 0 || generating}
                onClick={handleGeneratePdf}
              >
                {generating && lastGeneratedFormat !== "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 text-destructive" />}
                Скачать PDF
              </Button>
              <Button
                className="w-full gap-2 justify-start"
                variant="outline"
                disabled={!selectedProject || enabledSections.length === 0 || generating}
                onClick={handleGenerateDocx}
              >
                {generating && lastGeneratedFormat === "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 text-primary" />}
                Скачать DOCX
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Mail className="h-4 w-4 text-primary" /> Отправить клиенту
              </h3>
              <p className="text-xs text-muted-foreground">
                Отправьте ссылку на онлайн-отчёт клиенту
              </p>
              <Button
                className="w-full gap-2"
                disabled={!selectedProject}
                onClick={() => {
                  setClientEmail(project?.client_email || "");
                  setEmailDialogOpen(true);
                }}
              >
                <Send className="h-4 w-4" /> Отправить на email
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Онлайн-отчёт
              </h3>
              <p className="text-xs text-muted-foreground">
                Откройте настройщик шаблона отчёта в проекте
              </p>
              <Button
                className="w-full gap-2"
                variant="outline"
                disabled={!selectedProject}
                onClick={() => window.open(`/report/${selectedProject}`, "_blank")}
              >
                <BarChart3 className="h-4 w-4" /> Открыть онлайн-отчёт
              </Button>
            </CardContent>
          </Card>

          {/* Summary */}
          {selectedProject && reportData && (
            <Card className="border-primary/20 bg-primary/5">
              <CardContent className="p-4">
                <h3 className="text-sm font-semibold text-foreground mb-2">Сводка</h3>
                <div className="space-y-1.5 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Проект</span>
                    <span className="text-foreground font-medium">{project?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Период</span>
                    <span className="text-foreground font-medium">{periodLabel}</span>
                  </div>
                  {comparisonMode !== "none" && compPeriodLabel && (
                    <div className="flex justify-between">
                      <span>Сравнение</span>
                      <span className="text-foreground font-medium">{compPeriodLabel}</span>
                    </div>
                  )}
                  <Separator className="my-1" />
                  <div className="flex justify-between items-center">
                    <span>Задач выполнено</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{reportData.tasks.length}</span>
                      {compData && comparisonMode !== "none" && (
                        <span className={cn("text-[10px] font-medium", deltaColor(reportData.tasks.length, compData.tasksCount))}>
                          {deltaLabel(reportData.tasks.length, compData.tasksCount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Записей работ</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{reportData.workLogs.length}</span>
                      {compData && comparisonMode !== "none" && (
                        <span className={cn("text-[10px] font-medium", deltaColor(reportData.workLogs.length, compData.workLogsCount))}>
                          {deltaLabel(reportData.workLogs.length, compData.workLogsCount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Ключевых слов</span>
                    <span className="text-foreground font-medium">{reportData.keywords.length}</span>
                  </div>
                  {compData && comparisonMode !== "none" && reportData.analytics.length > 0 && (
                    <>
                      <Separator className="my-1" />
                      <div className="flex justify-between items-center">
                        <span>Трафик (орг.)</span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-foreground font-medium">
                            {reportData.analytics.reduce((s: number, a: any) => s + (a.organic_traffic || 0), 0).toLocaleString()}
                          </span>
                          <span className={cn("text-[10px] font-medium", deltaColor(
                            reportData.analytics.reduce((s: number, a: any) => s + (a.organic_traffic || 0), 0),
                            compData.totalTraffic
                          ))}>
                            {deltaLabel(
                              reportData.analytics.reduce((s: number, a: any) => s + (a.organic_traffic || 0), 0),
                              compData.totalTraffic
                            )}
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                  <div className="flex justify-between">
                    <span>Разделов</span>
                    <span className="text-foreground font-medium">{enabledSections.length} из {SECTIONS.length}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Email Dialog */}
      <Dialog open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Mail className="h-5 w-5 text-primary" /> Отправить отчёт
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <Label className="text-xs">Email клиента</Label>
              <Input
                type="email"
                value={clientEmail}
                onChange={e => setClientEmail(e.target.value)}
                placeholder="client@company.com"
                className="mt-1"
              />
            </div>
            {project && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="text-foreground font-medium">Проект:</span> {project.name}</p>
                <p><span className="text-foreground font-medium">Период:</span> {periodLabel}</p>
                <p><span className="text-foreground font-medium">Разделы:</span> {enabledSections.length}</p>
              </div>
            )}
            <Button
              className="w-full gap-2"
              onClick={handleSendEmail}
              disabled={sending || !clientEmail.trim()}
            >
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Отправить ссылку на отчёт
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
