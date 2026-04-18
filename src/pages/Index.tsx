import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  FolderKanban, TrendingUp, Key, AlertTriangle, Users,
  ArrowUp, ArrowDown, Loader2, CheckCircle2, FileText, Calendar, Sparkles,
} from "lucide-react";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
} from "recharts";
import { format, isPast, parseISO, subMonths, startOfMonth, endOfMonth } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

const STAGE_COLORS: Record<string, string> = {
  "В работе": "#4CAF50",
  "На паузе": "#FF9800",
};

const Index = () => {
  const navigate = useNavigate();
  const { user, profile } = useAuth();

  // ─── Projects ───
  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["dashboard-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, url, privacy, efficiency, created_at, deadline, seo_specialist_id, account_manager_id")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // ─── Tasks ───
  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["dashboard-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, stage, deadline, assignee_id, project_id, stage_color, priority")
        .order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // ─── Team members ───
  const { data: members = [] } = useQuery({
    queryKey: ["dashboard-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, role")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  // ─── Metrika stats (for traffic card & chart) ───
  const { data: metrikaStats = [] } = useQuery({
    queryKey: ["dashboard-metrika"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats")
        .select("project_id, total_visits, total_users, date_from, date_to, fetched_at")
        .order("fetched_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
  });

  // ─── Computed metrics ───
  const activeProjects = projects.filter(p => p.privacy === "В работе" || !p.privacy).length;
  const pausedProjects = projects.filter(p => p.privacy === "На паузе").length;
  const completedProjects = 0;

  const overdueTasks = useMemo(
    () => tasks.filter(t => t.deadline && isPast(parseISO(t.deadline)) && t.stage !== "Завершена"),
    [tasks]
  );

  const totalTasks = tasks.length;
  const completedTasks = tasks.filter(t => t.stage === "Завершена").length;
  const taskCompletionPct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;

  // Total traffic from latest metrika snapshots (deduplicated by project)
  const totalTraffic = useMemo(() => {
    const seen = new Set<string>();
    let sum = 0;
    for (const s of metrikaStats) {
      if (!seen.has(s.project_id)) {
        seen.add(s.project_id);
        sum += s.total_visits;
      }
    }
    return sum;
  }, [metrikaStats]);

  // ─── Manager KPI: % of completed tasks per assignee ───
  const managerKpi = useMemo(() => {
    const map: Record<string, { total: number; done: number; name: string }> = {};
    for (const t of tasks) {
      if (!t.assignee_id) continue;
      if (!map[t.assignee_id]) {
        const m = members.find(m => m.id === t.assignee_id);
        map[t.assignee_id] = { total: 0, done: 0, name: m?.full_name || "—" };
      }
      map[t.assignee_id].total++;
      if (t.stage === "Завершена") map[t.assignee_id].done++;
    }
    return Object.values(map)
      .map(v => ({ name: v.name, pct: v.total > 0 ? Math.round((v.done / v.total) * 100) : 0, total: v.total, done: v.done }))
      .sort((a, b) => b.pct - a.pct)
      .slice(0, 5);
  }, [tasks, members]);

  // ─── Projects by stage (for pie/bar chart) ───
  const projectsByStage = useMemo(() => {
    const map: Record<string, number> = {};
    for (const p of projects) {
      const stage = p.privacy || "Новые заявки";
      map[stage] = (map[stage] || 0) + 1;
    }
    return Object.entries(map).map(([name, value]) => ({
      name,
      value,
      color: STAGE_COLORS[name] || "#9E9E9E",
    }));
  }, [projects]);

  // ─── Projects created per month (last 6 months, for line chart) ───
  const projectsByMonth = useMemo(() => {
    const months: { month: string; count: number; tasks_done: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(new Date(), i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const count = projects.filter(p => {
        const c = parseISO(p.created_at);
        return c >= start && c <= end;
      }).length;
      const tasksDone = tasks.filter(t => {
        if (t.stage !== "Завершена" || !t.deadline) return false;
        const dl = parseISO(t.deadline);
        return dl >= start && dl <= end;
      }).length;
      months.push({
        month: format(d, "LLL", { locale: ruLocale }),
        count,
        tasks_done: tasksDone,
      });
    }
    return months;
  }, [projects, tasks]);

  // ─── Top projects by efficiency ───
  const topProjects = useMemo(() =>
    [...projects]
      .filter(p => (p.efficiency || 0) > 0)
      .sort((a, b) => (b.efficiency || 0) - (a.efficiency || 0))
      .slice(0, 5)
      .map(p => ({ name: p.url || p.name, value: p.efficiency || 0 })),
    [projects]
  );

  // ─── Overdue projects (from projects with deadline-like logic via tasks) ───
  const overdueProjects = useMemo(() => {
    const projectOverdue: Record<string, { name: string; url: string; deadline: string; assignee: string; stage: string; stageColor: string; projectId: string }> = {};
    for (const t of overdueTasks) {
      if (t.project_id && !projectOverdue[t.project_id]) {
        const p = projects.find(pr => pr.id === t.project_id);
        projectOverdue[t.project_id] = {
          name: p?.name || "—",
          url: p?.url || "—",
          deadline: t.deadline!,
          assignee: members.find(m => m.id === t.assignee_id)?.full_name || "—",
          stage: p?.privacy || "—",
          stageColor: STAGE_COLORS[p?.privacy || ""] || "#9E9E9E",
          projectId: t.project_id,
        };
      }
    }
    return Object.values(projectOverdue);
  }, [overdueTasks, projects, members]);

  // ─── Upcoming reports (projects with deadline) ───
  const upcomingReports = useMemo(() => {
    const now = new Date();
    return projects
      .filter(p => p.deadline)
      .map(p => {
        const deadlineDate = parseISO(p.deadline!);
        const diffMs = deadlineDate.getTime() - now.getTime();
        const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
        const seo = members.find(m => m.id === p.seo_specialist_id);
        const am = members.find(m => m.id === p.account_manager_id);
        return {
          id: p.id,
          name: p.name,
          url: p.url || "—",
          deadline: p.deadline!,
          diffDays,
          isOverdue: diffDays < 0,
          manager: am?.full_name || seo?.full_name || "—",
          stage: p.privacy || "В работе",
          stageColor: STAGE_COLORS[p.privacy || ""] || "#9E9E9E",
        };
      })
      .sort((a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime())
      .slice(0, 10);
  }, [projects, members]);

  const isLoading = loadingProjects || loadingTasks;

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Premium Header */}
      <div className="relative overflow-hidden rounded-2xl border border-border/60 bg-gradient-to-br from-card via-card to-accent/5 p-6 sm:p-8">
        <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-accent/10 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -left-20 h-64 w-64 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="relative flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-accent/10 border border-accent/20 mb-3">
              <Sparkles className="h-3 w-3 text-accent" />
              <span className="text-[10px] font-semibold text-accent uppercase tracking-wider">Сводка отдела</span>
            </div>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-foreground">
              Добро пожаловать{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name.split(" ")[0]}` : ""}
            </h1>
            <p className="text-sm text-muted-foreground mt-1.5">
              {format(new Date(), "EEEE, d MMMM yyyy", { locale: ruLocale })} · {projects.length} проектов · {tasks.length} задач
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => navigate("/crm-projects")} className="gap-1.5">
              <FolderKanban className="h-3.5 w-3.5" />
              Все проекты
            </Button>
            <Button size="sm" onClick={() => navigate("/tasks")} className="gap-1.5 bg-accent text-accent-foreground hover:bg-accent/90">
              <Calendar className="h-3.5 w-3.5" />
              Задачи
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Active projects */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Проекты в работе</p>
              <p className="text-3xl font-bold text-foreground mt-1">{activeProjects}</p>
              <p className="text-[12px] text-muted-foreground mt-1">активных проектов</p>
              {completedProjects > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <CheckCircle2 className="h-3 w-3 text-success" />
                  <span className="text-[11px] text-success font-medium">{completedProjects} завершено</span>
                </div>
              )}
            </div>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-accent" />
            </div>
          </div>
        </Card>

        {/* Traffic */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Органический трафик</p>
              <p className="text-3xl font-bold text-foreground mt-1">
                {totalTraffic > 0 ? totalTraffic.toLocaleString("ru-RU") : "—"}
              </p>
              <p className="text-[12px] text-muted-foreground mt-1">визитов за месяц</p>
              {totalTraffic > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUp className="h-3 w-3 text-success" />
                  <span className="text-[11px] font-medium text-success">данные из Метрики</span>
                </div>
              )}
            </div>
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </div>
        </Card>

        {/* Task completion rate */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Выполнение задач</p>
              <p className="text-3xl font-bold text-foreground mt-1">{taskCompletionPct}%</p>
              <p className="text-[12px] text-muted-foreground mt-1">{completedTasks} из {totalTasks} задач</p>
              <Progress value={taskCompletionPct} className="h-1.5 mt-2" />
            </div>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-accent" />
            </div>
          </div>
        </Card>

        {/* Overdue */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border border-l-[3px] border-l-destructive">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Просроченные задачи</p>
              <p className="text-3xl font-bold text-destructive mt-1">{overdueTasks.length}</p>
              <p className="text-[12px] text-muted-foreground mt-1">
                {overdueProjects.length} {overdueProjects.length === 1 ? "проект" : "проектов"}
              </p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </Card>

        {/* Manager KPI */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-3">KPI менеджеров</p>
          {managerKpi.length > 0 ? (
            <div className="space-y-2.5">
              {managerKpi.map(m => (
                <div key={m.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-foreground truncate max-w-[100px]">{m.name.split(" ")[0]}</span>
                    <span className={cn(
                      "text-[11px] font-medium",
                      m.pct >= 80 ? "text-success" : m.pct >= 50 ? "text-warning" : "text-destructive"
                    )}>{m.pct}%</span>
                  </div>
                  <Progress value={m.pct} className="h-1.5" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] text-muted-foreground text-center py-4">Нет данных</p>
          )}
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Activity line chart — projects created & tasks completed per month */}
        <Card className="lg:col-span-3 p-5 bg-card rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Активность по месяцам</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={projectsByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                />
                <Line type="monotone" dataKey="count" stroke="#2FC6F6" strokeWidth={2.5} dot={{ r: 4, fill: "#2FC6F6" }} name="Новых проектов" />
                <Line type="monotone" dataKey="tasks_done" stroke="#4CAF50" strokeWidth={2} dot={{ r: 3, fill: "#4CAF50" }} name="Задач выполнено" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="h-2 w-5 rounded" style={{ backgroundColor: "#2FC6F6" }} />
              <span className="text-[11px] text-muted-foreground">Новых проектов</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-2 w-5 rounded" style={{ backgroundColor: "#4CAF50" }} />
              <span className="text-[11px] text-muted-foreground">Задач выполнено</span>
            </div>
          </div>
        </Card>

        {/* Projects by stage bar chart */}
        <Card className="lg:col-span-2 p-5 bg-card rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Проекты по этапам</h3>
          {projectsByStage.length > 0 ? (
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart layout="vertical" data={projectsByStage} margin={{ left: 10, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={130} />
                  <Tooltip
                    contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [v + " проектов", ""]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                    {projectsByStage.map((entry, i) => (
                      <Cell key={i} fill={entry.color} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center justify-center h-[280px] text-muted-foreground text-[13px]">Нет проектов</div>
          )}
        </Card>
      </div>

      {/* Top projects by efficiency */}
      {topProjects.length > 0 && (
        <Card className="p-5 bg-card rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Топ-5 проектов по эффективности</h3>
          <div className="h-[200px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topProjects} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${v}%`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={130} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => [`${v}%`, "Эффективность"]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={18}>
                  {topProjects.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#2FC6F6" : i === 1 ? "#4CAF50" : "#E0E0E0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      )}

      {/* Overdue table */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Просроченные проекты</h3>
          <Badge variant="destructive" className="text-[11px] h-5 px-2">{overdueProjects.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Клиент</th>
                <th>Домен</th>
                <th>Дедлайн</th>
                <th>Менеджер</th>
                <th>Этап</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {overdueProjects.length > 0 ? overdueProjects.slice(0, 10).map((row, i) => (
                <tr key={i} className="bg-destructive/[0.03] hover:bg-destructive/[0.06]">
                  <td className="text-[13px] text-foreground font-medium">{row.name}</td>
                  <td className="text-[13px] text-muted-foreground">{row.url}</td>
                  <td className="text-[13px] text-destructive font-medium">
                    {format(parseISO(row.deadline), "dd.MM.yyyy")}
                  </td>
                  <td className="text-[13px] text-muted-foreground">{row.assignee}</td>
                  <td>
                    <span
                      className="px-2 py-0.5 text-[11px] rounded-full font-medium"
                      style={{ background: `${row.stageColor}20`, color: row.stageColor }}
                    >
                      {row.stage}
                    </span>
                  </td>
                  <td>
                    <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => navigate(`/crm-projects/${row.projectId}`)}>
                      Открыть
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={6} className="text-center py-8 text-[13px] text-muted-foreground">
                    Нет просроченных проектов 🎉
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      {/* Upcoming reports table */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <FileText className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Ближайшие отчёты по проектам</h3>
          <Badge variant="secondary" className="text-[11px] h-5 px-2">{upcomingReports.length}</Badge>
        </div>
        <div className="overflow-x-auto">
          <table className="crm-table">
            <thead>
              <tr>
                <th>Проект</th>
                <th>Домен</th>
                <th>Дата отчёта</th>
                <th>Осталось дней</th>
                <th>Ответственный</th>
                <th>Этап</th>
                <th>Действие</th>
              </tr>
            </thead>
            <tbody>
              {upcomingReports.length > 0 ? upcomingReports.map((row) => (
                <tr key={row.id} className={row.isOverdue ? "bg-destructive/[0.03] hover:bg-destructive/[0.06]" : "hover:bg-muted/40"}>
                  <td className="text-[13px] text-foreground font-medium">{row.name}</td>
                  <td className="text-[13px] text-muted-foreground">{row.url}</td>
                  <td className="text-[13px] font-medium">
                    <span className={row.isOverdue ? "text-destructive" : "text-foreground"}>
                      {format(parseISO(row.deadline), "dd.MM.yyyy")}
                    </span>
                  </td>
                  <td>
                    <Badge
                      variant={row.isOverdue ? "destructive" : row.diffDays <= 3 ? "outline" : "secondary"}
                      className={cn(
                        "text-[11px] h-5 px-2",
                        !row.isOverdue && row.diffDays <= 3 && "border-warning text-warning"
                      )}
                    >
                      {row.isOverdue ? `просрочен ${Math.abs(row.diffDays)} дн.` : `${row.diffDays} дн.`}
                    </Badge>
                  </td>
                  <td className="text-[13px] text-muted-foreground">{row.manager}</td>
                  <td>
                    <span
                      className="px-2 py-0.5 text-[11px] rounded-full font-medium"
                      style={{ background: `${row.stageColor}20`, color: row.stageColor }}
                    >
                      {row.stage}
                    </span>
                  </td>
                  <td>
                    <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1" onClick={() => navigate(`/reports?project=${row.id}`)}>
                      <Calendar className="h-3 w-3" />
                      Отчёт
                    </Button>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} className="text-center py-8 text-[13px] text-muted-foreground">
                    Нет проектов с установленной отчётной датой
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Index;
