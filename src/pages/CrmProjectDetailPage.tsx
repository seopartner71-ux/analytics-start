import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  ArrowLeft, Plus, Send, Clock, CalendarDays, User, Tag, FileText,
  Upload, Download, Trash2, Loader2, Globe, Edit, XCircle, MessageSquare,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type CrmTask = Tables<"crm_tasks"> & {
  assignee?: Tables<"team_members"> | null;
};
type TaskComment = Tables<"task_comments"> & {
  author?: Tables<"team_members"> | null;
};

const STAGES = [
  { key: "Новые заявки", color: "#9E9E9E" },
  { key: "Анализ сайта", color: "#2196F3" },
  { key: "Составление стратегии", color: "#FF9800" },
  { key: "В работе", color: "#4CAF50" },
  { key: "На проверке", color: "#9C27B0" },
  { key: "Успешно завершено", color: "#4CAF50" },
  { key: "Отказ", color: "#F44336" },
];

const TASK_STAGES = ["Новые", "В работе", "Ждёт выполнения", "Завершена"];
const PRIORITY_MAP: Record<string, { label: string; color: string }> = {
  high: { label: "Высокий", color: "#F44336" },
  medium: { label: "Средний", color: "#FF9800" },
  low: { label: "Низкий", color: "#4CAF50" },
};
const TAGS = ["SEO", "Аудит", "Ссылки", "Контент", "Техаудит"];

