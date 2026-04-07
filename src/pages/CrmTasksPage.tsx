import { useState, useEffect, useRef } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  Plus, Search, Clock, AlertTriangle, Send, List, LayoutGrid, GripVertical,
  AlertCircle, ChevronDown, MessageSquare, Hash, Loader2, ClipboardList,
  User, CalendarDays, Hourglass, FolderOpen, Eye, Paperclip, Copy,
  Video, UserPlus, Search as SearchIcon, Edit3, Play, CheckCircle2,
  RotateCcw, Link, FileText, Upload, Briefcase,
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

import { TaskDetailSheet, CrmTask, getAvatarUrl } from "@/components/project/TaskDetailSheet";

type TaskComment = Tables<"task_comments"> & {
  author?: Tables<"team_members"> | null;
};

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

/* ─── Add Task Dialog ─── */
function AddTaskDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ title: "", stage: "Новые", priority: "medium", deadline: "" });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-tasks"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name").order("name");
      return data || [];
    },
  });
  const [projectId, setProjectId] = useState("");

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_tasks").insert({
        title: form.title,
        stage: form.stage,
        stage_color: form.stage === "Новые" ? "#3b82f6" : form.stage === "В работе" ? "#f59e0b" : form.stage === "Завершена" ? "#10b981" : "#8b5cf6",
        priority: form.priority,
        deadline: form.deadline || null,
        project_id: projectId,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      toast.success("Задача создана");
      setOpen(false);
      setForm({ title: "", stage: "Новые", priority: "medium", deadline: "" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 h-8 shadow-sm">
          <Plus className="h-4 w-4" /> Создать
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">Название *</Label><Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Стадия</Label>
              <Select value={form.stage} onValueChange={v => setForm(f => ({ ...f, stage: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Новые">Новые</SelectItem>
                  <SelectItem value="В работе">В работе</SelectItem>
                  <SelectItem value="Ждёт выполнения">Ждёт выполнения</SelectItem>
                  <SelectItem value="Завершена">Завершена</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Приоритет</Label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="high">Высокий</SelectItem>
                  <SelectItem value="medium">Средний</SelectItem>
                  <SelectItem value="low">Низкий</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Крайний срок</Label><Input type="datetime-local" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} /></div>
            <div><Label className="text-xs">Проект *</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger className={cn(!projectId && "border-destructive")}><SelectValue placeholder="Выбрать..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!form.title.trim() || !projectId || mutation.isPending} className="w-full">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Создать задачу
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}


function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-3 border-b border-border/30 last:border-0 group">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-1 uppercase tracking-wider">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ─── Kanban ─── */
function KanbanView({ tasks, onSelect }: { tasks: CrmTask[]; onSelect: (t: CrmTask) => void }) {
  const stages = ["Новые", "В работе", "Ждёт выполнения", "Завершена"];
  const stageColors: Record<string, string> = {
    "Новые": "#3b82f6",
    "В работе": "#f59e0b",
    "Ждёт выполнения": "#8b5cf6",
    "Завершена": "#10b981",
  };
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stages.map(stage => {
        const stageTasks = tasks.filter(t => t.stage === stage);
        const color = stageColors[stage];
        return (
          <div key={stage} className="space-y-2.5">
            <div className="flex items-center gap-2 pb-2.5 border-b-2" style={{ borderColor: color }}>
              <span className="text-sm font-semibold text-foreground">{stage}</span>
              <Badge variant="secondary" className="text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full">{stageTasks.length}</Badge>
            </div>
            <AnimatePresence>
              {stageTasks.map((t, i) => {
                const isOverdue = t.deadline ? new Date(t.deadline) < new Date() && t.stage !== "Завершена" : false;
                return (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, scale: 0.97 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.05, duration: 0.2 }}
                  >
                    <Card className="cursor-pointer card-glow" onClick={() => onSelect(t)}>
                      <CardContent className="p-3.5 space-y-2.5">
                        <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{t.title}</p>
                        <div className="flex items-center justify-between">
                          <span className={`text-[11px] ${isOverdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                            {isOverdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                            {t.deadline ? new Date(t.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "short" }) : "—"}
                          </span>
                          {t.assignee && <AvatarCircle initials={getInitials(t.assignee.full_name)} className="h-6 w-6 text-[10px]" />}
                        </div>
                        <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted">
                          <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.stage_progress || 0}%`, backgroundColor: color }} />
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Tasks Page ─── */
export default function CrmTasksPage() {
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["crm-tasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*, creator:team_members!crm_tasks_creator_id_fkey(*), assignee:team_members!crm_tasks_assignee_id_fkey(*), project:projects(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CrmTask[];
    },
  });

  const filtered = tasks.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    (t.assignee?.full_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (t.project?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  const overdueCount = tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.stage !== "Завершена").length;

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Задачи</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего: <span className="font-medium text-foreground">{tasks.length}</span>
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск задачи..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/30 border-border/60 focus:bg-card transition-colors" />
          </div>
          <AddTaskDialog />
        </div>
      </div>

      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="h-8 text-xs gap-1.5 rounded-b-none" onClick={() => setView("list")}>
          <List className="h-3.5 w-3.5" /> Список
        </Button>
        <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" className="h-8 text-xs gap-1.5 rounded-b-none" onClick={() => setView("kanban")}>
          <LayoutGrid className="h-3.5 w-3.5" /> Канбан
        </Button>
        <div className="w-px h-5 bg-border mx-2" />
        {overdueCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
            <AlertCircle className="h-3 w-3" />{overdueCount} Просрочены
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] h-5 ml-1">Все: {tasks.length}</Badge>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : tasks.length === 0 ? (
        <div className="text-center py-20">
          <ClipboardList className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Нет задач. Создайте первую!</p>
        </div>
      ) : view === "kanban" ? (
        <KanbanView tasks={filtered} onSelect={setSelectedTask} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
            <table className="crm-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-8"><Checkbox /></th>
                  <th className="w-8"></th>
                  <th>Название</th>
                  <th>Стадия</th>
                  <th>Крайний срок</th>
                  <th></th>
                  <th>Постановщик</th>
                  <th>Исполнитель</th>
                  <th>Проект</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((t, idx) => {
                    const isOverdue = t.deadline ? new Date(t.deadline) < new Date() && t.stage !== "Завершена" : false;
                    const diffD = t.deadline ? Math.abs(Math.ceil((new Date(t.deadline).getTime() - Date.now()) / 86400000)) : 0;

                    return (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        onClick={() => setSelectedTask(t)}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                        </td>
                        <td className="text-muted-foreground/20"><GripVertical className="h-4 w-4" /></td>
                        <td className="max-w-[280px]">
                          <p className="text-sm font-medium text-foreground leading-snug">{t.title}</p>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <div className="w-24 h-2 rounded-full overflow-hidden bg-muted">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.stage_progress || 0}%`, backgroundColor: t.stage_color || "#3b82f6" }} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{t.stage}</span>
                          </div>
                        </td>
                        <td>
                          {t.deadline ? (
                            <div className="flex items-center gap-1.5">
                              {isOverdue && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                              <span className="text-sm text-muted-foreground">
                                {new Date(t.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                              </span>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td>
                          {isOverdue && (
                            <Badge className="text-[10px] bg-destructive/10 text-destructive border-0 hover:bg-destructive/10 font-medium">
                              – {Math.ceil(diffD / 30)} мес.
                            </Badge>
                          )}
                        </td>
                        <td>
                          {t.creator ? (
                            <div className="flex items-center gap-2">
                              <AvatarCircle initials={getInitials(t.creator.full_name)} className="h-7 w-7 text-[10px]" />
                              <span className="text-sm text-foreground">{t.creator.full_name}</span>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td>
                          {t.assignee ? (
                            <div className="flex items-center gap-2">
                              <AvatarCircle initials={getInitials(t.assignee.full_name)} className="h-7 w-7 text-[10px]" />
                              <span className="text-sm text-foreground">{t.assignee.full_name}</span>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                        <td>
                          {t.project ? (
                            <div className="flex items-center gap-2">
                              <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                                <span className="text-[7px] font-bold text-primary">{t.project.name.slice(0, 2).toUpperCase()}</span>
                              </div>
                              <span className="text-sm text-muted-foreground">{t.project.name}</span>
                            </div>
                          ) : <span className="text-sm text-muted-foreground">—</span>}
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Отмечено: <span className="font-medium text-foreground">{selected.size}</span> / {tasks.length}</span>
          </div>
        </>
      )}

      <TaskDetailSheet task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
