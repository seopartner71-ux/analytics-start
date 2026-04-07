import { useState, useCallback, useMemo } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  FileText, Download, Mail, Loader2, Calendar, CheckCircle2,
  ListOrdered, TrendingUp, ClipboardList, BarChart3, Send,
  FileDown, Eye, GitCompareArrows, Bot, Plus, X, Activity,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";
import { format, subDays, startOfMonth, endOfMonth, subMonths, subYears, differenceInDays } from "date-fns";
import { cn } from "@/lib/utils";
import { exportToWord, type WordSection } from "@/lib/export-utils";

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
  { key: "kpi", label: "KPI метрики", icon: Activity, desc: "Визиты, пользователи, отказы, время на сайте" },
  { key: "traffic", label: "Трафик и источники", icon: TrendingUp, desc: "Данные по трафику из Метрики" },
  { key: "tasks", label: "Выполненные задачи", icon: CheckCircle2, desc: "Список завершённых задач за период" },
  { key: "worklog", label: "Проделанная работа", icon: ClipboardList, desc: "Журнал работ по проекту" },
  { key: "positions", label: "Позиции", icon: ListOrdered, desc: "Ключевые слова и их позиции" },
  { key: "errors", label: "Ошибки сайта", icon: AlertTriangle, desc: "Обнаруженные ошибки за период" },
  { key: "conclusions", label: "Выводы и рекомендации", icon: Bot, desc: "AI-анализ или ручные выводы" },
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

interface CustomField {
  id: string;
  title: string;
  value: string;
}

