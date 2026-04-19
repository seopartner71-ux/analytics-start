import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, MessageSquare, Calendar, User as UserIcon, ChevronDown, ChevronUp } from "lucide-react";
import { format, isPast, parseISO } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface OnbTask {
  id: string;
  onboarding_id: string;
  project_id: string;
  period: number;
  week: number;
  sort_order: number;
  title: string;
  assignee_role: string;
  assignee_id: string | null;
  status: string;
  checked: boolean;
  comment: string | null;
  due_date: string | null;
  completed_at: string | null;
  completed_by_name: string | null;
}

interface TeamMember { id: string; full_name: string; }

const STATUS_OPTIONS = [
  { value: "not_started", label: "Не начата", className: "bg-muted text-muted-foreground" },
  { value: "in_progress", label: "В работе", className: "bg-amber-500/15 text-amber-600 dark:text-amber-400" },
  { value: "done", label: "Выполнена", className: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400" },
  { value: "overdue", label: "Просрочена", className: "bg-red-500/15 text-red-600 dark:text-red-400" },
];

const PERIOD_LABEL: Record<number, string> = { 1: "Месяц 1", 2: "Месяц 2", 3: "Месяц 3" };

export function OnboardingTasksTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [tasks, setTasks] = useState<OnbTask[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>("1");
  const [openComments, setOpenComments] = useState<Record<string, boolean>>({});
  const [draftComments, setDraftComments] = useState<Record<string, string>>({});

  const load = async () => {
    setLoading(true);
    const [{ data: t }, { data: tm }] = await Promise.all([
      supabase.from("onboarding_tasks").select("*").eq("project_id", projectId).order("sort_order"),
      supabase.from("team_members").select("id,full_name"),
    ]);
    // Авто-вычисление overdue для UI
    const now = new Date();
    const list = ((t || []) as OnbTask[]).map((task) => {
      if (task.checked || task.status === "done") return task;
      if (task.due_date && isPast(parseISO(task.due_date))) {
        return { ...task, status: "overdue" };
      }
      return task;
    });
    setTasks(list);
    setTeam((tm || []) as any);
    setLoading(false);
  };

  useEffect(() => {
    load();

    const channel = supabase
      .channel(`onboarding-tasks-${projectId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "onboarding_tasks", filter: `project_id=eq.${projectId}` }, () => load())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  const grouped = useMemo(() => {
    const g: Record<number, OnbTask[]> = { 1: [], 2: [], 3: [] };
    tasks.forEach((t) => g[t.period]?.push(t));
    return g;
  }, [tasks]);

  const stats = useMemo(() => {
    const calc = (list: OnbTask[]) => {
      const total = list.length;
      const done = list.filter((t) => t.checked || t.status === "done").length;
      return { total, done, percent: total ? Math.round((done * 100) / total) : 0 };
    };
    return {
      1: calc(grouped[1] || []),
      2: calc(grouped[2] || []),
      3: calc(grouped[3] || []),
      all: calc(tasks),
    };
  }, [grouped, tasks]);

  const updateTask = async (id: string, patch: Partial<OnbTask>) => {
    const prev = tasks;
    setTasks((cur) => cur.map((t) => (t.id === id ? { ...t, ...patch } : t)));
    const { error } = await supabase.from("onboarding_tasks").update(patch).eq("id", id);
    if (error) {
      setTasks(prev);
      toast.error("Не удалось обновить задачу");
    }
  };

  const toggleChecked = (task: OnbTask, value: boolean) => {
    updateTask(task.id, {
      checked: value,
      status: value ? "done" : "not_started",
      completed_at: value ? new Date().toISOString() : null,
      completed_by_name: value ? (user?.email || "") : null,
    } as any);
  };

  const changeStatus = (task: OnbTask, status: string) => {
    updateTask(task.id, {
      status,
      checked: status === "done",
      completed_at: status === "done" ? new Date().toISOString() : null,
    });
  };

  const changeAssignee = (task: OnbTask, assignee_id: string) => {
    updateTask(task.id, { assignee_id: assignee_id === "none" ? null : assignee_id });
  };

  const saveComment = async (task: OnbTask) => {
    const value = draftComments[task.id] ?? task.comment ?? "";
    await updateTask(task.id, { comment: value });
    toast.success("Комментарий сохранён");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;
  }

  if (tasks.length === 0) {
    return (
      <Card className="p-8 text-center">
        <p className="text-sm text-muted-foreground">Для этого проекта нет задач онбординга. Они создаются автоматически в мастере «Новый клиент».</p>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Общий прогресс */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[13px] font-medium">Общий прогресс проекта</div>
          <div className="text-[12px] text-muted-foreground tabular-nums">
            Всего {stats.all.total} • Выполнено {stats.all.done} • {stats.all.percent}%
          </div>
        </div>
        <Progress value={stats.all.percent} className="h-2" />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          {[1, 2, 3].map((p) => (
            <div key={p} className="space-y-1.5">
              <div className="flex items-center justify-between text-[12px]">
                <span className="font-medium">{PERIOD_LABEL[p]}</span>
                <span className="text-muted-foreground tabular-nums">{stats[p as 1|2|3].done}/{stats[p as 1|2|3].total} • {stats[p as 1|2|3].percent}%</span>
              </div>
              <Progress value={stats[p as 1|2|3].percent} className="h-1.5" />
            </div>
          ))}
        </div>
      </Card>

      {/* Вкладки периодов */}
      <Tabs value={period} onValueChange={setPeriod}>
        <TabsList>
          {[1, 2, 3].map((p) => (
            <TabsTrigger key={p} value={String(p)} className="text-[13px]">
              Период {p} <span className="ml-1.5 text-[11px] text-muted-foreground tabular-nums">{stats[p as 1|2|3].done}/{stats[p as 1|2|3].total}</span>
            </TabsTrigger>
          ))}
        </TabsList>

        {[1, 2, 3].map((p) => (
          <TabsContent key={p} value={String(p)} className="space-y-2 mt-3">
            {(grouped[p] || []).map((task) => {
              const stOpt = STATUS_OPTIONS.find((s) => s.value === task.status) || STATUS_OPTIONS[0];
              const overdue = task.status === "overdue";
              const isOpen = openComments[task.id];
              return (
                <Card key={task.id} className={cn("p-3", overdue && "border-red-500/40")}>
                  <div className="flex items-start gap-3">
                    <Checkbox
                      checked={task.checked}
                      onCheckedChange={(v) => toggleChecked(task, !!v)}
                      className="mt-1"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={cn("text-[13px] font-medium", task.checked && "line-through text-muted-foreground")}>{task.title}</span>
                        <Badge variant="outline" className="text-[10px] h-5">Неделя {task.week}</Badge>
                        <Badge variant="secondary" className={cn("text-[10px] h-5 border-0", stOpt.className)}>{stOpt.label}</Badge>
                      </div>
                      <div className="flex flex-wrap items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                        {task.due_date && (
                          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(parseISO(task.due_date), "dd.MM.yyyy")}</span>
                        )}
                        <span className="flex items-center gap-1"><UserIcon className="h-3 w-3" />{task.assignee_role === "seo" ? "SEO" : task.assignee_role === "manager" ? "Менеджер" : "Директор"}</span>
                        <button className="flex items-center gap-1 hover:text-foreground" onClick={() => setOpenComments((o) => ({ ...o, [task.id]: !o[task.id] }))}>
                          <MessageSquare className="h-3 w-3" />
                          {task.comment ? "Комментарий" : "Добавить комментарий"}
                          {isOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                        </button>
                      </div>

                      {isOpen && (
                        <div className="mt-2 space-y-2">
                          <Textarea
                            value={draftComments[task.id] ?? task.comment ?? ""}
                            onChange={(e) => setDraftComments((d) => ({ ...d, [task.id]: e.target.value }))}
                            placeholder="Комментарий к задаче…"
                            className="text-[12px] min-h-[60px]"
                          />
                          <Button size="sm" variant="outline" className="h-7 text-[11px]" onClick={() => saveComment(task)}>Сохранить</Button>
                        </div>
                      )}
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0 w-40">
                      <Select value={task.status} onValueChange={(v) => changeStatus(task, v)}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {STATUS_OPTIONS.map((s) => <SelectItem key={s.value} value={s.value} className="text-[12px]">{s.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <Select value={task.assignee_id || "none"} onValueChange={(v) => changeAssignee(task, v)}>
                        <SelectTrigger className="h-7 text-[11px]"><SelectValue placeholder="Исполнитель" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none" className="text-[12px]">Не назначен</SelectItem>
                          {team.map((m) => <SelectItem key={m.id} value={m.id} className="text-[12px]">{m.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </Card>
              );
            })}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
