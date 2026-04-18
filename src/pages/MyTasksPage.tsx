import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/PageHeader";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  TASK_STAGES,
  STAGE_COLORS,
  getDeadlineStatus,
  DEADLINE_STYLES,
  formatDeadline,
} from "@/lib/task-helpers";
import { Calendar, FolderKanban, Search, AlertTriangle, Clock, CheckCircle2 } from "lucide-react";
import { TaskDetailSheet, CrmTask } from "@/components/project/TaskDetailSheet";

type TaskRow = {
  id: string;
  title: string;
  description: string | null;
  stage: string;
  priority: string;
  deadline: string | null;
  project_id: string | null;
  assignee_id: string | null;
  owner_id: string;
  created_at: string;
  projects?: { id: string; name: string; logo_url: string | null } | null;
};

const ACTIVE_STAGES = ["Новые", "В работе", "Возвращена", "На проверке"];

export default function MyTasksPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [filter, setFilter] = useState<"active" | "all" | "done">("active");
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);

  // Получаем team_member id текущего пользователя (для assignee)
  const { data: myTeamMemberIds = [] } = useQuery({
    queryKey: ["my-team-member-ids", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id")
        .eq("owner_id", user!.id);
      return (data ?? []).map((d) => d.id);
    },
  });

  const { data: tasks = [], isLoading, refetch } = useQuery({
    queryKey: ["my-tasks", user?.id, myTeamMemberIds],
    enabled: !!user,
    queryFn: async () => {
      // Задачи где я владелец ИЛИ исполнитель (через team_members)
      let query = supabase
        .from("crm_tasks")
        .select("*, projects:project_id (id, name, logo_url)")
        .order("deadline", { ascending: true, nullsFirst: false });

      if (myTeamMemberIds.length > 0) {
        query = query.or(
          `owner_id.eq.${user!.id},assignee_id.in.(${myTeamMemberIds.join(",")})`
        );
      } else {
        query = query.eq("owner_id", user!.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data ?? []) as TaskRow[];
    },
  });

  const filtered = useMemo(() => {
    return tasks.filter((t) => {
      if (filter === "active" && !ACTIVE_STAGES.includes(t.stage)) return false;
      if (filter === "done" && !["Принята", "Завершена"].includes(t.stage)) return false;
      if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [tasks, filter, search]);

  const grouped = useMemo(() => {
    const map: Record<string, TaskRow[]> = {};
    for (const stage of TASK_STAGES) map[stage] = [];
    for (const t of filtered) {
      if (!map[t.stage]) map[t.stage] = [];
      map[t.stage].push(t);
    }
    // сортировка внутри группы: просроченные → скоро → ok → без дедлайна
    const order: Record<string, number> = { overdue: 0, soon: 1, ok: 2, none: 3 };
    Object.keys(map).forEach((k) => {
      map[k].sort((a, b) => {
        const sa = order[getDeadlineStatus(a.deadline, a.stage)];
        const sb = order[getDeadlineStatus(b.deadline, b.stage)];
        if (sa !== sb) return sa - sb;
        if (a.deadline && b.deadline) return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
        return 0;
      });
    });
    return map;
  }, [filtered]);

  const stats = useMemo(() => {
    const overdue = tasks.filter(
      (t) => getDeadlineStatus(t.deadline, t.stage) === "overdue"
    ).length;
    const soon = tasks.filter(
      (t) => getDeadlineStatus(t.deadline, t.stage) === "soon"
    ).length;
    const active = tasks.filter((t) => ACTIVE_STAGES.includes(t.stage)).length;
    const done = tasks.filter((t) => ["Принята", "Завершена"].includes(t.stage)).length;
    return { overdue, soon, active, done };
  }, [tasks]);

  const visibleStages = TASK_STAGES.filter((s) => grouped[s]?.length > 0);

  return (
    <div className="space-y-4">
      <PageHeader breadcrumbs="Мои задачи" />

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.overdue}</div>
            <div className="text-xs text-muted-foreground">Просрочено</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
            <Clock className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.soon}</div>
            <div className="text-xs text-muted-foreground">Скоро дедлайн</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <FolderKanban className="h-5 w-5 text-primary" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.active}</div>
            <div className="text-xs text-muted-foreground">В работе</div>
          </div>
        </Card>
        <Card className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </div>
          <div>
            <div className="text-2xl font-bold">{stats.done}</div>
            <div className="text-xs text-muted-foreground">Завершено</div>
          </div>
        </Card>
      </div>

      {/* Фильтры */}
      <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as typeof filter)}>
          <TabsList>
            <TabsTrigger value="active">Активные</TabsTrigger>
            <TabsTrigger value="done">Завершённые</TabsTrigger>
            <TabsTrigger value="all">Все</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="relative w-full md:w-72">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
      </div>

      {/* Группы */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-24 w-full" />
          ))}
        </div>
      ) : visibleStages.length === 0 ? (
        <Card className="p-12 text-center text-muted-foreground">
          {search ? "Задачи не найдены" : "Нет задач в этой категории"}
        </Card>
      ) : (
        <div className="space-y-5">
          {visibleStages.map((stage) => (
            <div key={stage}>
              <div className="flex items-center gap-2 mb-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ background: STAGE_COLORS[stage] }}
                />
                <h3 className="text-sm font-semibold">{stage}</h3>
                <Badge variant="secondary" className="text-xs">
                  {grouped[stage].length}
                </Badge>
              </div>
              <div className="space-y-2">
                {grouped[stage].map((t) => {
                  const dStatus = getDeadlineStatus(t.deadline, t.stage);
                  const dStyle = DEADLINE_STYLES[dStatus];
                  return (
                    <Card
                      key={t.id}
                      className="p-3 cursor-pointer hover:border-primary/40 transition-colors"
                      onClick={() => setSelectedTask(t as unknown as CrmTask)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-sm truncate">{t.title}</span>
                            {t.priority === "high" && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                                Высокий
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground flex-wrap">
                            {t.projects && (
                              <button
                                className="flex items-center gap-1.5 hover:text-foreground"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/crm-projects/${t.projects!.id}`);
                                }}
                              >
                                {t.projects.logo_url ? (
                                  <img
                                    src={t.projects.logo_url}
                                    alt=""
                                    className="h-4 w-4 rounded object-cover"
                                  />
                                ) : (
                                  <FolderKanban className="h-3.5 w-3.5" />
                                )}
                                <span className="truncate max-w-[200px]">{t.projects.name}</span>
                              </button>
                            )}
                            {t.deadline && (
                              <span
                                className={`flex items-center gap-1 px-1.5 py-0.5 rounded ${dStyle.bg} ${dStyle.text}`}
                              >
                                <Calendar className="h-3 w-3" />
                                {formatDeadline(t.deadline)}
                                {dStyle.label && <span className="ml-1">· {dStyle.label}</span>}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <TaskDetailSheet
        task={selectedTask}
        open={!!selectedTask}
        onClose={() => {
          setSelectedTask(null);
          refetch();
        }}
      />
    </div>
  );
}