export default function ReportsPage() {
  const { user } = useAuth();
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [periodPreset, setPeriodPreset] = useState("lastMonth");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [sections, setSections] = useState<Record<string, boolean>>({
    kpi: true, traffic: true, tasks: true, worklog: true, positions: true, errors: true, conclusions: true,
  });
  const [generating, setGenerating] = useState(false);
  const [emailDialogOpen, setEmailDialogOpen] = useState(false);
  const [clientEmail, setClientEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [lastGeneratedFormat, setLastGeneratedFormat] = useState<string | null>(null);
  const [comparisonMode, setComparisonMode] = useState<ComparisonMode>("previous");

  // Custom fields
  const [customFields, setCustomFields] = useState<CustomField[]>([]);
  const [conclusions, setConclusions] = useState("");
  const [generatingAi, setGeneratingAi] = useState(false);

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

  const compDateRange = useMemo(() => {
    if (comparisonMode === "none") return null;
    const days = differenceInDays(dateRange.to, dateRange.from);
    if (comparisonMode === "previous") {
      return { from: subDays(dateRange.from, days + 1), to: subDays(dateRange.from, 1) };
    }
    return { from: subYears(dateRange.from, 1), to: subYears(dateRange.to, 1) };
  }, [dateRange, comparisonMode]);

  const compPeriodLabel = compDateRange
    ? `${format(compDateRange.from, "dd.MM.yyyy")} — ${format(compDateRange.to, "dd.MM.yyyy")}`
    : "";

  const enabledSections = Object.entries(sections).filter(([, v]) => v).map(([k]) => k);

  // Load report data (all sources)
  const { data: reportData, isLoading: loadingData } = useQuery({
    queryKey: ["report-data", selectedProject, periodPreset, customFrom, customTo],
    queryFn: async () => {
      if (!selectedProject) return null;
      const fromStr = format(dateRange.from, "yyyy-MM-dd");
      const toStr = format(dateRange.to, "yyyy-MM-dd");

      const [tasksRes, workLogsRes, keywordsRes, analyticsRes, metrikaRes, errorsRes] = await Promise.all([
        supabase.from("crm_tasks")
          .select("title, stage, priority, deadline, assignee:team_members!crm_tasks_assignee_id_fkey(full_name)")
          .eq("project_id", selectedProject)
          .eq("stage", "Завершена"),
        supabase.from("work_logs")
          .select("description, category, status, task_date, link_url")
          .eq("project_id", selectedProject)
          .gte("task_date", fromStr)
          .lte("task_date", toStr)
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
        supabase.from("metrika_stats")
          .select("*")
          .eq("project_id", selectedProject)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase.from("site_errors")
          .select("url, error_type, status, detected_at, source")
          .eq("project_id", selectedProject)
          .gte("detected_at", fromStr)
          .order("detected_at", { ascending: false })
          .limit(50),
      ]);

      const metrika = metrikaRes.data;
      const totalVisits = metrika?.total_visits || 0;
      const totalUsers = metrika?.total_users || 0;
      const bounceRate = metrika?.bounce_rate || 0;
      const avgDuration = metrika?.avg_duration_seconds || 0;
      const trafficSources = (metrika?.traffic_sources as any[]) || [];
      const visitsByDay = (metrika?.visits_by_day as any[]) || [];

      return {
        tasks: tasksRes.data || [],
        workLogs: workLogsRes.data || [],
        keywords: keywordsRes.data || [],
        analytics: analyticsRes.data || [],
        errors: errorsRes.data || [],
        metrika: {
          totalVisits,
          totalUsers,
          bounceRate,
          avgDuration,
          trafficSources,
          visitsByDay,
        },
      };
    },
    enabled: !!selectedProject,
  });

  // Comparison data
  const { data: compData } = useQuery({
    queryKey: ["report-comp-data", selectedProject, comparisonMode, periodPreset, customFrom, customTo],
    queryFn: async () => {
      if (!selectedProject || !compDateRange) return null;
      const fromStr = format(compDateRange.from, "yyyy-MM-dd");
      const toStr = format(compDateRange.to, "yyyy-MM-dd");

      const [tasksRes, workLogsRes, analyticsRes, metrikaRes] = await Promise.all([
        supabase.from("crm_tasks")
          .select("id")
          .eq("project_id", selectedProject)
          .eq("stage", "Завершена")
          .gte("updated_at", fromStr)
          .lte("updated_at", toStr),
        supabase.from("work_logs")
          .select("id")
          .eq("project_id", selectedProject)
          .gte("task_date", fromStr)
          .lte("task_date", toStr),
        supabase.from("project_analytics")
          .select("month, organic_traffic, avg_position")
          .eq("project_id", selectedProject)
          .gte("month", fromStr)
          .lte("month", toStr),
        supabase.from("metrika_stats")
          .select("total_visits, total_users, bounce_rate")
          .eq("project_id", selectedProject)
          .order("fetched_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      return {
        tasksCount: tasksRes.data?.length || 0,
        workLogsCount: workLogsRes.data?.length || 0,
        totalTraffic: analyticsRes.data?.reduce((s, a) => s + (a.organic_traffic || 0), 0) || 0,
        avgPosition: analyticsRes.data?.length
          ? analyticsRes.data.reduce((s, a) => s + Number(a.avg_position || 0), 0) / analyticsRes.data.length
          : 0,
        totalVisits: metrikaRes.data?.total_visits || 0,
        totalUsers: metrikaRes.data?.total_users || 0,
        bounceRate: metrikaRes.data?.bounce_rate || 0,
      };
    },
    enabled: !!selectedProject && comparisonMode !== "none" && !!compDateRange,
  });

  const toggleSection = (key: string) => {
    setSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const calcDelta = (current: number, prev: number) => {
    if (prev === 0) return current > 0 ? 100 : 0;
    return Math.round(((current - prev) / prev) * 100);
  };

  const deltaLabel = (current: number, prev: number) => {
    const d = calcDelta(current, prev);
    if (d === 0) return "0%";
    return `${d > 0 ? "+" : ""}${d}%`;
  };

  const deltaColor = (current: number, prev: number, invert = false) => {
    const d = calcDelta(current, prev);
    if (d === 0) return "text-muted-foreground";
    const isPositive = invert ? d < 0 : d > 0;
    return isPositive ? "text-green-500" : "text-destructive";
  };

  // Add custom field
  const addCustomField = () => {
    setCustomFields(prev => [...prev, { id: crypto.randomUUID(), title: "", value: "" }]);
  };

  const updateCustomField = (id: string, field: Partial<CustomField>) => {
    setCustomFields(prev => prev.map(f => f.id === id ? { ...f, ...field } : f));
  };

  const removeCustomField = (id: string) => {
    setCustomFields(prev => prev.filter(f => f.id !== id));
  };

  // AI conclusions generation
  const handleGenerateAiConclusions = useCallback(async () => {
    if (!reportData || !project) return;
    setGeneratingAi(true);
    try {
      const context = {
        projectName: project.name,
        projectUrl: project.url,
        period: periodLabel,
        visits: reportData.metrika.totalVisits,
        users: reportData.metrika.totalUsers,
        bounceRate: reportData.metrika.bounceRate,
        avgDuration: reportData.metrika.avgDuration,
        tasksCompleted: reportData.tasks.length,
        workLogEntries: reportData.workLogs.length,
        keywordsTracked: reportData.keywords.length,
        top5Keywords: reportData.keywords.slice(0, 5).map(k => `${k.keyword} (позиция ${k.position})`),
        errorsCount: reportData.errors.length,
        trafficSources: reportData.metrika.trafficSources,
      };

      const { data, error } = await supabase.functions.invoke("generate-ai-summary", {
        body: {
          project_id: project.id,
          language: "ru",
          mode: "deep_analysis",
          live_metrics: {
            dateFrom: context.period,
            dateTo: context.period,
            visits: context.visits,
            users: context.users,
            bounceRate: context.bounceRate,
            avgDuration: context.avgDuration,
            topPages: [],
            sourceBreakdown: (context.trafficSources || []).map((s: any) => ({
              name: s.source || s.name,
              value: s.visits || s.value,
              pct: s.pct || 0,
            })),
            keywordsContext: {
              total: context.keywordsTracked,
              topKeywords: context.top5Keywords,
              top3: 0, top10: 0, top30: 0,
              avgPosition: 0, improved: 0, declined: 0,
            },
            selectedChannels: ["search", "direct", "ad"],
          },
        },
      });

      if (error) throw error;
      const general = data?.summary?.general;
      const parts: string[] = [];
      if (general?.happened) parts.push(general.happened);
      if (general?.why) parts.push(general.why);
      if (general?.recommendation) parts.push(general.recommendation);
      if (data?.business_insight) parts.push(data.business_insight);
      if (data?.goals_insight) parts.push(data.goals_insight);
      if (data?.recommendations?.length) {
        parts.push(data.recommendations.map((r: any) => `[${r.priority}] ${r.text}`).join("\n"));
      }
      const summary = parts.length > 0 ? parts.join("\n\n") : "Не удалось сгенерировать выводы";
      setConclusions(summary);
      toast.success("AI-выводы сгенерированы");
    } catch (err: any) {
      console.error(err);
      toast.error("Ошибка генерации AI-выводов");
    } finally {
      setGeneratingAi(false);
    }
  }, [reportData, project, periodLabel]);

  // Build PDF HTML
  const buildPdfHtml = useCallback(() => {
    if (!reportData || !project) return "";
    const esc = (s: string) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const sectionTitle = (title: string, icon: string) => `
      <div style="display:flex;align-items:center;gap:10px;margin:28px 0 14px;page-break-inside:avoid;">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#f97316,#ea580c);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">
          ${icon}
        </div>
        <h2 style="font-size:18px;font-weight:700;margin:0;color:#1a1a1b;">${esc(title)}</h2>
      </div>`;

    const kpiCard = (label: string, value: string, delta?: string, deltaClr?: string) => `
      <div style="flex:1;min-width:120px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:14px 16px;">
        <div style="font-size:11px;color:#64748b;margin-bottom:4px;">${esc(label)}</div>
        <div style="font-size:22px;font-weight:700;color:#0f172a;">${esc(value)}</div>
        ${delta ? `<div style="font-size:12px;font-weight:600;color:${deltaClr || '#64748b'};margin-top:2px;">${esc(delta)}</div>` : ""}
      </div>`;

    const tableHtml = (headers: string[], rows: string[][], accentCol?: number) => {
      let h = `<table style="width:100%;border-collapse:collapse;font-size:11px;margin:8px 0 20px;">`;
      h += `<thead><tr>`;
      headers.forEach(hdr => { h += `<th style="text-align:left;padding:8px 10px;background:#f1f5f9;border-bottom:2px solid #e2e8f0;font-weight:600;color:#334155;">${esc(hdr)}</th>`; });
      h += `</tr></thead><tbody>`;
      rows.forEach((row, ri) => {
        h += `<tr style="background:${ri % 2 === 0 ? "#fff" : "#fafbfc"};">`;
        row.forEach((cell, ci) => {
          const bold = ci === accentCol ? "font-weight:600;" : "";
          h += `<td style="padding:7px 10px;border-bottom:1px solid #f1f5f9;${bold}">${esc(String(cell))}</td>`;
        });
        h += `</tr>`;
      });
      h += `</tbody></table>`;
      return h;
    };

    let html = `<div style="font-family:'Segoe UI',system-ui,-apple-system,sans-serif;color:#1a1a1b;max-width:800px;margin:0 auto;">`;

    // ===== COVER =====
    html += `<div style="background:linear-gradient(135deg,#0f172a,#1e293b);padding:40px 32px;border-radius:12px;margin-bottom:24px;">`;
    html += `<div style="display:flex;align-items:center;gap:12px;margin-bottom:16px;">`;
    if (project.logo_url) {
      html += `<img src="${project.logo_url}" style="width:48px;height:48px;border-radius:10px;object-fit:cover;" />`;
    }
    html += `<div>
      <h1 style="color:#fff;margin:0;font-size:26px;font-weight:800;letter-spacing:-0.5px;">Отчёт по проекту</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:14px;">${esc(project.name)}</p>
    </div></div>`;
    html += `<div style="display:flex;flex-wrap:wrap;gap:16px;margin-top:16px;">`;
    html += `<div style="background:rgba(255,255,255,0.08);padding:8px 16px;border-radius:8px;font-size:12px;color:#cbd5e1;">
      📅 Период: ${periodLabel}</div>`;
    if (project.url) html += `<div style="background:rgba(255,255,255,0.08);padding:8px 16px;border-radius:8px;font-size:12px;color:#f97316;">
      🔗 ${esc(project.url)}</div>`;
    if (comparisonMode !== "none" && compPeriodLabel) {
      html += `<div style="background:rgba(249,115,22,0.1);padding:8px 16px;border-radius:8px;font-size:12px;color:#fb923c;">
        ⚖️ vs ${compPeriodLabel}</div>`;
    }
    html += `</div></div>`;

    // ===== COMPARISON SUMMARY =====
    if (comparisonMode !== "none" && compData) {
      const m = reportData.metrika;
      const fmt = (v: number) => `${v >= 0 ? "+" : ""}${v}%`;
      const clr = (v: number, inv = false) => {
        const pos = inv ? v < 0 : v > 0;
        return v === 0 ? "#64748b" : pos ? "#16a34a" : "#dc2626";
      };
      const dVisits = calcDelta(m.totalVisits, compData.totalVisits);
      const dUsers = calcDelta(m.totalUsers, compData.totalUsers);
      const dBounce = calcDelta(m.bounceRate, compData.bounceRate);
      const dTasks = calcDelta(reportData.tasks.length, compData.tasksCount);

      html += `<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:10px;padding:16px 20px;margin-bottom:20px;">`;
      html += `<div style="font-size:13px;font-weight:700;color:#92400e;margin-bottom:8px;">📊 Сравнение с ${comparisonMode === "previous" ? "предыдущим периодом" : "прошлым годом"}</div>`;
      html += `<div style="display:flex;flex-wrap:wrap;gap:16px;font-size:12px;">`;
      html += `<span>Визиты: <b>${m.totalVisits.toLocaleString()}</b> <span style="color:${clr(dVisits)}">(${fmt(dVisits)})</span></span>`;
      html += `<span>Посетители: <b>${m.totalUsers.toLocaleString()}</b> <span style="color:${clr(dUsers)}">(${fmt(dUsers)})</span></span>`;
      html += `<span>Отказы: <b>${Number(m.bounceRate).toFixed(1)}%</b> <span style="color:${clr(dBounce, true)}">(${fmt(dBounce)})</span></span>`;
      html += `<span>Задачи: <b>${reportData.tasks.length}</b> <span style="color:${clr(dTasks)}">(${fmt(dTasks)})</span></span>`;
      html += `</div></div>`;
    }

    // ===== KPI SECTION =====
    if (sections.kpi) {
      const m = reportData.metrika;
      const durMin = Math.floor(m.avgDuration / 60);
      const durSec = String(m.avgDuration % 60).padStart(2, "0");
      html += sectionTitle("Ключевые метрики", "📈");
      html += `<div style="display:flex;flex-wrap:wrap;gap:12px;margin-bottom:20px;">`;
      html += kpiCard("Визиты", m.totalVisits.toLocaleString(),
        compData ? deltaLabel(m.totalVisits, compData.totalVisits) : undefined,
        compData ? (calcDelta(m.totalVisits, compData.totalVisits) >= 0 ? "#16a34a" : "#dc2626") : undefined);
      html += kpiCard("Посетители", m.totalUsers.toLocaleString(),
        compData ? deltaLabel(m.totalUsers, compData.totalUsers) : undefined,
        compData ? (calcDelta(m.totalUsers, compData.totalUsers) >= 0 ? "#16a34a" : "#dc2626") : undefined);
      html += kpiCard("Отказы", `${Number(m.bounceRate).toFixed(1)}%`,
        compData ? deltaLabel(m.bounceRate, compData.bounceRate) : undefined,
        compData ? (calcDelta(m.bounceRate, compData.bounceRate) <= 0 ? "#16a34a" : "#dc2626") : undefined);
      html += kpiCard("Ср. время", `${durMin}:${durSec}`);
      html += `</div>`;
    }

    // ===== TRAFFIC SOURCES =====
    if (sections.traffic && reportData.metrika.trafficSources.length > 0) {
      html += sectionTitle("Источники трафика", "🔍");
      html += tableHtml(
        ["Источник", "Визиты", "Доля"],
        reportData.metrika.trafficSources.map((s: any) => {
          const name = s.name || s.source || "Неизвестно";
          const visits = s.value || s.visits || 0;
          const pct = reportData.metrika.totalVisits > 0
            ? ((visits / reportData.metrika.totalVisits) * 100).toFixed(1) + "%"
            : "0%";
          return [name, String(visits), pct];
        }),
        0
      );
    }

    // ===== TRAFFIC BY DAY (simple text table) =====
    if (sections.traffic && reportData.metrika.visitsByDay.length > 0) {
      const daily = reportData.metrika.visitsByDay as any[];
      const last14 = daily.slice(-14);
      if (last14.length > 0) {
        html += `<div style="font-size:12px;font-weight:600;color:#334155;margin:12px 0 6px;">Динамика посещений (последние ${last14.length} дн.)</div>`;
        html += tableHtml(
          ["Дата", "Визиты"],
          last14.map((d: any) => [
            d.date ? format(new Date(d.date), "dd.MM.yyyy") : d.dateStr || "",
            String(d.visits || 0),
          ])
        );
      }
    }

    // ===== TASKS =====
    if (sections.tasks && reportData.tasks.length > 0) {
      html += sectionTitle(`Выполненные задачи (${reportData.tasks.length})`, "✅");
      html += tableHtml(
        ["Задача", "Приоритет", "Исполнитель", "Дедлайн"],
        reportData.tasks.map((t: any) => [
          t.title,
          t.priority === "high" ? "🔴 Высокий" : t.priority === "low" ? "🟢 Низкий" : "🟡 Средний",
          t.assignee?.full_name || "—",
          t.deadline ? format(new Date(t.deadline), "dd.MM.yyyy") : "—",
        ]),
        0
      );
    }

    // ===== WORKLOG =====
    if (sections.worklog && reportData.workLogs.length > 0) {
      const catLabels: Record<string, string> = { seo: "SEO", content: "Контент", tech: "Техничка", links: "Ссылки" };
      html += sectionTitle(`Проделанная работа (${reportData.workLogs.length})`, "📋");
      html += tableHtml(
        ["Дата", "Описание", "Категория", "Статус"],
        reportData.workLogs.map((w: any) => [
          format(new Date(w.task_date), "dd.MM.yyyy"),
          w.description,
          catLabels[w.category] || w.category,
          w.status === "done" ? "✅ Готово" : "🔄 В работе",
        ]),
        1
      );
    }

    // ===== POSITIONS =====
    if (sections.positions && reportData.keywords.length > 0) {
      html += sectionTitle(`Позиции ключевых слов (${reportData.keywords.length})`, "🔑");
      html += tableHtml(
        ["Запрос", "Позиция", "Изменение"],
        reportData.keywords.map((k: any) => {
          const ch = k.position_change;
          const arrow = ch > 0 ? "↑" : ch < 0 ? "↓" : "—";
          return [k.keyword, String(k.position), `${arrow} ${Math.abs(ch)}`];
        }),
        0
      );
    }

    // ===== ANALYTICS =====
    if (sections.traffic && reportData.analytics.length > 0) {
      html += sectionTitle("Аналитика трафика (по месяцам)", "📊");
      html += tableHtml(
        ["Месяц", "Органический трафик", "Ср. позиция"],
        reportData.analytics.map((a: any) => [
          format(new Date(a.month), "MM.yyyy"),
          String(a.organic_traffic),
          Number(a.avg_position).toFixed(1),
        ])
      );
    }

    // ===== ERRORS =====
    if (sections.errors && reportData.errors.length > 0) {
      html += sectionTitle(`Ошибки сайта (${reportData.errors.length})`, "⚠️");
      html += tableHtml(
        ["URL", "Тип ошибки", "Источник", "Дата"],
        reportData.errors.map((e: any) => [
          e.url || "—",
          e.error_type,
          e.source || "yandex",
          e.detected_at ? format(new Date(e.detected_at), "dd.MM.yyyy") : "—",
        ]),
        1
      );
    }

    // ===== CUSTOM FIELDS =====
    if (customFields.length > 0) {
      customFields.filter(f => f.title || f.value).forEach(f => {
        html += `<div style="margin:24px 0;page-break-inside:avoid;">`;
        if (f.title) html += `<h3 style="font-size:16px;font-weight:700;color:#0f172a;margin:0 0 8px;">${esc(f.title)}</h3>`;
        if (f.value) html += `<div style="font-size:13px;line-height:1.7;color:#334155;white-space:pre-line;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:14px 18px;">${esc(f.value)}</div>`;
        html += `</div>`;
      });
    }

    // ===== CONCLUSIONS =====
    if (sections.conclusions && conclusions) {
      html += `<div style="margin:28px 0;page-break-inside:avoid;">`;
      html += `<div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;">
        <div style="width:36px;height:36px;border-radius:10px;background:linear-gradient(135deg,#8b5cf6,#6d28d9);display:flex;align-items:center;justify-content:center;font-size:18px;color:#fff;">🤖</div>
        <h2 style="font-size:18px;font-weight:700;margin:0;color:#1a1a1b;">Выводы и рекомендации</h2>
      </div>`;
      html += `<div style="font-size:13px;line-height:1.8;color:#334155;white-space:pre-line;background:linear-gradient(135deg,#faf5ff,#f5f3ff);border:1px solid #e9d5ff;border-radius:10px;padding:18px 22px;">${esc(conclusions)}</div>`;
      html += `</div>`;
    }

    // ===== FOOTER =====
    html += `<div style="margin-top:40px;padding-top:20px;border-top:1px solid #e2e8f0;display:flex;justify-content:space-between;align-items:center;">`;
    html += `<div style="font-size:10px;color:#94a3b8;">Сгенерировано StatPulse · ${format(new Date(), "dd.MM.yyyy HH:mm")}</div>`;
    html += `<div style="font-size:10px;color:#94a3b8;">Конфиденциально</div>`;
    html += `</div>`;

    html += `</div>`;
    return html;
  }, [reportData, project, sections, periodLabel, comparisonMode, compPeriodLabel, compData, customFields, conclusions]);

  const handleGeneratePdf = useCallback(async () => {
    if (!reportData || !project) return;
    setGenerating(true);
    try {
      const htmlContent = buildPdfHtml();
      if (!htmlContent) { toast.error("Нет данных для отчёта"); return; }

      const container = document.createElement("div");
      container.innerHTML = htmlContent;
      container.style.width = "210mm";
      container.style.position = "absolute";
      container.style.left = "-9999px";
      document.body.appendChild(container);

      const html2pdf = (await import("html2pdf.js")).default;
      await html2pdf().set({
        margin: [10, 10, 10, 10],
        filename: `Отчёт_${project.name}_${format(dateRange.from, "dd.MM.yyyy")}.pdf`,
        image: { type: "jpeg", quality: 0.95 },
        html2canvas: { scale: 2, useCORS: true, logging: false },
        jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
        pagebreak: { mode: ["avoid-all", "css", "legacy"] },
      }).from(container).save();

      document.body.removeChild(container);
      setLastGeneratedFormat("pdf");
      toast.success("PDF-отчёт сгенерирован");
    } catch (err: any) {
      toast.error(err.message || "Ошибка генерации PDF");
    } finally {
      setGenerating(false);
    }
  }, [reportData, project, buildPdfHtml, dateRange]);

  const buildWordSections = useCallback((): WordSection[] => {
    if (!reportData || !project) return [];
    const result: WordSection[] = [];

    if (sections.kpi) {
      const m = reportData.metrika;
      const durMin = Math.floor(m.avgDuration / 60);
      const durSec = String(m.avgDuration % 60).padStart(2, "0");
      result.push({
        title: "Ключевые метрики",
        table: {
          headers: ["Метрика", "Значение"],
          rows: [
            ["Визиты", m.totalVisits.toLocaleString()],
            ["Посетители", m.totalUsers.toLocaleString()],
            ["Отказы", `${Number(m.bounceRate).toFixed(1)}%`],
            ["Ср. время на сайте", `${durMin}:${durSec}`],
          ],
        },
      });
    }

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
            String(k.position),
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
            String(a.organic_traffic),
            Number(a.avg_position).toFixed(1),
          ]),
        },
      });
    }

    if (sections.errors && reportData.errors.length > 0) {
      result.push({
        title: "Ошибки сайта",
        table: {
          headers: ["URL", "Тип ошибки", "Источник", "Дата"],
          rows: reportData.errors.map((e: any) => [
            e.url || "—",
            e.error_type,
            e.source || "yandex",
            e.detected_at ? format(new Date(e.detected_at), "dd.MM.yyyy") : "—",
          ]),
        },
      });
    }

    if (conclusions) {
      result.push({ title: "Выводы и рекомендации", content: conclusions });
    }

    customFields.filter(f => f.title || f.value).forEach(f => {
      result.push({ title: f.title || "Дополнительно", content: f.value });
    });

    return result;
  }, [reportData, project, sections, conclusions, customFields]);

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
      const reportUrl = `${window.location.origin}/report/${selectedProject}`;
      await navigator.clipboard.writeText(reportUrl);
      toast.success(`Ссылка на отчёт скопирована. Отправьте её на ${clientEmail}`);
      setEmailDialogOpen(false);
    } catch (err: any) {
      toast.error(err.message || "Ошибка отправки");
    } finally {
      setSending(false);
    }
  }, [clientEmail, selectedProject]);

  const sectionCounts = useMemo(() => {
    if (!reportData) return {};
    return {
      kpi: 4,
      traffic: (reportData.metrika?.trafficSources?.length || 0) + (reportData.analytics?.length || 0),
      tasks: reportData.tasks.length,
      worklog: reportData.workLogs.length,
      positions: reportData.keywords.length,
      errors: reportData.errors.length,
      conclusions: conclusions ? 1 : 0,
    };
  }, [reportData, conclusions]);

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
                    <Button key={p.key} variant={periodPreset === p.key ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setPeriodPreset(p.key)}>
                      {p.label}
                    </Button>
                  ))}
                </div>
                {periodPreset === "custom" && (
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <div><Label className="text-[11px]">С</Label><Input type="date" value={customFrom} onChange={e => setCustomFrom(e.target.value)} className="mt-1" /></div>
                    <div><Label className="text-[11px]">По</Label><Input type="date" value={customTo} onChange={e => setCustomTo(e.target.value)} className="mt-1" /></div>
                  </div>
                )}
                {selectedProject && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <Calendar className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">{periodLabel}</span>
                  </div>
                )}

                <Separator className="my-3" />

                {/* Comparison */}
                <div>
                  <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <GitCompareArrows className="h-3.5 w-3.5" /> Сравнение
                  </Label>
                  <div className="flex flex-wrap gap-1.5 mt-1.5">
                    {COMPARISON_MODES.map(m => (
                      <Button key={m.key} variant={comparisonMode === m.key ? "default" : "outline"} size="sm" className="text-xs h-7" onClick={() => setComparisonMode(m.key)}>
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
                  const count = sectionCounts[s.key as keyof typeof sectionCounts] || 0;
                  return (
                    <div key={s.key} className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border transition-all",
                      enabled ? "border-primary/30 bg-primary/5" : "border-border bg-card opacity-60"
                    )}>
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center shrink-0", enabled ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground")}>
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

          {/* Custom Fields */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground">Кастомные блоки</Label>
                <Button variant="ghost" size="sm" className="text-xs h-7 gap-1" onClick={addCustomField}>
                  <Plus className="h-3.5 w-3.5" /> Добавить
                </Button>
              </div>
              {customFields.length === 0 && (
                <p className="text-xs text-muted-foreground">Добавьте свои текстовые блоки в отчёт</p>
              )}
              {customFields.map(f => (
                <div key={f.id} className="space-y-2 p-3 rounded-lg border border-border bg-background">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="Заголовок блока..."
                      value={f.title}
                      onChange={e => updateCustomField(f.id, { title: e.target.value })}
                      className="h-8 text-sm"
                    />
                    <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => removeCustomField(f.id)}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Textarea
                    placeholder="Содержимое..."
                    value={f.value}
                    onChange={e => updateCustomField(f.id, { value: e.target.value })}
                    rows={3}
                    className="text-sm"
                  />
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Conclusions */}
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" /> Выводы и рекомендации
                </Label>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-xs h-7 gap-1"
                  disabled={!selectedProject || !reportData || generatingAi}
                  onClick={handleGenerateAiConclusions}
                >
                  {generatingAi ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}
                  Сгенерировать AI
                </Button>
              </div>
              <Textarea
                placeholder="Напишите выводы вручную или сгенерируйте с помощью AI..."
                value={conclusions}
                onChange={e => setConclusions(e.target.value)}
                rows={6}
                className="text-sm"
              />
            </CardContent>
          </Card>
        </div>

        {/* Right - Actions & Summary */}
        <div className="space-y-4">
          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Download className="h-4 w-4 text-primary" /> Скачать отчёт
              </h3>
              <Button className="w-full gap-2 justify-start" variant="outline"
                disabled={!selectedProject || enabledSections.length === 0 || generating}
                onClick={handleGeneratePdf}>
                {generating && lastGeneratedFormat !== "docx" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4 text-destructive" />}
                Скачать PDF
              </Button>
              <Button className="w-full gap-2 justify-start" variant="outline"
                disabled={!selectedProject || enabledSections.length === 0 || generating}
                onClick={handleGenerateDocx}>
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
              <p className="text-xs text-muted-foreground">Отправьте ссылку на онлайн-отчёт клиенту</p>
              <Button className="w-full gap-2" disabled={!selectedProject}
                onClick={() => { setClientEmail(project?.client_email || ""); setEmailDialogOpen(true); }}>
                <Send className="h-4 w-4" /> Отправить на email
              </Button>
            </CardContent>
          </Card>

          <Card className="border-border bg-card">
            <CardContent className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Eye className="h-4 w-4 text-primary" /> Онлайн-отчёт
              </h3>
              <Button className="w-full gap-2" variant="outline" disabled={!selectedProject}
                onClick={() => window.open(`/report/${selectedProject}`, "_blank")}>
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
                    <span>Визиты</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{reportData.metrika.totalVisits.toLocaleString()}</span>
                      {compData && comparisonMode !== "none" && (
                        <span className={cn("text-[10px] font-medium", deltaColor(reportData.metrika.totalVisits, compData.totalVisits))}>
                          {deltaLabel(reportData.metrika.totalVisits, compData.totalVisits)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>Посетители</span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-foreground font-medium">{reportData.metrika.totalUsers.toLocaleString()}</span>
                      {compData && comparisonMode !== "none" && (
                        <span className={cn("text-[10px] font-medium", deltaColor(reportData.metrika.totalUsers, compData.totalUsers))}>
                          {deltaLabel(reportData.metrika.totalUsers, compData.totalUsers)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between">
                    <span>Задач выполнено</span>
                    <span className="text-foreground font-medium">{reportData.tasks.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Записей работ</span>
                    <span className="text-foreground font-medium">{reportData.workLogs.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ключевых слов</span>
                    <span className="text-foreground font-medium">{reportData.keywords.length}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Ошибок</span>
                    <span className="text-foreground font-medium">{reportData.errors.length}</span>
                  </div>
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
              <Input type="email" value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="client@company.com" className="mt-1" />
            </div>
            {project && (
              <div className="text-xs text-muted-foreground space-y-1">
                <p><span className="text-foreground font-medium">Проект:</span> {project.name}</p>
                <p><span className="text-foreground font-medium">Период:</span> {periodLabel}</p>
                <p><span className="text-foreground font-medium">Разделы:</span> {enabledSections.length}</p>
              </div>
            )}
            <Button className="w-full gap-2" onClick={handleSendEmail} disabled={sending || !clientEmail.trim()}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Отправить ссылку на отчёт
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
