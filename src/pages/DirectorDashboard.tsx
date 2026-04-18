import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Loader2, AlertTriangle, Users, FolderKanban, Calendar, ArrowRight, Clock } from "lucide-react";
import { format, isPast, parseISO, differenceInDays } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DONE_STAGES = ["Завершена", "Принята"];

const DirectorDashboard = () => {
  const navigate = useNavigate();

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["director-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, stage, deadline, assignee_id, project_id, priority")
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
        .select("id, name, url, logo_url, privacy, deadline, efficiency, seo_specialist_id, account_manager_id, created_at")
        .order("deadline", { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    },
  });

  const memberMap = useMemo(() => {
    const m: Record<string, typeof members[number]> = {};
    members.forEach((mb) => { m[mb.id] = mb; });
    return m;
  }, [members]);

  // Просроченные задачи по сотрудникам
  const overdueByEmployee = useMemo(() => {
    const map: Record<string, { name: string; role: string; count: number; tasks: typeof tasks }> = {};
    tasks.forEach((t) => {
      if (!t.deadline || !t.assignee_id) return;
      if (DONE_STAGES.includes(t.stage)) return;
      if (!isPast(parseISO(t.deadline))) return;
      const member = memberMap[t.assignee_id];
      if (!member) return;
      if (!map[t.assignee_id]) {
        map[t.assignee_id] = { name: member.full_name, role: member.role, count: 0, tasks: [] };
      }
      map[t.assignee_id].count++;
      map[t.assignee_id].tasks.push(t);
    });
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [tasks, memberMap]);

  // Загрузка команды (открытые задачи на сотрудника)
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

  // Активные проекты
  const activeProjects = useMemo(() => {
    return projects.filter((p) => p.privacy !== "На паузе" && p.privacy !== "Архив");
  }, [projects]);

  // Ближайшие дедлайны (проекты + задачи)
  const upcomingDeadlines = useMemo(() => {
    const now = new Date();
    const items: Array<{
      type: "project" | "task";
      id: string;
      title: string;
      deadline: string;
      assignee: string;
      projectId?: string;
      diffDays: number;
    }> = [];

    projects.forEach((p) => {
      if (!p.deadline) return;
      const am = p.account_manager_id ? memberMap[p.account_manager_id] : null;
      const seo = p.seo_specialist_id ? memberMap[p.seo_specialist_id] : null;
      items.push({
        type: "project",
        id: p.id,
        title: p.name,
        deadline: p.deadline,
        assignee: am?.full_name || seo?.full_name || "—",
        projectId: p.id,
        diffDays: differenceInDays(parseISO(p.deadline), now),
      });
    });

    tasks.forEach((t) => {
      if (!t.deadline || DONE_STAGES.includes(t.stage)) return;
      const member = t.assignee_id ? memberMap[t.assignee_id] : null;
      items.push({
        type: "task",
        id: t.id,
        title: t.title,
        deadline: t.deadline,
        assignee: member?.full_name || "—",
        projectId: t.project_id || undefined,
        diffDays: differenceInDays(parseISO(t.deadline), now),
      });
    });

    return items
      .sort((a, b) => parseISO(a.deadline).getTime() - parseISO(b.deadline).getTime())
      .slice(0, 12);
  }, [projects, tasks, memberMap]);

  const totalOverdue = overdueByEmployee.reduce((s, e) => s + e.count, 0);
  const totalActiveTasks = teamLoad.reduce((s, e) => s + e.active, 0);

  if (loadingTasks || loadingProjects) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Заголовок */}
      <div>
        <h1 className="text-xl font-bold text-foreground">Дашборд директора</h1>
        <p className="text-[13px] text-muted-foreground mt-0.5">Загрузка команды, дедлайны и просрочки в одном окне</p>
      </div>

      {/* KPI */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 border-l-[3px] border-l-destructive">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Просрочено всего</p>
          <p className="text-3xl font-bold text-destructive mt-1">{totalOverdue}</p>
          <p className="text-[12px] text-muted-foreground mt-1">{overdueByEmployee.length} сотрудников</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Активных задач</p>
          <p className="text-3xl font-bold text-foreground mt-1">{totalActiveTasks}</p>
          <p className="text-[12px] text-muted-foreground mt-1">в работе у команды</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Активных проектов</p>
          <p className="text-3xl font-bold text-foreground mt-1">{activeProjects.length}</p>
          <p className="text-[12px] text-muted-foreground mt-1">из {projects.length} всего</p>
        </Card>
        <Card className="p-4">
          <p className="text-[11px] text-muted-foreground uppercase tracking-wide font-medium">Сотрудников</p>
          <p className="text-3xl font-bold text-foreground mt-1">{members.length}</p>
          <p className="text-[12px] text-muted-foreground mt-1">{teamLoad.length} с задачами</p>
        </Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Просроченные по сотрудникам */}
        <Card className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Просроченные задачи по сотрудникам
            </h3>
            <Badge variant="destructive" className="text-[10px]">{totalOverdue}</Badge>
          </div>
          {overdueByEmployee.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет просроченных задач 🎉</p>
          ) : (
            <div className="space-y-3">
              {overdueByEmployee.map((emp) => (
                <div key={emp.name} className="flex items-center justify-between p-3 rounded-lg bg-destructive/5 border border-destructive/20">
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-medium text-foreground truncate">{emp.name}</p>
                    <p className="text-[11px] text-muted-foreground">{emp.role}</p>
                  </div>
                  <Badge variant="destructive" className="ml-2">{emp.count}</Badge>
                </div>
              ))}
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
            <span className="text-[11px] text-muted-foreground">активных задач</span>
          </div>
          {teamLoad.length === 0 ? (
            <p className="text-[13px] text-muted-foreground text-center py-8">Нет активных задач</p>
          ) : (
            <div className="space-y-3">
              {teamLoad.map((emp) => (
                <div key={emp.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[13px] text-foreground truncate">{emp.name}</span>
                      <span className="text-[10px] text-muted-foreground">{emp.role}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {emp.overdue > 0 && (
                        <Badge variant="destructive" className="text-[10px] h-4 px-1.5">{emp.overdue} просроч.</Badge>
                      )}
                      {emp.soon > 0 && (
                        <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-warning text-warning">{emp.soon} скоро</Badge>
                      )}
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
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {activeProjects.slice(0, 12).map((p) => {
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
                      <p className="text-[11px] text-muted-foreground truncate">
                        {am?.full_name || seo?.full_name || "Без ответственного"}
                      </p>
                    </div>
                    {p.efficiency != null && (
                      <Badge variant="outline" className="text-[10px] shrink-0">{p.efficiency}%</Badge>
                    )}
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
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
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
                    <Clock className={cn(
                      "h-4 w-4 shrink-0",
                      overdue ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground"
                    )} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[9px] h-4 px-1 shrink-0">
                          {item.type === "project" ? "Проект" : "Задача"}
                        </Badge>
                        <p className="text-[13px] font-medium text-foreground truncate">{item.title}</p>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        {item.assignee} · {format(parseISO(item.deadline), "d MMM yyyy", { locale: ruLocale })}
                      </p>
                    </div>
                    <span className={cn(
                      "text-[11px] font-semibold shrink-0 tabular-nums",
                      overdue ? "text-destructive" : soon ? "text-warning" : "text-muted-foreground"
                    )}>
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
