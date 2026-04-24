import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, AlertTriangle, Users, FolderKanban, Calendar, ArrowRight, Clock, Trophy, TrendingUp, Bell, Scale } from "lucide-react";
import { format, isPast, parseISO, differenceInDays, startOfMonth, endOfMonth } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DONE_STAGES = ["Завершена", "Принята"];

const fmtMoney = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n);

const DirectorDashboard = () => {
  const navigate = useNavigate();
  const monthStart = startOfMonth(new Date()).toISOString();
  const monthEnd = endOfMonth(new Date()).toISOString();

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["director-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, stage, deadline, assignee_id, project_id, priority, updated_at, created_at")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["director-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, role, department")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["director-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, url, logo_url, privacy, deadline, efficiency, seo_specialist_id, account_manager_id, created_at, planned_hours, hourly_rate, monthly_budget, archived_at")
        .is("archived_at", null)
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["director-time", monthStart, monthEnd],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_time_entries")
        .select("project_id, duration_minutes, started_at")
        .gte("started_at", monthStart)
        .lte("started_at", monthEnd);
      if (error) throw error;
      return data;
    },
  });

  const { data: notifications = [] } = useQuery({
    queryKey: ["director-notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, title, body, project_id, created_at, is_read")
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return data;
    },
  });

  const memberMap = useMemo(() => {
    const m: Record<string, typeof members[number]> = {};
    members.forEach((mb) => { m[mb.id] = mb; });
    return m;
  }, [members]);

  const projectMap = useMemo(() => {
    const m: Record<string, typeof projects[number]> = {};
    projects.forEach((p) => { m[p.id] = p; });
    return m;
  }, [projects]);

  // Просроченные задачи по сотрудникам
  const overdueByEmployee = useMemo(() => {
    const map: Record<string, { name: string; role: string; count: number }> = {};
    tasks.forEach((t) => {
      if (!t.deadline || !t.assignee_id) return;
      if (DONE_STAGES.includes(t.stage)) return;
      if (!isPast(parseISO(t.deadline))) return;
      const member = memberMap[t.assignee_id];
      if (!member) return;
      if (!map[t.assignee_id]) map[t.assignee_id] = { name: member.full_name, role: member.role, count: 0 };
      map[t.assignee_id].count++;
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [tasks, memberMap]);

  // Загрузка команды
  const teamLoad = useMemo(() => {
    const map: Record<string, { name: string; role: string; active: number; overdue: number; soon: number }> = {};
    members.forEach((m) => {
      map[m.id] = { name: m.full_name, role: m.role, active: 0, overdue: 0, soon: 0 };
    });
    tasks.forEach((t) => {
      if (!t.assignee_id || DONE_STAGES.includes(t.stage)) return;
      if (!map[t.assignee_id]) return;
      map[t.assignee_id].active++;
      if (t.deadline) {
        const dl = parseISO(t.deadline);
        if (isPast(dl)) map[t.assignee_id].overdue++;
        else if (differenceInDays(dl, new Date()) <= 3) map[t.assignee_id].soon++;
      }
    });
    const arr = Object.values(map).filter((v) => v.active > 0).sort((a, b) => b.active - a.active);
    const max = Math.max(...arr.map((v) => v.active), 1);
    return arr.map((v) => ({ ...v, pct: Math.round((v.active / max) * 100) }));
  }, [tasks, members]);

  // ТОП-3 сотрудников по KPI за месяц (закрыто в срок / всего закрыто)
  const topEmployees = useMemo(() => {
    const map: Record<string, { name: string; role: string; closed: number; onTime: number; durations: number[] }> = {};
    members.forEach((m) => {
      map[m.id] = { name: m.full_name, role: m.role, closed: 0, onTime: 0, durations: [] };
    });
    tasks.forEach((t) => {
      if (!t.assignee_id || !DONE_STAGES.includes(t.stage)) return;
      if (!t.updated_at) return;
      const closedAt = parseISO(t.updated_at);
      if (closedAt < parseISO(monthStart) || closedAt > parseISO(monthEnd)) return;
      const e = map[t.assignee_id];
      if (!e) return;
      e.closed++;
      if (!t.deadline || closedAt <= parseISO(t.deadline)) e.onTime++;
      if (t.created_at) {
        const days = differenceInDays(closedAt, parseISO(t.created_at));
        if (days >= 0) e.durations.push(days);
      }
    });
    return Object.values(map)
      .filter((e) => e.closed > 0)
      .map((e) => ({
        ...e,
        onTimePct: Math.round((e.onTime / e.closed) * 100),
        avgDays: e.durations.length ? Math.round(e.durations.reduce((s, d) => s + d, 0) / e.durations.length) : 0,
        score: Math.round((e.onTime / e.closed) * 100 + e.closed * 2),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
  }, [tasks, members, monthStart, monthEnd]);

  // Рентабельность проектов (План-факт)
  const projectProfitability = useMemo(() => {
    const minutesByProject: Record<string, number> = {};
    timeEntries.forEach((e) => {
      if (!e.project_id) return;
      minutesByProject[e.project_id] = (minutesByProject[e.project_id] || 0) + (e.duration_minutes || 0);
    });
    return projects
      .filter((p) => p.privacy !== "Архив")
      .map((p) => {
        const actualHours = (minutesByProject[p.id] || 0) / 60;
        const planned = Number(p.planned_hours || 0);
        const rate = Number(p.hourly_rate || 0);
        const budget = Number(p.monthly_budget || 0);
        const cost = actualHours * rate;
        const profit = budget - cost;
        const usagePct = planned > 0 ? Math.min(999, Math.round((actualHours / planned) * 100)) : 0;
        let status: "loss" | "over" | "warn" | "ok" = "ok";
        if (budget > 0 && profit < 0) status = "loss";
        else if (planned > 0 && usagePct > 110) status = "over";
        else if (planned > 0 && usagePct > 90) status = "warn";
        return { ...p, actualHours, planned, budget, cost, profit, usagePct, status };
      })
      .filter((p) => p.planned > 0 || p.budget > 0)
      .sort((a, b) => a.profit - b.profit)
      .slice(0, 6);
  }, [projects, timeEntries]);

  const totalBudget = projectProfitability.reduce((s, p) => s + p.budget, 0);
  const totalCost = projectProfitability.reduce((s, p) => s + p.cost, 0);
  const totalProfit = totalBudget - totalCost;

  // Активные проекты
  const activeProjects = useMemo(
    () => projects.filter((p) => p.privacy !== "На паузе" && p.privacy !== "Архив"),
    [projects]
  );

  // Ближайшие дедлайны
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const items: Array<{ type: "project" | "task"; id: string; title: string; deadline: string; assignee: string; projectId?: string; diffDays: number }> = [];
    projects.forEach((p) => {
      if (!p.deadline) return;
      const am = p.account_manager_id ? memberMap[p.account_manager_id] : null;
      const seo = p.seo_specialist_id ? memberMap[p.seo_specialist_id] : null;
      items.push({ type: "project", id: p.id, title: p.name, deadline: p.deadline, assignee: am?.full_name || seo?.full_name || "—", projectId: p.id, diffDays: differenceInDays(parseISO(p.deadline), now) });
    });
    tasks.forEach((t) => {
      if (!t.deadline || DONE_STAGES.includes(t.stage)) return;
      const member = t.assignee_id ? memberMap[t.assignee_id] : null;
      items.push({ type: "task", id: t.id, title: t.title, deadline: t.deadline, assignee: member?.full_name || "—", projectId: t.project_id || undefined, diffDays: differenceInDays(parseISO(t.deadline), now) });
    });
    return items.sort((a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime()).slice(0, 8);
  }, [projects, tasks, memberMap]);

  const totalOverdue = overdueByEmployee.reduce((s, e) => s + e.count, 0);
  const totalActiveTasks = teamLoad.reduce((s, e) => s + e.active, 0);
  const lossProjects = projectProfitability.filter((p) => p.status === "loss" || p.status === "over").length;

  if (loadingTasks || loadingProjects) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground">Дашборд директора</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">KPI команды, рентабельность, топ-3 и алерты в одном экране</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <Card className="p-4 border-l-[3px] border-l-destructive">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Просрочено</p>
          <p className="text-3xl font-bold text-destructive mt-1">{totalOverdue}</p>
          <p className="text-[12px] text-muted-foreground mt-1">{overdueByEmployee.length} сотр.</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Активных задач</p>
          <p className="text-3xl font-bold text-foreground mt-1">{totalActiveTasks}</p>
          <p className="text-[12px] text-muted-foreground mt-1">в работе</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Активных проектов</p>
          <p className="text-3xl font-bold text-foreground mt-1">{activeProjects.length}</p>
          <p className="text-[12px] text-muted-foreground mt-1">из {projects.length}</p>
        </Card>
        <Card className={cn("p-4 border-l-[3px]", totalProfit >= 0 ? "border-l-success" : "border-l-destructive")}>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Прибыль за месяц</p>
          <p className={cn("text-2xl font-bold mt-1", totalProfit >= 0 ? "text-success" : "text-destructive")}>
            {fmtMoney(totalProfit)}
          </p>
          <p className="text-[12px] text-muted-foreground mt-1">{fmtMoney(totalBudget)} / {fmtMoney(totalCost)}</p>
        </Card>
        <Card className={cn("p-4 border-l-[3px]", lossProjects > 0 ? "border-l-destructive" : "border-l-success")}>
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Проблемных проектов</p>
          <p className={cn("text-3xl font-bold mt-1", lossProjects > 0 ? "text-destructive" : "text-success")}>{lossProjects}</p>
          <p className="text-[12px] text-muted-foreground mt-1">убыток / перерасход</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* ТОП-3 сотрудников */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Trophy className="h-4 w-4 text-warning" />
              ТОП-3 сотрудников за месяц
            </h3>
            <button onClick={() => navigate("/kpi")} className="text-[11px] text-primary hover:underline">Все KPI →</button>
          </div>
          {topEmployees.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет завершённых задач за месяц</p>
          ) : (
            <div className="space-y-3">
              {topEmployees.map((emp, idx) => (
                <div key={emp.name} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30 border border-border">
                  <div className={cn(
                    "h-8 w-8 rounded-full flex items-center justify-center text-[13px] font-bold shrink-0",
                    idx === 0 ? "bg-warning/20 text-warning" : idx === 1 ? "bg-muted text-muted-foreground" : "bg-accent/40 text-foreground"
                  )}>
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{emp.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {emp.closed} закрыто · в срок {emp.onTimePct}% · ср. {emp.avgDays}д
                    </p>
                  </div>
                  <Badge variant={emp.onTimePct >= 80 ? "default" : "secondary"} className="text-[10px] shrink-0">
                    {emp.score}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Card>

        {/* Рентабельность проектов */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Scale className="h-4 w-4 text-primary" />
              Рентабельность проектов
            </h3>
            <button onClick={() => navigate("/plan-fact")} className="text-[11px] text-primary hover:underline">План-факт →</button>
          </div>
          {projectProfitability.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет проектов с финансовыми данными</p>
          ) : (
            <div className="space-y-2 max-h-[340px] overflow-y-auto">
              {projectProfitability.map((p) => (
                <div
                  key={p.id}
                  onClick={() => navigate(`/crm-projects/${p.id}`)}
                  className={cn(
                    "p-2.5 rounded-lg cursor-pointer transition-colors border-l-[3px]",
                    p.status === "loss" ? "bg-destructive/5 border-l-destructive hover:bg-destructive/10" :
                    p.status === "over" ? "bg-destructive/5 border-l-destructive hover:bg-destructive/10" :
                    p.status === "warn" ? "bg-warning/5 border-l-warning hover:bg-warning/10" :
                    "bg-muted/20 border-l-success hover:bg-muted/40"
                  )}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-[13px] font-medium text-foreground truncate flex-1">{p.name}</p>
                    <span className={cn(
                      "text-[12px] font-semibold tabular-nums shrink-0 ml-2",
                      p.profit >= 0 ? "text-success" : "text-destructive"
                    )}>
                      {fmtMoney(p.profit)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {p.planned > 0 && (
                      <>
                        <Progress value={Math.min(100, p.usagePct)} className="h-1.5 flex-1" />
                        <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">
                          {p.actualHours.toFixed(1)}/{p.planned}ч ({p.usagePct}%)
                        </span>
                      </>
                    )}
                    {p.planned === 0 && p.budget > 0 && (
                      <span className="text-[10px] text-muted-foreground">Бюджет: {fmtMoney(p.budget)}</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Последние алерты */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Bell className="h-4 w-4 text-warning" />
              Последние алерты
            </h3>
            <Badge variant="secondary" className="text-[10px]">{notifications.length}</Badge>
          </div>
          {notifications.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет уведомлений</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {notifications.map((n) => {
                const proj = n.project_id ? projectMap[n.project_id] : null;
                const isCritical = n.title.includes("🚨") || n.title.toLowerCase().includes("просроч");
                const isWarning = n.title.includes("⚠️") || n.title.toLowerCase().includes("ошибка");
                return (
                  <div
                    key={n.id}
                    onClick={() => proj && navigate(`/crm-projects/${proj.id}`)}
                    className={cn(
                      "p-2.5 rounded-lg cursor-pointer transition-colors border-l-[3px]",
                      isCritical ? "bg-destructive/5 border-l-destructive hover:bg-destructive/10" :
                      isWarning ? "bg-warning/5 border-l-warning hover:bg-warning/10" :
                      "bg-muted/20 border-l-primary hover:bg-muted/40",
                      !n.is_read && "ring-1 ring-primary/20"
                    )}
                  >
                    <p className="text-[13px] font-medium text-foreground line-clamp-1">{n.title}</p>
                    {n.body && <p className="text-[11px] text-muted-foreground line-clamp-1 mt-0.5">{n.body}</p>}
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {proj?.name && <span>{proj.name} · </span>}
                      {format(parseISO(n.created_at), "d MMM, HH:mm", { locale: ruLocale })}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Загрузка команды */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              Загрузка команды
            </h3>
            <button onClick={() => navigate("/workload")} className="text-[11px] text-primary hover:underline">Подробно →</button>
          </div>
          {teamLoad.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет активных задач</p>
          ) : (
            <div className="space-y-3 max-h-[360px] overflow-y-auto">
              {teamLoad.map((emp) => (
                <div key={emp.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] text-foreground truncate">{emp.name}</span>
                      <span className="text-[10px] text-muted-foreground">{emp.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {emp.overdue > 0 && <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{emp.overdue}</Badge>}
                      {emp.soon > 0 && <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-warning text-warning">{emp.soon}</Badge>}
                      <span className="text-[12px] font-semibold text-foreground tabular-nums">{emp.active}</span>
                    </div>
                  </div>
                  <Progress value={emp.pct} className="h-1.5" />
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Активные проекты */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <FolderKanban className="h-4 w-4 text-primary" />
              Активные проекты
            </h3>
            <Badge variant="secondary" className="text-[10px]">{activeProjects.length}</Badge>
          </div>
          {activeProjects.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет активных проектов</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {activeProjects.slice(0, 10).map((p) => {
                const am = p.account_manager_id ? memberMap[p.account_manager_id] : null;
                const seo = p.seo_specialist_id ? memberMap[p.seo_specialist_id] : null;
                return (
                  <div
                    key={p.id}
                    onClick={() => navigate(`/crm-projects/${p.id}`)}
                    className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-muted/50 cursor-pointer transition-colors"
                  >
                    {p.logo_url ? (
                      <img src={p.logo_url} alt="" className="h-9 w-9 rounded object-cover shrink-0" />
                    ) : (
                      <div className="h-9 w-9 rounded bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary shrink-0">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-[13px] font-medium text-foreground truncate">{p.name}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{am?.full_name || seo?.full_name || "Без ответственного"}</p>
                    </div>
                    {p.efficiency != null && <Badge variant="outline" className="text-[10px] shrink-0">{p.efficiency}%</Badge>}
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  </div>
                );
              })}
            </div>
          )}
        </Card>

        {/* Ближайшие дедлайны */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Calendar className="h-4 w-4 text-primary" />
              Ближайшие дедлайны
            </h3>
            <Badge variant="secondary" className="text-[10px]">{upcomingDeadlines.length}</Badge>
          </div>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет дедлайнов</p>
          ) : (
            <div className="space-y-2 max-h-[360px] overflow-y-auto">
              {upcomingDeadlines.map((item) => {
                const overdue = item.diffDays < 0;
                const soon = item.diffDays >= 0 && item.diffDays <= 3;
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    onClick={() => item.projectId && navigate(`/crm-projects/${item.projectId}`)}
                    className={cn(
                      "flex items-center gap-3 p-2.5 rounded-lg cursor-pointer transition-colors border-l-[3px]",
                      overdue ? "bg-destructive/5 border-l-destructive hover:bg-destructive/10" :
                      soon ? "bg-warning/5 border-l-warning hover:bg-warning/10" :
                      "bg-muted/20 border-l-muted hover:bg-muted/40"
                    )}
                  >
                    <Clock className={cn("h-4 w-4 shrink-0", overdue ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground")} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">{item.type === "project" ? "Проект" : "Задача"}</Badge>
                        <p className="text-[13px] font-medium text-foreground truncate">{item.title}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {item.assignee} · {format(parseISO(item.deadline), "d MMM yyyy", { locale: ruLocale })}
                      </p>
                    </div>
                    <span className={cn("text-[11px] font-semibold shrink-0 tabular-nums", overdue ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground")}>
                      {overdue ? `${Math.abs(item.diffDays)}д` : `+${item.diffDays}д`}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default DirectorDashboard;
