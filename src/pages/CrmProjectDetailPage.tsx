import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Plus, Send, Clock, CalendarDays, User, Tag, FileText,
  Upload, Download, Trash2, Loader2, Globe, Edit, XCircle, MessageSquare,
  BarChart3, ShieldCheck, ClipboardCheck, Search, Smartphone, Zap, MessagesSquare,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isPast, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";
import ProjectAnalyticsTab from "@/components/project/ProjectAnalyticsTab";
import SiteHealthDetailTab from "@/components/project/SiteHealthDetailTab";
import EditProjectDialog from "@/components/project/EditProjectDialog";
import { TaskDetailSheet, CrmTask } from "@/components/project/TaskDetailSheet";
import { TechnicalAuditTab } from "@/components/project/TechnicalAuditTab";
import { MobileFriendlyTab } from "@/components/project/MobileFriendlyTab";
import { PageSpeedTab } from "@/components/project/PageSpeedTab";
import { YandexWebmasterTab } from "@/components/project/YandexWebmasterTab";
import { GscAnalysisTab } from "@/components/project/GscAnalysisTab";
import { ProjectChatTab } from "@/components/project/ProjectChatTab";

type TaskComment = Tables<"task_comments"> & {
  author?: Tables<"team_members"> | null;
};

const STAGES = [
  { key: "В работе", color: "#4CAF50" },
  { key: "На паузе", color: "#FF9800" },
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
  const [searchParams] = useSearchParams();
  const { user, canEdit, isViewer } = useAuth();
  const queryClient = useQueryClient();
  const defaultTab = searchParams.get("tab") === "analytics" ? "analytics" : searchParams.get("tab") === "health" ? "health" : "checklist";

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

  // Project-level comments
  const { data: projectComments = [] } = useQuery({
    queryKey: ["project-comments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_comments")
        .select("*, author:team_members(*)")
        .eq("project_id", id!)
        .order("created_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Project files
  const { data: projectFiles = [] } = useQuery({
    queryKey: ["project-files", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_files")
        .select("*")
        .eq("project_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Realtime comments
  useEffect(() => {
    if (!id) return;
    const channel = supabase
      .channel(`project-comments-${id}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "project_comments", filter: `project_id=eq.${id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["project-comments", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id, queryClient]);

  const [commentText, setCommentText] = useState("");
  const [addTaskOpen, setAddTaskOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [newTask, setNewTask] = useState({ title: "", priority: "medium", deadline: "", assignee_id: "" });
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);

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

  // Send project comment
  const sendComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_comments").insert({
        project_id: id!,
        body: commentText,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setCommentText("");
      queryClient.invalidateQueries({ queryKey: ["project-comments", id] });
    },
  });

  // Upload file
  const handleFileUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0 || !id) return;
    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const path = `${id}/${Date.now()}_${file.name}`;
        const { error: uploadError } = await supabase.storage.from("project-files").upload(path, file);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path);
        await supabase.from("project_files").insert({
          project_id: id,
          name: file.name,
          url: publicUrl,
          size: file.size,
          mime_type: file.type,
        });
      }
      queryClient.invalidateQueries({ queryKey: ["project-files", id] });
      toast.success("Файл загружен");
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки");
    } finally {
      setUploading(false);
    }
  }, [id, queryClient]);

  // Delete file
  const deleteFile = useMutation({
    mutationFn: async (fileId: string) => {
      const { error } = await supabase.from("project_files").delete().eq("id", fileId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-files", id] });
      toast.success("Файл удалён");
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
          <Button variant="outline" size="sm" className="h-8 text-[13px] gap-1.5" onClick={() => setEditOpen(true)}>
            <Edit className="h-3.5 w-3.5" /> Редактировать
          </Button>
          <Button variant="outline" size="sm" className="h-8 text-[13px] gap-1.5 text-destructive border-destructive/30 hover:bg-destructive/5">
            <XCircle className="h-3.5 w-3.5" /> Закрыть проект
          </Button>
        </div>
      </div>

      {/* Tab switcher */}
      <Tabs defaultValue={defaultTab} className="w-full">
        <TabsList className="mb-4">
          <TabsTrigger value="checklist" className="gap-1.5 text-[13px]">
            <FileText className="h-3.5 w-3.5" /> Задачи
          </TabsTrigger>
          <TabsTrigger value="analytics" className="gap-1.5 text-[13px]">
            <BarChart3 className="h-3.5 w-3.5" /> Аналитика
          </TabsTrigger>
          <TabsTrigger value="health" className="gap-1.5 text-[13px]">
            <ShieldCheck className="h-3.5 w-3.5" /> Яндекс Вебмастер
          </TabsTrigger>
          <TabsTrigger value="gsc" className="gap-1.5 text-[13px]">
            <Search className="h-3.5 w-3.5" /> Анализ GSC
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-1.5 text-[13px]">
            <ClipboardCheck className="h-3.5 w-3.5" /> Технический аудит
          </TabsTrigger>
          <TabsTrigger value="mobile" className="gap-1.5 text-[13px]">
            <Smartphone className="h-3.5 w-3.5" /> Адаптивность
          </TabsTrigger>
          <TabsTrigger value="pagespeed" className="gap-1.5 text-[13px]">
            <Zap className="h-3.5 w-3.5" /> PageSpeed
          </TabsTrigger>
          <TabsTrigger value="chat" className="gap-1.5 text-[13px]">
            <MessagesSquare className="h-3.5 w-3.5" /> Чат
          </TabsTrigger>
        </TabsList>

        <TabsContent value="chat">
          <ProjectChatTab projectId={id!} projectName={project?.name || ""} />
        </TabsContent>

        <TabsContent value="analytics">
          <ProjectAnalyticsTab projectId={id!} />
        </TabsContent>

        <TabsContent value="health">
          <YandexWebmasterTab projectId={id!} />
        </TabsContent>

        <TabsContent value="gsc">
          <GscAnalysisTab projectId={id!} />
        </TabsContent>

        <TabsContent value="audit">
          <TechnicalAuditTab projectId={id!} />
        </TabsContent>

        <TabsContent value="mobile">
          <MobileFriendlyTab projectId={id!} />
        </TabsContent>

        <TabsContent value="pagespeed">
          <PageSpeedTab projectId={id!} />
        </TabsContent>

        <TabsContent value="checklist">
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
                    className={cn("flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors cursor-pointer", i % 2 === 1 && "bg-muted/10")}
                    onClick={() => setSelectedTask(task)}
                  >
                    <Checkbox
                      checked={done}
                      onCheckedChange={(v) => {
                        v !== undefined && toggleTask.mutate({ taskId: task.id, done: !!v });
                      }}
                      onClick={(e) => e.stopPropagation()}
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
                <p className={cn("text-[13px] font-medium", (project as any).deadline && isPast(parseISO((project as any).deadline)) ? "text-destructive" : "text-foreground")}>
                  {(project as any).deadline ? format(parseISO((project as any).deadline), "dd.MM.yyyy") : "Не установлен"}
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
                <p className="text-[11px] text-muted-foreground uppercase tracking-wide mb-1">Статус проекта</p>
                <Select value={project.privacy || "В работе"} onValueChange={v => updateStage.mutate(v)}>
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

            {/* Hidden file input */}
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept=".pdf,.docx,.xlsx,.png,.jpg,.jpeg"
              className="hidden"
              onChange={e => handleFileUpload(e.target.files)}
            />

            {/* Drop zone */}
            <div
              className="border-2 border-dashed border-border rounded-lg p-6 text-center hover:border-primary/30 transition-colors cursor-pointer"
              onClick={() => fileInputRef.current?.click()}
              onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
              onDrop={e => { e.preventDefault(); e.stopPropagation(); handleFileUpload(e.dataTransfer.files); }}
            >
              {uploading ? (
                <Loader2 className="h-8 w-8 mx-auto mb-2 text-primary animate-spin" />
              ) : (
                <Upload className="h-8 w-8 mx-auto mb-2 text-muted-foreground/40" />
              )}
              <p className="text-[13px] text-muted-foreground">Перетащите файлы или нажмите для загрузки</p>
              <p className="text-[11px] text-muted-foreground/60 mt-1">PDF, DOCX, XLSX, PNG</p>
            </div>

            {/* Uploaded files */}
            {projectFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {projectFiles.map(file => {
                  const sizeStr = file.size > 1048576 ? `${(file.size / 1048576).toFixed(1)} MB` : `${(file.size / 1024).toFixed(0)} KB`;
                  return (
                    <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-md bg-muted/30 hover:bg-muted/50 transition-colors">
                      <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                      <div className="flex-1 min-w-0">
                        <p className="text-[12px] font-medium text-foreground truncate">{file.name}</p>
                        <p className="text-[10px] text-muted-foreground">{sizeStr} · {format(parseISO(file.created_at), "dd.MM.yyyy")}</p>
                      </div>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" asChild>
                        <a href={file.url} target="_blank" rel="noopener noreferrer"><Download className="h-3.5 w-3.5" /></a>
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteFile.mutate(file.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}

            {projectFiles.length === 0 && (
              <p className="text-[12px] text-muted-foreground text-center mt-3">Нет загруженных файлов</p>
            )}
          </Card>
        </div>
      </div>
        </TabsContent>
      </Tabs>
      <EditProjectDialog open={editOpen} onOpenChange={setEditOpen} project={project} projectId={id!} />
      <TaskDetailSheet task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
