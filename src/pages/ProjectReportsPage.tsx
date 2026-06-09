import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Bell, Trash2, Pencil, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";

type Status = "planned" | "in_progress" | "sent" | "overdue" | "cancelled";
const STATUS_LABEL: Record<Status, string> = {
  planned: "Запланирован",
  in_progress: "В работе",
  sent: "Сдан",
  overdue: "Просрочен",
  cancelled: "Отменён",
};
const STATUS_COLOR: Record<Status, string> = {
  planned: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  in_progress: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  sent: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  overdue: "bg-red-500/15 text-red-400 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

interface ReportRow {
  id: string;
  owner_id: string;
  project_id: string | null;
  client_name: string;
  title: string;
  due_date: string;
  status: Status;
  comment: string;
  assignee_id: string | null;
  co_assignee_ids: string[];
  reminder_2d_sent: boolean;
  reminder_1d_sent: boolean;
}

const empty = (): Partial<ReportRow> => ({
  client_name: "",
  title: "",
  due_date: format(new Date(), "yyyy-MM-dd"),
  status: "planned",
  comment: "",
  project_id: null,
  assignee_id: null,
  co_assignee_ids: [],
});

export default function ProjectReportsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Partial<ReportRow> | null>(null);
  const [filter, setFilter] = useState<"all" | Status>("all");

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["project-reports"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_reports")
        .select("*")
        .order("due_date", { ascending: true });
      if (error) throw error;
      return data as ReportRow[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("projects")
        .select("id, name")
        .is("archived_at", null)
        .order("name");
      return data || [];
    },
  });

  const { data: team = [] } = useQuery({
    queryKey: ["team-for-reports"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id, full_name, email")
        .is("archived_at", null)
        .order("full_name");
      return data || [];
    },
  });

  const projectMap = new Map(projects.map((p: any) => [p.id, p.name]));
  const teamMap = new Map(team.map((t: any) => [t.id, t.full_name]));

  const filtered = reports.filter(r => filter === "all" || r.status === filter);
  const upcoming2 = reports.filter(r => {
    const d = Math.round((new Date(r.due_date).getTime() - Date.now()) / 86400000);
    return d === 2 && ["planned", "in_progress"].includes(r.status);
  }).length;
  const upcoming1 = reports.filter(r => {
    const d = Math.round((new Date(r.due_date).getTime() - Date.now()) / 86400000);
    return d <= 1 && d >= 0 && ["planned", "in_progress"].includes(r.status);
  }).length;
  const overdue = reports.filter(r => {
    const d = Math.round((new Date(r.due_date).getTime() - Date.now()) / 86400000);
    return d < 0 && !["sent", "cancelled"].includes(r.status);
  }).length;

  const handleSave = async () => {
    if (!editing || !user) return;
    if (!editing.client_name && !editing.project_id) {
      toast.error("Укажите клиента или проект");
      return;
    }
    if (!editing.due_date) {
      toast.error("Укажите дату сдачи");
      return;
    }
    const payload: any = {
      client_name: editing.client_name || "",
      title: editing.title || "",
      due_date: editing.due_date,
      status: editing.status || "planned",
      comment: editing.comment || "",
      project_id: editing.project_id || null,
      assignee_id: editing.assignee_id || null,
      co_assignee_ids: editing.co_assignee_ids || [],
    };
    if (editing.id) {
      const { error } = await supabase.from("project_reports").update(payload).eq("id", editing.id);
      if (error) return toast.error(error.message);
      toast.success("Отчёт обновлён");
    } else {
      payload.owner_id = user.id;
      const { error } = await supabase.from("project_reports").insert(payload);
      if (error) return toast.error(error.message);
      toast.success("Отчёт добавлен");
    }
    setOpen(false);
    setEditing(null);
    qc.invalidateQueries({ queryKey: ["project-reports"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить запись?")) return;
    const { error } = await supabase.from("project_reports").delete().eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Удалено");
    qc.invalidateQueries({ queryKey: ["project-reports"] });
  };

  const quickStatus = async (id: string, status: Status) => {
    const { error } = await supabase.from("project_reports").update({ status }).eq("id", id);
    if (error) return toast.error(error.message);
    qc.invalidateQueries({ queryKey: ["project-reports"] });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Отчётность по проектам</h1>
          <p className="text-sm text-muted-foreground">График сдачи отчётов клиентам. Напоминания приходят за 2 дня и за 1 день.</p>
        </div>
        <Button onClick={() => { setEditing(empty()); setOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" /> Добавить отчёт
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Всего</div>
          <div className="text-2xl font-bold">{reports.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Bell className="h-3 w-3" /> Через 2 дня</div>
          <div className="text-2xl font-bold text-amber-400">{upcoming2}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground flex items-center gap-1"><Bell className="h-3 w-3" /> Завтра/сегодня</div>
          <div className="text-2xl font-bold text-orange-400">{upcoming1}</div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">Просрочено</div>
          <div className="text-2xl font-bold text-red-400">{overdue}</div>
        </Card>
      </div>

      <div className="flex gap-2 flex-wrap">
        {(["all", "planned", "in_progress", "sent", "overdue", "cancelled"] as const).map(s => (
          <Button key={s} size="sm" variant={filter === s ? "default" : "outline"} onClick={() => setFilter(s)}>
            {s === "all" ? "Все" : STATUS_LABEL[s as Status]}
          </Button>
        ))}
      </div>

      <Card>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Дата сдачи</TableHead>
              <TableHead>Клиент / Проект</TableHead>
              <TableHead>Тема отчёта</TableHead>
              <TableHead>Ответственный</TableHead>
              <TableHead>Статус</TableHead>
              <TableHead>Комментарий</TableHead>
              <TableHead className="w-24"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Загрузка…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Нет записей</TableCell></TableRow>
            ) : filtered.map(r => {
              const days = Math.round((new Date(r.due_date).getTime() - Date.now()) / 86400000);
              const dueColor = days < 0 ? "text-red-400" : days <= 1 ? "text-orange-400" : days <= 2 ? "text-amber-400" : "text-foreground";
              const done = r.status === "sent" || r.status === "cancelled";
              return (
                <TableRow key={r.id} className={done ? "opacity-60" : ""}>
                  <TableCell className={`${done ? "line-through decoration-foreground/40" : ""} ${dueColor}`}>
                    <div className="flex items-center gap-1.5">
                      <CalendarDays className="h-3.5 w-3.5" />
                      <div>
                        <div className="text-sm font-medium">{format(new Date(r.due_date), "d MMM yyyy", { locale: ru })}</div>
                        <div className="text-xs opacity-70">{days < 0 ? `просрочка ${Math.abs(days)} дн` : days === 0 ? "сегодня" : `через ${days} дн`}</div>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell className={done ? "line-through decoration-foreground/40" : ""}>
                    <div className="text-sm">{r.client_name || "—"}</div>
                    {r.project_id && <div className="text-xs text-muted-foreground">{projectMap.get(r.project_id) || "проект"}</div>}
                  </TableCell>
                  <TableCell className={`text-sm ${done ? "line-through decoration-foreground/40" : ""}`}>{r.title || "—"}</TableCell>
                  <TableCell className={`text-sm ${done ? "line-through decoration-foreground/40" : ""}`}>
                    <div>{r.assignee_id ? teamMap.get(r.assignee_id) : "—"}</div>
                    {r.co_assignee_ids?.length > 0 && (
                      <div className="text-xs text-muted-foreground mt-0.5">
                        + {r.co_assignee_ids.map(id => teamMap.get(id)).filter(Boolean).join(", ")}
                      </div>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select value={r.status} onValueChange={(v) => quickStatus(r.id, v as Status)}>
                      <SelectTrigger className={`h-7 text-xs w-32 border ${STATUS_COLOR[r.status]}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
                          <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className={`text-xs text-muted-foreground max-w-[280px] truncate ${done ? "line-through decoration-foreground/40" : ""}`}>{r.comment}</TableCell>
                  <TableCell>
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" onClick={() => { setEditing(r); setOpen(true); }}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => handleDelete(r.id)}>
                        <Trash2 className="h-3.5 w-3.5 text-red-400" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing?.id ? "Редактировать отчёт" : "Новый отчёт"}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Проект</Label>
                  <Select value={editing.project_id || "none"} onValueChange={(v) => setEditing({ ...editing, project_id: v === "none" ? null : v })}>
                    <SelectTrigger><SelectValue placeholder="Не выбран" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">— не выбран —</SelectItem>
                      {projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Клиент</Label>
                  <Input value={editing.client_name || ""} onChange={(e) => setEditing({ ...editing, client_name: e.target.value })} placeholder="Название клиента" />
                </div>
              </div>
              <div>
                <Label>Тема отчёта</Label>
                <Input value={editing.title || ""} onChange={(e) => setEditing({ ...editing, title: e.target.value })} placeholder="Например: SEO-отчёт за ноябрь" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Дата сдачи</Label>
                  <Input type="date" value={editing.due_date || ""} onChange={(e) => setEditing({ ...editing, due_date: e.target.value })} />
                </div>
                <div>
                  <Label>Статус</Label>
                  <Select value={editing.status || "planned"} onValueChange={(v) => setEditing({ ...editing, status: v as Status })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABEL) as Status[]).map(s => (
                        <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label>Соисполнители</Label>
                <div className="border border-border rounded-md p-2 max-h-40 overflow-y-auto space-y-1">
                  {team.filter((t: any) => t.id !== editing.assignee_id).map((t: any) => {
                    const checked = (editing.co_assignee_ids || []).includes(t.id);
                    return (
                      <label key={t.id} className="flex items-center gap-2 text-sm cursor-pointer hover:bg-muted/30 px-2 py-1 rounded">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const cur = editing.co_assignee_ids || [];
                            setEditing({
                              ...editing,
                              co_assignee_ids: e.target.checked ? [...cur, t.id] : cur.filter(id => id !== t.id),
                            });
                          }}
                        />
                        <span>{t.full_name}</span>
                      </label>
                    );
                  })}
                  {team.length === 0 && <div className="text-xs text-muted-foreground px-2">Нет сотрудников</div>}
                </div>
                {(editing.co_assignee_ids?.length || 0) > 0 && (
                  <div className="text-xs text-muted-foreground mt-1">Выбрано: {editing.co_assignee_ids!.length}</div>
                )}
              </div>
              <div>
                <Label>Ответственный</Label>
                <Select value={editing.assignee_id || "none"} onValueChange={(v) => setEditing({ ...editing, assignee_id: v === "none" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="Не назначен" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">— не назначен —</SelectItem>
                    {team.map((t: any) => <SelectItem key={t.id} value={t.id}>{t.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Комментарий</Label>
                <Textarea value={editing.comment || ""} onChange={(e) => setEditing({ ...editing, comment: e.target.value })} rows={3} />
              </div>
              {editing.id && (
                <div className="flex gap-2 text-xs text-muted-foreground">
                  <Badge variant={editing.reminder_2d_sent ? "default" : "outline"}>Напоминание за 2 дня {editing.reminder_2d_sent ? "✓" : ""}</Badge>
                  <Badge variant={editing.reminder_1d_sent ? "default" : "outline"}>Напоминание за день {editing.reminder_1d_sent ? "✓" : ""}</Badge>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="ghost" onClick={() => { setOpen(false); setEditing(null); }}>Отмена</Button>
            <Button onClick={handleSave}>Сохранить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
