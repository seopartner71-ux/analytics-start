import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { FolderKanban, TrendingUp, Key, AlertTriangle, Users, ArrowUp, ArrowDown } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell } from "recharts";
import { format, isPast, parseISO } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { AddProjectWizard } from "@/components/AddProjectWizard";

// Mock traffic data for chart
const trafficByMonth = [
  { month: "Ноя", current: 98000, prev: 82000 },
  { month: "Дек", current: 105000, prev: 88000 },
  { month: "Янв", current: 92000, prev: 95000 },
  { month: "Фев", current: 110000, prev: 99000 },
  { month: "Мар", current: 118000, prev: 102000 },
  { month: "Апр", current: 124500, prev: 108000 },
];

const topProjects = [
  { name: "avto-parts.ru", value: 42300 },
  { name: "domstroy24.ru", value: 31200 },
  { name: "medclinica.ru", value: 24800 },
  { name: "fitnessclub.ru", value: 18600 },
  { name: "autoservice.ru", value: 12100 },
];

const managerKpi = [
  { name: "Иван Петров", pct: 87 },
  { name: "Алиса Синицына", pct: 92 },
  { name: "Дмитрий Козлов", pct: 74 },
  { name: "Мария Волкова", pct: 68 },
];

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["crm-tasks-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("crm_tasks").select("*, project:projects(name, url)").order("deadline", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members-dashboard"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("id, full_name, role");
      if (error) throw error;
      return data;
    },
  });

  const overdueTasks = tasks.filter(t => t.deadline && isPast(parseISO(t.deadline)) && t.stage !== "Закрыто");
  const activeProjects = projects.length;

  const getAssigneeName = (id: string | null) => {
    if (!id) return "—";
    const m = members.find(m => m.id === id);
    return m?.full_name || "—";
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground">Дашборд</h1>
          <p className="text-[13px] text-muted-foreground mt-0.5">Сводка по SEO-отделу</p>
        </div>
        <AddProjectWizard onCreated={(id) => navigate(`/project/${id}`)} />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {/* Проекты */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Проекты в работе</p>
              <p className="text-3xl font-bold text-foreground mt-1">{activeProjects}</p>
              <p className="text-[12px] text-muted-foreground mt-1">активных проектов</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-accent/10 flex items-center justify-center">
              <FolderKanban className="h-5 w-5 text-accent" />
            </div>
          </div>
        </Card>

        {/* Трафик */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Органический трафик</p>
              <p className="text-3xl font-bold text-foreground mt-1">124 500</p>
              <p className="text-[12px] text-muted-foreground mt-1">визитов за месяц</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowUp className="h-3 w-3 text-success" />
                <span className="text-[11px] font-medium text-success">+12% к прошлому месяцу</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-success/10 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-success" />
            </div>
          </div>
        </Card>

        {/* Средняя позиция */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Средняя позиция</p>
              <p className="text-3xl font-bold text-foreground mt-1">14.3</p>
              <p className="text-[12px] text-muted-foreground mt-1">по ключевым словам</p>
              <div className="flex items-center gap-1 mt-1">
                <ArrowDown className="h-3 w-3 text-destructive" />
                <span className="text-[11px] font-medium text-destructive">-2.1 к прошлому месяцу</span>
              </div>
            </div>
            <div className="h-10 w-10 rounded-lg bg-warning/10 flex items-center justify-center">
              <Key className="h-5 w-5 text-warning" />
            </div>
          </div>
        </Card>

        {/* Просроченные */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border border-l-[3px] border-l-destructive">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide">Просроченные дедлайны</p>
              <p className="text-3xl font-bold text-destructive mt-1">{overdueTasks.length || 5}</p>
              <p className="text-[12px] text-muted-foreground mt-1">проектов просрочено</p>
            </div>
            <div className="h-10 w-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
          </div>
        </Card>

        {/* KPI менеджеров */}
        <Card className="p-4 bg-card rounded-lg shadow-sm border border-border">
          <p className="text-[12px] text-muted-foreground font-medium uppercase tracking-wide mb-3">KPI менеджеров</p>
          <div className="space-y-2.5">
            {managerKpi.map(m => (
              <div key={m.name}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[12px] text-foreground">{m.name.split(" ")[0]}</span>
                  <span className="text-[11px] font-medium text-foreground">{m.pct}%</span>
                </div>
                <Progress value={m.pct} className="h-1.5" />
              </div>
            ))}
          </div>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Traffic line chart */}
        <Card className="lg:col-span-3 p-5 bg-card rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Органический трафик по месяцам</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={trafficByMonth}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="month" tick={{ fontSize: 12, fill: 'hsl(var(--muted-foreground))' }} />
                <YAxis tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => [v.toLocaleString("ru-RU"), ""]}
                />
                <Line type="monotone" dataKey="current" stroke="#2FC6F6" strokeWidth={2.5} dot={{ r: 4, fill: "#2FC6F6" }} name="Текущий год" />
                <Line type="monotone" dataKey="prev" stroke="#828282" strokeWidth={1.5} strokeDasharray="5 5" dot={{ r: 3, fill: "#828282" }} name="Прошлый год" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center gap-6 mt-3">
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded bg-accent" />
              <span className="text-[11px] text-muted-foreground">Текущий год</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="h-0.5 w-5 rounded bg-muted-foreground border-dashed" style={{ borderTop: '2px dashed #828282', height: 0 }} />
              <span className="text-[11px] text-muted-foreground">Прошлый год</span>
            </div>
          </div>
        </Card>

        {/* Top projects bar chart */}
        <Card className="lg:col-span-2 p-5 bg-card rounded-lg shadow-sm border border-border">
          <h3 className="text-sm font-semibold text-foreground mb-4">Топ-5 проектов по трафику</h3>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart layout="vertical" data={topProjects} margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 11, fill: 'hsl(var(--muted-foreground))' }} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }} width={100} />
                <Tooltip
                  contentStyle={{ background: 'hsl(var(--card))', border: '1px solid hsl(var(--border))', borderRadius: 6, fontSize: 12 }}
                  formatter={(v: number) => [v.toLocaleString("ru-RU") + " визитов", ""]}
                />
                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20}>
                  {topProjects.map((_, i) => (
                    <Cell key={i} fill={i === 0 ? "#2FC6F6" : i === 1 ? "#4CAF50" : "#E0E0E0"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Overdue table */}
      <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
        <div className="flex items-center gap-3 p-4 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Просроченные проекты</h3>
          <span className="px-2 py-0.5 text-[11px] font-semibold bg-destructive/10 text-destructive rounded-full">
            {overdueTasks.length || 5}
          </span>
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
              {overdueTasks.length > 0 ? overdueTasks.slice(0, 10).map(t => {
                const project = t.project as any;
                return (
                  <tr key={t.id} className="bg-destructive/[0.03] hover:bg-destructive/[0.06]">
                    <td className="text-[13px] text-foreground font-medium">{project?.name || "—"}</td>
                    <td className="text-[13px] text-muted-foreground">{project?.url || "—"}</td>
                    <td className="text-[13px] text-destructive font-medium">
                      {t.deadline ? format(parseISO(t.deadline), "dd.MM.yyyy") : "—"}
                    </td>
                    <td className="text-[13px] text-muted-foreground">{getAssigneeName(t.assignee_id)}</td>
                    <td>
                      <span className="px-2 py-0.5 text-[11px] rounded-full font-medium" style={{ background: `${t.stage_color || '#3b82f6'}20`, color: t.stage_color || '#3b82f6' }}>
                        {t.stage}
                      </span>
                    </td>
                    <td>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]" onClick={() => t.project_id && navigate(`/crm-projects/${t.project_id}`)}>
                        Открыть
                      </Button>
                    </td>
                  </tr>
                );
              }) : (
                /* Demo rows when no real overdue tasks */
                [
                  { client: "KAT-Lubricants", domain: "kat-lub.ru", date: "28.03.2026", manager: "Иван Петров", stage: "Аудит", color: "#FF9800" },
                  { client: "МедКлиника+", domain: "medclinica.ru", date: "25.03.2026", manager: "Алиса Синицына", stage: "Контент", color: "#9C27B0" },
                  { client: "АвтоПартс", domain: "avto-parts.ru", date: "20.03.2026", manager: "Дмитрий Козлов", stage: "Ссылки", color: "#2196F3" },
                  { client: "ФитнесКлуб", domain: "fitnessclub.ru", date: "15.03.2026", manager: "Мария Волкова", stage: "Оптимизация", color: "#4CAF50" },
                  { client: "СтройДом24", domain: "domstroy24.ru", date: "10.03.2026", manager: "Иван Петров", stage: "Техаудит", color: "#FF5752" },
                ].map((row, i) => (
                  <tr key={i} className="bg-destructive/[0.03] hover:bg-destructive/[0.06]">
                    <td className="text-[13px] text-foreground font-medium">{row.client}</td>
                    <td className="text-[13px] text-muted-foreground">{row.domain}</td>
                    <td className="text-[13px] text-destructive font-medium">{row.date}</td>
                    <td className="text-[13px] text-muted-foreground">{row.manager}</td>
                    <td>
                      <span className="px-2 py-0.5 text-[11px] rounded-full font-medium" style={{ background: `${row.color}20`, color: row.color }}>
                        {row.stage}
                      </span>
                    </td>
                    <td>
                      <Button variant="outline" size="sm" className="h-7 text-[11px]">Открыть</Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
};

export default Index;
