import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Trophy, Target, CheckCircle2, Timer, Award } from "lucide-react";

interface MemberKpi {
  id: string;
  full_name: string;
  role: string;
  department: string | null;
  closedMonth: number;
  closedTotal: number;
  onTimePct: number; // 0-100
  avgDurationDays: number; // среднее дней от created_at до завершения
  hoursMonth: number;
  score: number; // 0-100 рейтинг
  rank: number;
}

function rankBadge(rank: number) {
  if (rank === 1) return { cls: "bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30", icon: "🥇" };
  if (rank === 2) return { cls: "bg-slate-400/15 text-slate-500 border-slate-400/30", icon: "🥈" };
  if (rank === 3) return { cls: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30", icon: "🥉" };
  return null;
}

export default function EmployeeKpiPage() {
  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
  }, []);

  const { data: members = [] } = useQuery({
    queryKey: ["kpi-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, full_name, role, department, owner_id");
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["kpi-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, assignee_id, stage, deadline, created_at, updated_at");
      if (error) throw error;
      return data;
    },
  });

  const { data: timeEntries = [] } = useQuery({
    queryKey: ["kpi-time", monthStart],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_time_entries")
        .select("user_id, duration_minutes, started_at")
        .gte("started_at", monthStart);
      if (error) throw error;
      return data;
    },
  });

  const kpi: MemberKpi[] = useMemo(() => {
    const rows = members.map((m) => {
      const myTasks = tasks.filter((t) => t.assignee_id === m.id);
      const closed = myTasks.filter((t) => t.stage === "Завершена" || t.stage === "Принята");
      const closedMonth = closed.filter((t) => new Date(t.updated_at) >= new Date(monthStart)).length;

      // % в срок: из закрытых, у которых был дедлайн
      const withDeadline = closed.filter((t) => t.deadline);
      const inTime = withDeadline.filter((t) => new Date(t.updated_at).getTime() <= new Date(t.deadline!).getTime()).length;
      const onTimePct = withDeadline.length > 0 ? Math.round((inTime / withDeadline.length) * 100) : 100;

      // средняя длительность
      const durations = closed.map((t) =>
        (new Date(t.updated_at).getTime() - new Date(t.created_at).getTime()) / 86400000
      );
      const avgDurationDays = durations.length > 0
        ? +(durations.reduce((s, d) => s + d, 0) / durations.length).toFixed(1)
        : 0;

      // часы за месяц (по owner_id члена команды → user_id записи)
      const memberUserId = (m as { owner_id: string }).owner_id;
      const minutes = timeEntries
        .filter((e) => e.user_id === memberUserId)
        .reduce((s, e) => s + (e.duration_minutes || 0), 0);
      const hoursMonth = +(minutes / 60).toFixed(1);

      // Рейтинг: 50% on-time, 30% closed/мес (норм. до 20), 20% часы (норм. до 80)
      const closedScore = Math.min(100, (closedMonth / 20) * 100);
      const hoursScore = Math.min(100, (hoursMonth / 80) * 100);
      const score = Math.round(onTimePct * 0.5 + closedScore * 0.3 + hoursScore * 0.2);

      return {
        id: m.id,
        full_name: m.full_name,
        role: m.role,
        department: m.department,
        closedMonth,
        closedTotal: closed.length,
        onTimePct,
        avgDurationDays,
        hoursMonth,
        score,
        rank: 0,
      };
    });

    rows.sort((a, b) => b.score - a.score);
    rows.forEach((r, i) => (r.rank = i + 1));
    return rows;
  }, [members, tasks, timeEntries, monthStart]);

  const totals = useMemo(() => {
    const closedMonth = kpi.reduce((s, r) => s + r.closedMonth, 0);
    const avgOnTime = kpi.length > 0 ? Math.round(kpi.reduce((s, r) => s + r.onTimePct, 0) / kpi.length) : 0;
    const avgDuration = kpi.length > 0
      ? +(kpi.reduce((s, r) => s + r.avgDurationDays, 0) / kpi.length).toFixed(1)
      : 0;
    const top = kpi[0];
    return { closedMonth, avgOnTime, avgDuration, top };
  }, [kpi]);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">KPI сотрудников</h2>
        <p className="text-sm text-muted-foreground mt-1">% задач в срок, закрыто за месяц, средняя длительность и рейтинг команды</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-emerald-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Закрыто за месяц</div>
              <div className="text-2xl font-bold">{totals.closedMonth}</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
              <Target className="h-5 w-5 text-blue-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Средний % в срок</div>
              <div className="text-2xl font-bold">{totals.avgOnTime}%</div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
              <Timer className="h-5 w-5 text-purple-500" />
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Средняя длительность</div>
              <div className="text-2xl font-bold">{totals.avgDuration} <span className="text-sm font-normal text-muted-foreground">дн</span></div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <Trophy className="h-5 w-5 text-amber-500" />
            </div>
            <div className="min-w-0">
              <div className="text-xs text-muted-foreground">Лидер месяца</div>
              <div className="text-sm font-semibold truncate">{totals.top?.full_name || "—"}</div>
              {totals.top && <div className="text-[11px] text-muted-foreground">{totals.top.score} баллов</div>}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Award className="h-4 w-4 text-primary" />
            Рейтинг сотрудников
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[60px]">Место</TableHead>
                <TableHead>Сотрудник</TableHead>
                <TableHead className="text-center">Закрыто (мес)</TableHead>
                <TableHead className="text-center">Всего закрыто</TableHead>
                <TableHead className="text-center">% в срок</TableHead>
                <TableHead className="text-center">Ср. длит.</TableHead>
                <TableHead className="text-center">Часы (мес)</TableHead>
                <TableHead className="w-[180px]">Рейтинг</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {kpi.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12 text-muted-foreground text-sm">
                    Нет данных для расчёта KPI.
                  </TableCell>
                </TableRow>
              )}
              {kpi.map((r) => {
                const medal = rankBadge(r.rank);
                return (
                  <TableRow key={r.id}>
                    <TableCell>
                      {medal ? (
                        <Badge variant="outline" className={medal.cls}>
                          {medal.icon} #{r.rank}
                        </Badge>
                      ) : (
                        <span className="text-sm text-muted-foreground">#{r.rank}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center text-xs font-semibold">
                          {r.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{r.full_name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {r.department || "—"} · {r.role}
                          </div>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-semibold">{r.closedMonth}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{r.closedTotal}</TableCell>
                    <TableCell className="text-center">
                      <span className={
                        r.onTimePct >= 90 ? "text-emerald-600 dark:text-emerald-400 font-semibold" :
                        r.onTimePct >= 70 ? "text-amber-600 dark:text-amber-400 font-medium" :
                        "text-destructive font-medium"
                      }>
                        {r.onTimePct}%
                      </span>
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">
                      {r.avgDurationDays > 0 ? `${r.avgDurationDays} дн` : "—"}
                    </TableCell>
                    <TableCell className="text-center text-muted-foreground">{r.hoursMonth}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={r.score} className="h-2" />
                        <span className="text-xs font-semibold w-9 text-right">{r.score}</span>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Как считается рейтинг</CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-1">
          <p>• <span className="text-foreground font-medium">50%</span> — % задач, закрытых до дедлайна</p>
          <p>• <span className="text-foreground font-medium">30%</span> — количество закрытых задач за месяц (норма 20)</p>
          <p>• <span className="text-foreground font-medium">20%</span> — отработанные часы за месяц (норма 80)</p>
        </CardContent>
      </Card>
    </div>
  );
}
