import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Clock, Users, FolderKanban, TrendingUp } from "lucide-react";
import { format, startOfWeek, startOfMonth, subDays } from "date-fns";
import { ru } from "date-fns/locale";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid,
} from "recharts";

function fmtH(min: number) {
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h > 0 ? `${h}ч ${m}м` : `${m}м`;
}

const PERIODS = {
  week: { label: "Неделя", from: () => startOfWeek(new Date(), { weekStartsOn: 1 }) },
  month: { label: "Месяц", from: () => startOfMonth(new Date()) },
  "30d": { label: "30 дней", from: () => subDays(new Date(), 30) },
  "90d": { label: "90 дней", from: () => subDays(new Date(), 90) },
};

export default function TimeTrackingPage() {
  const { user, isAdmin } = useAuth();
  const [period, setPeriod] = useState<keyof typeof PERIODS>("week");
  const fromDate = PERIODS[period].from();
  const fromStr = format(fromDate, "yyyy-MM-dd");

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["time-entries-report", fromStr, isAdmin],
    queryFn: async () => {
      let q = supabase
        .from("task_time_entries")
        .select("id, user_id, task_id, project_id, duration_minutes, entry_date, comment, started_at")
        .gte("entry_date", fromStr)
        .order("entry_date", { ascending: false });
      if (!isAdmin) q = q.eq("user_id", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data;
    },
  });

  const userIds = [...new Set(entries.map((e) => e.user_id))];
  const taskIds = [...new Set(entries.map((e) => e.task_id))];
  const projectIds = [...new Set(entries.map((e) => e.project_id).filter(Boolean) as string[])];

  const { data: profiles = [] } = useQuery({
    queryKey: ["tt-profiles", userIds],
    queryFn: async () => {
      if (!userIds.length) return [];
      const { data } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", userIds);
      return data ?? [];
    },
    enabled: userIds.length > 0,
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tt-tasks", taskIds],
    queryFn: async () => {
      if (!taskIds.length) return [];
      const { data } = await supabase.from("crm_tasks").select("id, title").in("id", taskIds);
      return data ?? [];
    },
    enabled: taskIds.length > 0,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["tt-projects", projectIds],
    queryFn: async () => {
      if (!projectIds.length) return [];
      const { data } = await supabase.from("projects").select("id, name").in("id", projectIds);
      return data ?? [];
    },
    enabled: projectIds.length > 0,
  });

  const userMap = Object.fromEntries(profiles.map((p) => [p.user_id, p.full_name || p.email]));
  const taskMap = Object.fromEntries(tasks.map((t) => [t.id, t.title]));
  const projectMap = Object.fromEntries(projects.map((p) => [p.id, p.name]));

  const totalMin = entries.reduce((s, e) => s + (e.duration_minutes || 0), 0);

  const byDay = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.entry_date, (map.get(e.entry_date) || 0) + e.duration_minutes));
    return [...map.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, min]) => ({ date: format(new Date(date), "d MMM", { locale: ru }), hours: +(min / 60).toFixed(1) }));
  }, [entries]);

  const byUser = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => map.set(e.user_id, (map.get(e.user_id) || 0) + e.duration_minutes));
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([uid, min]) => ({ name: userMap[uid] || "—", min }));
  }, [entries, userMap]);

  const byProject = useMemo(() => {
    const map = new Map<string, number>();
    entries.forEach((e) => {
      if (!e.project_id) return;
      map.set(e.project_id, (map.get(e.project_id) || 0) + e.duration_minutes);
    });
    return [...map.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([pid, min]) => ({ name: projectMap[pid] || "—", min }));
  }, [entries, projectMap]);

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Clock className="h-6 w-6 text-primary" />
            Тайм-трекинг
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isAdmin ? "Отчёт по всей команде" : "Ваше учётное время"} · {PERIODS[period].label.toLowerCase()}
          </p>
        </div>
        <Select value={period} onValueChange={(v) => setPeriod(v as any)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            {Object.entries(PERIODS).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Всего часов</div>
          <div className="text-2xl font-bold mt-1">{(totalMin / 60).toFixed(1)}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Записей</div>
          <div className="text-2xl font-bold mt-1">{entries.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Сотрудников</div>
          <div className="text-2xl font-bold mt-1">{userIds.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Проектов</div>
          <div className="text-2xl font-bold mt-1">{projectIds.length}</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="h-4 w-4 text-primary" />
          <h3 className="text-sm font-semibold">Часы по дням</h3>
        </div>
        {byDay.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">Нет данных за период</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={byDay}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
                formatter={(v: any) => [`${v} ч`, "Часы"]}
              />
              <Bar dataKey="hours" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </Card>

      <Tabs defaultValue="users" className="w-full">
        <TabsList>
          <TabsTrigger value="users"><Users className="h-3.5 w-3.5 mr-1.5" />По сотрудникам</TabsTrigger>
          <TabsTrigger value="projects"><FolderKanban className="h-3.5 w-3.5 mr-1.5" />По проектам</TabsTrigger>
          <TabsTrigger value="entries">Все записи</TabsTrigger>
        </TabsList>

        <TabsContent value="users">
          <Card className="p-4">
            {byUser.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {byUser.map((u, i) => {
                  const pct = totalMin ? (u.min / totalMin) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{u.name}</span>
                        <span className="tabular-nums text-muted-foreground">{fmtH(u.min)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="projects">
          <Card className="p-4">
            {byProject.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Нет данных</p>
            ) : (
              <div className="space-y-2">
                {byProject.map((p, i) => {
                  const pct = totalMin ? (p.min / totalMin) * 100 : 0;
                  return (
                    <div key={i} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{p.name}</span>
                        <span className="tabular-nums text-muted-foreground">{fmtH(p.min)} · {pct.toFixed(0)}%</span>
                      </div>
                      <div className="h-2 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </TabsContent>

        <TabsContent value="entries">
          <Card className="p-0 overflow-hidden">
            {isLoading ? (
              <p className="text-sm text-muted-foreground text-center py-8">Загрузка...</p>
            ) : entries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Нет записей</p>
            ) : (
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {entries.map((e) => (
                  <div key={e.id} className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-muted/40">
                    <span className="text-xs text-muted-foreground tabular-nums w-24">
                      {format(new Date(e.started_at), "d MMM HH:mm", { locale: ru })}
                    </span>
                    <span className="font-medium tabular-nums w-20">{fmtH(e.duration_minutes)}</span>
                    {isAdmin && (
                      <span className="text-xs text-muted-foreground w-32 truncate">{userMap[e.user_id] || "—"}</span>
                    )}
                    <span className="text-xs flex-1 truncate">{taskMap[e.task_id] || "—"}</span>
                    {e.project_id && (
                      <span className="text-xs text-primary truncate max-w-[140px]">{projectMap[e.project_id]}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
