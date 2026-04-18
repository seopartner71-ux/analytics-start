import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { PageHeader } from "@/components/PageHeader";
import { Users, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { getDeadlineStatus } from "@/lib/task-helpers";

interface MemberWorkload {
  id: string;
  full_name: string;
  role: string;
  department: string | null;
  total: number;
  inProgress: number;
  review: number;
  overdue: number;
  dueThisWeek: number;
  load: number; // 0-100
  status: "free" | "normal" | "busy" | "overload";
}

const STATUS_META: Record<MemberWorkload["status"], { label: string; cls: string }> = {
  free: { label: "Свободен", cls: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  normal: { label: "Норма", cls: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30" },
  busy: { label: "Загружен", cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30" },
  overload: { label: "Перегрузка", cls: "bg-destructive/15 text-destructive border-destructive/30" },
};

function calcStatus(active: number, overdue: number): MemberWorkload["status"] {
  if (overdue >= 2 || active >= 12) return "overload";
  if (active >= 7) return "busy";
  if (active >= 1) return "normal";
  return "free";
}

export default function WorkloadPage() {
  const weekFromNow = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 7);
    return d.toISOString();
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ["workload-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, role, department")
        .order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["workload-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, assignee_id, stage, deadline, priority, title, project_id");
      if (error) throw error;
      return data;
    },
  });

  const workload: MemberWorkload[] = useMemo(() => {
    return members.map((m) => {
      const myTasks = tasks.filter((t) => t.assignee_id === m.id);
      const active = myTasks.filter((t) => t.stage !== "Завершена" && t.stage !== "Принята");
      const inProgress = active.filter((t) => t.stage === "В работе").length;
      const review = active.filter((t) => t.stage === "На проверке").length;
      const overdue = active.filter((t) => getDeadlineStatus(t.deadline, t.stage) === "overdue").length;
      const dueThisWeek = active.filter((t) => {
        if (!t.deadline) return false;
        const d = new Date(t.deadline).getTime();
        return d >= Date.now() && d <= new Date(weekFromNow).getTime();
      }).length;
      const total = active.length;
      const load = Math.min(100, Math.round((total / 10) * 100));
      return {
        id: m.id,
        full_name: m.full_name,
        role: m.role,
        department: m.department,
        total,
        inProgress,
        review,
        overdue,
        dueThisWeek,
        load,
        status: calcStatus(total, overdue),
      };
    });
  }, [members, tasks, weekFromNow]);

  const totals = useMemo(() => {
    const totalEmployees = workload.length;
    const overloaded = workload.filter((w) => w.status === "overload").length;
    const free = workload.filter((w) => w.status === "free").length;
    const totalActive = workload.reduce((s, w) => s + w.total, 0);
    const totalOverdue = workload.reduce((s, w) => s + w.overdue, 0);
    return { totalEmployees, overloaded, free, totalActive, totalOverdue };
  }, [workload]);

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <PageHeader />
      <div>
        <h2 className="text-xl font-semibold">Загрузка команды</h2>
        <p className="text-sm text-muted-foreground mt-1">Активные задачи, дедлайны на неделю и индикатор перегрузки</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Сотрудников</div>
              <div className="text-2xl font-bold">{totals.totalEmployees}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Clock className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Активных задач</div>
              <div className="text-2xl font-bold">{totals.totalActive}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Перегружены</div>
              <div className="text-2xl font-bold">{totals.overloaded}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Свободны</div>
              <div className="text-2xl font-bold">{totals.free}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сотрудники</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-center">Активных</TableHead>
                <TableHead className="text-center">В работе</TableHead>
                <TableHead className="text-center">На проверке</TableHead>
                <TableHead className="text-center">На неделе</TableHead>
                <TableHead className="text-center">Просрочено</TableHead>
                <TableHead className="w-[180px]">Загрузка</TableHead>
                <TableHead className="text-right">Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workload.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    Нет сотрудников. Добавьте их в разделе «Сотрудники».
                  </TableCell>
                </TableRow>
              )}
              {workload.map((w) => (
                <TableRow key={w.id}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                        {w.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate">{w.full_name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {w.department || "—"} · {w.role}
                        </div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className="text-center font-semibold">{w.total}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{w.inProgress}</TableCell>
                  <TableCell className="text-center text-muted-foreground">{w.review}</TableCell>
                  <TableCell className="text-center">
                    {w.dueThisWeek > 0 ? (
                      <span className="text-amber-600 dark:text-amber-400 font-medium">{w.dueThisWeek}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell className="text-center">
                    {w.overdue > 0 ? (
                      <span className="text-destructive font-semibold">{w.overdue}</span>
                    ) : (
                      <span className="text-muted-foreground">0</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Progress value={w.load} className="h-2" />
                      <span className="text-xs text-muted-foreground w-9 text-right">{w.load}%</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={STATUS_META[w.status].cls}>
                      {STATUS_META[w.status].label}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