function AvatarCircle({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  const sz = size === "md" ? "h-9 w-9 text-[12px]" : "h-6 w-6 text-[10px]";
  return (
    <div className={`${sz} rounded-full bg-primary/15 text-primary font-bold flex items-center justify-center shrink-0`}>
      {initials}
    </div>
  );
}

export default function CrmProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  // Project
  const { data: project, isLoading: projectLoading } = useQuery({
    queryKey: ["project-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, company:companies(*)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Tasks
  const { data: tasks = [] } = useQuery({
    queryKey: ["project-tasks", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("*, assignee:team_members!crm_tasks_assignee_id_fkey(*)")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as CrmTask[];
    },
    enabled: !!id,
  });

  // Members
  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name").order("full_name");
      return data || [];
    },
  });

  // Comments for project-level activity
  const { data: projectComments = [] } = useQuery({
    queryKey: ["project-comments", id],
    queryFn: async () => {
      // Get all comments for all tasks in this project
      const taskIds = tasks.map(t => t.id);
      if (taskIds.length === 0) return [];
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, author:team_members(*)")
        .in("task_id", taskIds)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data as TaskComment[];
    },
    enabled: tasks.length > 0,
  });

  const [commentText, setCommentText] = useState("");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", deadline: "", assignee_id: "" });

  // Toggle task completion
  const toggleTask = useMutation({
    mutationFn: async ({ taskId, done }: { taskId: string; done: boolean }) => {
      const { error } = await supabase.from("crm_tasks").update({
        stage: done ? "Завершена" : "Новые",
        stage_color: done ? "#10b981" : "#3b82f6",
      }).eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["project-tasks", id] }),
  });

  // Add task
  const addTask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("crm_tasks").insert({
        title: newTask.title,
        priority: newTask.priority,
        deadline: newTask.deadline || null,
        assignee_id: newTask.assignee_id || null,
        project_id: id!,
        owner_id: user!.id,
        stage: "Новые",
        stage_color: "#3b82f6",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-tasks", id] });
      setAddTaskOpen(false);
      setNewTask({ title: "", priority: "medium", deadline: "", assignee_id: "" });
      toast.success("Задача создана");
    },
  });

  // Send comment (to first task or create a system comment)
  const sendComment = useMutation({
    mutationFn: async () => {
      if (tasks.length === 0) {
        toast.error("Сначала создайте задачу");
        return;
      }
      const { error } = await supabase.from("task_comments").insert({
        task_id: tasks[0].id,
        body: commentText,
        is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["project-comments", id] });
      toast.success("Комментарий добавлен");
    },
  });

  // Update project stage
  const updateStage = useMutation({
    mutationFn: async (stage: string) => {
      const { error } = await supabase.from("projects").update({ privacy: stage }).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-detail", id] });
      toast.success("Этап обновлён");
    },
  });

  const completedCount = tasks.filter(t => t.stage === "Завершена").length;
  const totalCount = tasks.length;
  const progressPct = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  const managerName = project?.seo_specialist ||
    (project?.seo_specialist_id ? members.find(m => m.id === project.seo_specialist_id)?.full_name : null);

  const currentStage = STAGES.find(s => s.key === (project?.privacy || "Новые заявки"));

  if (projectLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="text-center py-20 text-muted-foreground">
        Проект не найден
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/crm-projects")} className="h-8 w-8 text-muted-foreground">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold text-foreground">{project.company?.name || project.name}</h1>
              <Badge
                className="text-[11px] font-medium border-0"
                style={{ backgroundColor: `${currentStage?.color || '#9E9E9E'}20`, color: currentStage?.color || '#9E9E9E' }}
              >
                {project.privacy || "Новые заявки"}
              </Badge>
            </div>
            {project.url && (
              <div className="flex items-center gap-1.5 mt-0.5">
                <Globe className="h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-[13px] text-muted-foreground">{project.url}</span>
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {managerName && (
            <div className="flex items-center gap-2 mr-3">
              <AvatarCircle name={managerName} size="md" />
              <span className="text-[13px] text-foreground">{managerName}</span>
            </div>
          )}
          <Button variant="outline" size="sm" className="h-8 text-[13px] gap-1.5">
            <Edit className="h-3.5 w-3.5" /> Редактировать
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[13px] gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
            <XCircle className="h-3.5 w-3.5" /> Закрыть проект
          </Button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        {/* LEFT COLUMN (65%) */}
        <div className="lg:col-span-3 space-y-5">
          {/* Tasks checklist */}
          <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-border">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-foreground">Чеклист задач</h3>
                <span className="text-[12px] text-muted-foreground">{completedCount} из {totalCount} выполнено</span>
              </div>
              <Dialog open={addTaskOpen} onOpenChange={setAddTaskOpen}>
                <DialogTrigger asChild>
                  <Button size="sm" className="h-7 text-[12px] gap-1">
                    <Plus className="h-3.5 w-3.5" /> Добавить задачу
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md">
                  <DialogHeader><DialogTitle>Новая задача</DialogTitle></DialogHeader>
                  <div className="space-y-3 mt-2">
                    <div>
                      <Label className="text-[12px]">Название</Label>
                      <Input value={newTask.title} onChange={e => setNewTask(f => ({ ...f, title: e.target.value }))} placeholder="Название задачи" className="mt-1" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <Label className="text-[12px]">Приоритет</Label>
                        <Select value={newTask.priority} onValueChange={v => setNewTask(f => ({ ...f, priority: v }))}>
                          <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">Высокий</SelectItem>
                            <SelectItem value="medium">Средний</SelectItem>
                            <SelectItem value="low">Низкий</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label className="text-[12px]">Срок</Label>
                        <Input type="date" value={newTask.deadline} onChange={e => setNewTask(f => ({ ...f, deadline: e.target.value }))} className="mt-1" />
                      </div>
                    </div>
                    <div>
                      <Label className="text-[12px]">Исполнитель</Label>
                      <Select value={newTask.assignee_id} onValueChange={v => setNewTask(f => ({ ...f, assignee_id: v }))}>
                        <SelectTrigger className="mt-1"><SelectValue placeholder="Выбрать..." /></SelectTrigger>
                        <SelectContent>
                          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <Button onClick={() => addTask.mutate()} disabled={!newTask.title.trim() || addTask.isPending} className="w-full">
                      Создать задачу
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* Progress bar */}
            <div className="px-4 pt-3">
              <Progress value={progressPct} className="h-2" />
            </div>

            {/* Task rows */}
            <div className="divide-y divide-border/40">
              {tasks.length === 0 ? (
                <div className="py-12 text-center">
                  <FileText className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-[13px] text-muted-foreground">Нет данных</p>
                </div>
              ) : tasks.map((task, i) => {
                const done = task.stage === "Завершена";
                const pri = PRIORITY_MAP[task.priority] || PRIORITY_MAP.medium;
                const overdue = task.deadline && isPast(parseISO(task.deadline)) && !done;
                return (
                  <div
                    key={task.id}
                    className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors", i % 2 === 1 && "bg-muted/10")}
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(v) => toggleTask.mutate({ taskId: task.id, done: !!v })}
                    />
                    <span className={cn("flex-1 text-[13px] text-foreground", done && "line-through text-muted-foreground")}>
                      {task.title}
                    </span>
                    {task.assignee && <AvatarCircle name={task.assignee.full_name} />}
                    {task.deadline && (
                      <span className={cn("text-[11px]", overdue ? "text-destructive font-medium" : "text-muted-foreground")}>
                        {format(parseISO(task.deadline), "dd.MM")}
                      </span>
                    )}
                    <span
                      className="text-[10px] px-1.5 py-0.5 rounded font-medium"
                      style={{ backgroundColor: `${pri.color}15`, color: pri.color }}
                    >
                      {pri.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </Card>

          {/* Comments */}
          <Card className="bg-card rounded-lg shadow-sm border border-border overflow-hidden">
            <div className="flex items-center gap-2 p-4 border-b border-border">
              <MessageSquare className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-semibold text-foreground">Комментарии</h3>
              <Badge variant="secondary" className="text-[10px] h-5">{projectComments.length}</Badge>
            </div>
            <div className="max-h-[400px] overflow-y-auto divide-y divide-border/30">
              {projectComments.length === 0 ? (
                <div className="py-12 text-center">
                  <MessageSquare className="h-10 w-10 mx-auto mb-2 text-muted-foreground/20" />
                  <p className="text-[13px] text-muted-foreground">Нет данных</p>
                </div>
              ) : projectComments.map(c => (
                <div key={c.id} className="flex gap-3 p-4">
                  <AvatarCircle name={c.author?.full_name || "?"} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-[13px] font-semibold text-foreground">{c.author?.full_name || "Аноним"}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {format(parseISO(c.created_at), "dd.MM.yyyy HH:mm")}
                      </span>
                    </div>
                    <p className="text-[13px] text-foreground leading-relaxed">{c.body}</p>
                  </div>
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border flex gap-2">
              <Input
                placeholder="Написать комментарий..."
                value={commentText}
                onChange={e => setCommentText(e.target.value)}
                className="flex-1 h-9 text-[13px]"
                onKeyDown={e => e.key === "Enter" && commentText.trim() && sendComment.mutate()}
              />
              <Button size="sm" className="h-9 px-4" disabled={!commentText.trim() || sendComment.isPending} onClick={() => sendComment.mutate()}>
                <Send className="h-4 w-4 mr-1.5" /> Отправить
              </Button>
            </div>
          </Card>
        </div>

        {/* RIGHT COLUMN (35%) */}
        <div className="lg:col-span-2 space-y-5">
          {/* Project info */}
          <Card className="bg-card rounded-lg shadow-sm border border-border p-5 space-y-4">
            <h3 className="text-sm font-semibold text-foreground mb-1">Информация о проекте</h3>

            {/* Deadline */}
            <div className="flex items-start gap-3">
              <CalendarDays className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Дедлайн</p>
                <p className={cn("text-[13px] font-medium", project.updated_at && isPast(parseISO(project.updated_at)) ? "text-destructive" : "text-foreground")}>
                  {format(parseISO(project.created_at), "dd.MM.yyyy")}
                </p>
              </div>
            </div>

            {/* Manager */}
            <div className="flex items-start gap-3">
              <User className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Ответственный</p>
                {managerName ? (
                  <div className="flex items-center gap-2 mt-1">
                    <AvatarCircle name={managerName} />
                    <span className="text-[13px] font-medium text-foreground">{managerName}</span>
                  </div>
                ) : (
                  <p className="text-[13px] text-muted-foreground">Не назначен</p>
                )}
              </div>
            </div>

            {/* Stage selector */}
            <div className="flex items-start gap-3">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div className="flex-1">
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Этап воронки</p>
                <Select value={project.privacy || "Новые заявки"} onValueChange={v => updateStage.mutate(v)}>
                  <SelectTrigger className="h-8 text-[13px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STAGES.map(s => (
                      <SelectItem key={s.key} value={s.key}>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                          {s.key}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tags */}
            <div className="flex items-start gap-3">
              <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1.5">Теги</p>
                <div className="flex flex-wrap gap-1.5">
                  {TAGS.map(tag => (
                    <Badge key={tag} variant="secondary" className="text-[11px] font-medium">{tag}</Badge>
                  ))}
                </div>
              </div>
            </div>

            {/* Created date */}
            <div className="flex items-start gap-3">
              <Clock className="h-4 w-4 text-muted-foreground mt-0.5" />
              <div>
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide">Дата создания</p>
                <p className="text-[13px] text-foreground">{format(parseISO(project.created_at), "dd.MM.yyyy")}</p>
              </div>
            </div>
          </Card>

          {/* File upload */}
          <Card className="bg-card rounded-lg shadow-sm border border-border p-5">
            <h3 className="text-sm font-semibold text-foreground mb-3">Файлы проекта</h3>

            {/* Drop zone */}
            <div className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/30 transition-colors cursor-pointer">
              <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              <p className="text-[13px] text-muted-foreground">Перетащите файлы или нажмите для загрузки</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">PDF, DOCX, XLSX, PNG</p>
            </div>

            {/* Demo files */}
            <div className="mt-4 space-y-2">
              {[
                { name: "Технический_аудит.pdf", size: "2.4 MB", date: "01.04.2026" },
                { name: "Семантическое_ядро.xlsx", size: "1.1 MB", date: "28.03.2026" },
                { name: "Стратегия_продвижения.docx", size: "340 KB", date: "25.03.2026" },
              ].map(file => (
                <div key={file.name} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                  <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-medium text-foreground truncate">{file.name}</p>
                    <p className="text-[10px] text-muted-foreground">{file.size} · {file.date}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground">
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
