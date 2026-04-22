import { useState, useEffect, useRef } from "react";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import {
  Send, MessageSquare, User, CalendarDays, Hourglass, FolderOpen,
  Paperclip, Copy, Video, UserPlus, Search as SearchIcon, Edit3, Play,
  CheckCircle2, RotateCcw, Link, FileText, Upload, Loader2, Plus,
  Clock, AlertTriangle, Eye, ThumbsUp, ThumbsDown,
  ListChecks, Users, Timer, Layers, Target, AtSign, Sparkles,
} from "lucide-react";
import { motion } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { getDeadlineStatus, DEADLINE_STYLES, STAGE_COLORS, STAGE_PROGRESS } from "@/lib/task-helpers";
import type { Tables } from "@/integrations/supabase/types";
import { TaskTimeManual } from "@/components/project/TaskTimeManual";
import { CompleteTaskDialog } from "@/components/project/CompleteTaskDialog";
import { CreateSubtaskDialog, type SubtaskFormValues } from "@/components/project/CreateSubtaskDialog";
import { TaskBlockerSection, FrozenDeadlineBadge, useTaskBlocker } from "@/components/project/TaskBlocker";
import { TaskMembersBlock } from "@/components/project/TaskMembersBlock";

export type CrmTask = Tables<"crm_tasks"> & {
  creator?: Tables<"team_members"> | null;
  assignee?: Tables<"team_members"> | null;
  project?: Tables<"projects"> | null;
  comments?: Tables<"task_comments">[];
};

type TaskComment = Tables<"task_comments"> & {
  author?: Tables<"team_members"> | null;
};

export function getAvatarUrl(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://i.pravatar.cc/80?u=${hash}`;
}

export function TaskDetailSheet({ task, open, onClose }: { task: CrmTask | null; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [editDesc, setEditDesc] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editStage, setEditStage] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [isCreateSubtaskModalOpen, setIsCreateSubtaskModalOpen] = useState(false);
  const [creatingSubtask, setCreatingSubtask] = useState(false);
  const [resultText, setResultText] = useState("");
  const [resultUploading, setResultUploading] = useState(false);
  const resultFileRef = useRef<HTMLInputElement>(null);
  const [completeOpen, setCompleteOpen] = useState(false);
  const [completing, setCompleting] = useState(false);
  const blocker = useTaskBlocker();

  useEffect(() => {
    if (!task) return;
    setEditDesc(task.description || "");
    setEditDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "");
    setEditProjectId(task.project_id || "");
    setEditStage(task.stage);
    setEditAssigneeId(task.assignee_id || "");
    setEditingField(null);
    setIsCreateSubtaskModalOpen(false);
  }, [task?.id, open]);

  const { isAdmin, role } = useAuth();
  const isDirector = role === "director";
  // Постановщик: creator_id ссылается на team_members; связываем через owner_id team_member → auth user
  const isCreator = !!user && (
    task?.creator?.owner_id === user.id ||
    task?.owner_id === user.id
  );
  const canEditFields = isAdmin || isDirector || isCreator;

  const { data: comments = [] } = useQuery({
    queryKey: ["task-comments", task?.id],
    queryFn: async () => {
      if (!task) return [];
      const { data, error } = await supabase
        .from("task_comments")
        .select("*, author:team_members(*)")
        .eq("task_id", task.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data as TaskComment[];
    },
    enabled: !!task,
  });

  const { data: subtasks = [] } = useQuery({
    queryKey: ["subtasks", task?.id],
    queryFn: async () => {
      if (!task) return [];
      const { data } = await supabase
        .from("subtasks")
        .select("*")
        .eq("task_id", task.id)
        .order("sort_order");
      return (data || []) as any[];
    },
    enabled: !!task,
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list-detail"],
    queryFn: async () => {
      const { data } = await supabase.from("projects").select("id, name, privacy, account_manager_id").order("name");
      return data || [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members-detail"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name, owner_id").order("full_name");
      return data || [];
    },
  });

  useEffect(() => {
    if (!task) return;
    const channelName = `task-${task.id}-${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "task_comments", filter: `task_id=eq.${task.id}` }, () => {
        queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [task?.id, queryClient]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [comments.length]);

  const addSystemLog = async (body: string) => {
    if (!task) return;
    await supabase.from("task_comments").insert({ task_id: task.id, body, is_system: true });
    queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
  };

  const sendComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("task_comments").insert({
        task_id: task!.id, body: msg, is_system: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setMsg("");
      queryClient.invalidateQueries({ queryKey: ["task-comments", task?.id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateField = useMutation({
    mutationFn: async ({ field, value, logMsg }: { field: string; value: any; logMsg: string }) => {
      const { error } = await supabase.from("crm_tasks").update({ [field]: value } as any).eq("id", task!.id);
      if (error) throw error;
      await addSystemLog(logMsg);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      setEditingField(null);
    },
  });

  const saveDescription = () => {
    // локально — закрываем поле, изменения уйдут по общей кнопке «Сохранить»
    setEditingField(null);
  };

  const saveDeadline = () => {
    // локально — будет сохранено по кнопке «Сохранить»
  };

  const saveProject = (projectId: string) => {
    setEditProjectId(projectId);
  };

  const saveAssignee = (assigneeId: string) => {
    setEditAssigneeId(assigneeId);
  };

  // Единая кнопка «Сохранить» — применяет все изменения батчем
  const changedFields: string[] = task ? [
    editDesc !== (task.description || "") ? "Описание" : null,
    editDeadline !== (task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "") ? "Крайний срок" : null,
    editProjectId !== (task.project_id || "") ? "Проект" : null,
    editAssigneeId !== (task.assignee_id || "") ? "Исполнитель" : null,
  ].filter(Boolean) as string[] : [];
  const isDirty = changedFields.length > 0;
  const needsConfirm = changedFields.length >= 3;
  const [confirmSaveOpen, setConfirmSaveOpen] = useState(false);

  const saveAll = useMutation({
    mutationFn: async () => {
      if (!task || !canEditFields) return;
      const updates: Record<string, any> = {};
      const logs: string[] = [];

      if (editDesc !== (task.description || "")) {
        updates.description = editDesc;
        logs.push("Описание задачи обновлено");
      }
      const currentDeadline = task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "";
      if (editDeadline !== currentDeadline) {
        updates.deadline = editDeadline || null;
        const formatted = editDeadline
          ? new Date(editDeadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })
          : "снят";
        logs.push(`Крайний срок изменён на ${formatted}`);
      }
      if (editProjectId !== (task.project_id || "")) {
        updates.project_id = editProjectId || null;
        const pName = projects.find(p => p.id === editProjectId)?.name || "—";
        logs.push(`Проект изменён на «${pName}»`);
      }
      if (editAssigneeId !== (task.assignee_id || "")) {
        updates.assignee_id = editAssigneeId || null;
        const mName = members.find(m => m.id === editAssigneeId)?.full_name || "снят";
        logs.push(`Исполнитель изменён на ${mName}`);
      }
      if (Object.keys(updates).length === 0) return;

      const { error } = await supabase.from("crm_tasks").update(updates as any).eq("id", task.id);
      if (error) throw error;
      for (const l of logs) await addSystemLog(l);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      setEditingField(null);
      toast.success("Изменения сохранены");
    },
    onError: (e: Error) => toast.error(e.message || "Не удалось сохранить"),
  });

  const startTask = () => {
    updateField.mutate({ field: "stage", value: "В работе", logMsg: `Статус изменён на «В работе»` });
    supabase.from("crm_tasks").update({ stage_color: "#f59e0b", stage: "В работе" } as any).eq("id", task!.id);
    setEditStage("В работе");
  };

  const sendForReview = async () => {
    if (!task) return;
    const hasAttachment = comments.some(c => !c.is_system);
    if (!hasAttachment) {
      toast.warning("Прикрепите файл или ссылку как результат работы перед отправкой на проверку.", { duration: 4000 });
      return;
    }
    const projectId = editProjectId || task.project_id;
    let managerName = "";
    if (projectId) {
      const { data: fullProj } = await supabase.from("projects").select("account_manager_id, name").eq("id", projectId).single();
      if (fullProj?.account_manager_id) {
        const { data: tm } = await supabase.from("team_members").select("full_name").eq("id", fullProj.account_manager_id).single();
        if (tm) managerName = tm.full_name;
      }
    }
    await supabase.from("crm_tasks").update({
      stage: "На проверке",
      stage_color: STAGE_COLORS["На проверке"],
      stage_progress: STAGE_PROGRESS["На проверке"],
    } as any).eq("id", task.id);
    await addSystemLog(managerName ? `Отправлено на проверку → ${managerName}` : `Отправлено на проверку`);
    queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
    setEditStage("На проверке");
    toast.success(managerName ? `Задача передана на проверку → ${managerName}` : "Задача передана на проверку");
  };

  const acceptTask = async () => {
    if (!task) return;
    const openSubs = subtasks.filter((s: any) => !s.is_done).length;
    if (openSubs > 0) {
      toast.error(`Нельзя принять: есть ${openSubs} открытых подзадач`);
      return;
    }
    const { error } = await supabase.from("crm_tasks").update({
      stage: "Принята",
      stage_color: STAGE_COLORS["Принята"],
      stage_progress: 100,
    } as any).eq("id", task.id);
    if (error) { toast.error(error.message); return; }
    await addSystemLog(`Аккаунт принял задачу ✓`);
    queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
    setEditStage("Принята");
    toast.success("Задача принята");
  };

  const returnTask = async () => {
    if (!task) return;
    const reason = window.prompt("Причина возврата (комментарий для исполнителя):");
    if (!reason || !reason.trim()) return;
    await supabase.from("crm_tasks").update({
      stage: "Возвращена",
      stage_color: STAGE_COLORS["Возвращена"],
      stage_progress: STAGE_PROGRESS["Возвращена"],
    } as any).eq("id", task.id);
    await supabase.from("task_comments").insert({
      task_id: task.id,
      body: `↩️ Возврат на доработку: ${reason}`,
      is_system: false,
    });
    await addSystemLog(`Возвращена на доработку`);
    queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
    queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
    setEditStage("Возвращена");
    toast.success("Задача возвращена исполнителю");
  };

  const resumeTask = () => {
    updateField.mutate({ field: "stage", value: "В работе", logMsg: `Задача возобновлена` });
    supabase.from("crm_tasks").update({ stage_color: STAGE_COLORS["В работе"], stage: "В работе", stage_progress: 50 } as any).eq("id", task!.id);
    setEditStage("В работе");
    toast.success("Задача возобновлена");
  };

  const saveResult = async () => {
    if (!resultText.trim() || !task) return;
    await supabase.from("task_comments").insert({ task_id: task.id, body: `📎 Результат: ${resultText}`, is_system: false });
    await addSystemLog(`Добавлен результат работы`);
    queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
    setResultText("");
    toast.success("Результат сохранён");
  };

  const handleResultUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !task) return;
    setResultUploading(true);
    try {
      const file = files[0];
      const path = `task-results/${task.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("project-files").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path);
      await supabase.from("task_comments").insert({ task_id: task.id, body: `📎 Файл: [${file.name}](${publicUrl})`, is_system: false });
      await addSystemLog(`Прикреплён файл «${file.name}»`);
      queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
      toast.success("Файл загружен");
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки");
    } finally {
      setResultUploading(false);
    }
  };

  const handleCreateSubtask = async (values: SubtaskFormValues) => {
    if (!task) return;
    setCreatingSubtask(true);
    try {
      const payload: any = {
        task_id: task.id,
        title: values.title,
        sort_order: subtasks.length,
        description: values.description || null,
        assignee_id: values.assignee_id,
        deadline: values.deadline ? new Date(values.deadline).toISOString() : null,
        plan_minutes: values.plan_hours != null ? Math.round(values.plan_hours * 60) : null,
      };
      const { error } = await supabase.from("subtasks").insert(payload);
      if (error) throw error;
      await addSystemLog(`Добавлена подзадача «${values.title}»`);
      queryClient.invalidateQueries({ queryKey: ["subtasks", task.id] });
      setIsCreateSubtaskModalOpen(false);
      toast.success("Подзадача успешно создана");
    } catch (e: any) {
      toast.error(e.message || "Не удалось создать подзадачу");
    } finally {
      setCreatingSubtask(false);
    }
  };

  const toggleSubtask = useMutation({
    mutationFn: async ({ id: stId, done }: { id: string; done: boolean }) => {
      await supabase.from("subtasks").update({ is_done: done } as any).eq("id", stId);
      const st = subtasks.find(s => s.id === stId);
      await addSystemLog(`Подзадача «${st?.title}» ${done ? "выполнена ✓" : "возвращена в работу"}`);
      // Обратная синхронизация: пункт периода, привязанный к этой подзадаче
      await supabase
        .from("period_tasks")
        .update({ completed: done, completed_at: done ? new Date().toISOString() : null } as any)
        .eq("crm_task_id", stId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["subtasks", task?.id] });
      queryClient.invalidateQueries({ queryKey: ["period-tasks"] });
    },
  });

  const handleComplete = async ({ result, minutes }: { result: string; minutes: number }) => {
    if (!task || !user) return;
    // Клиентская защита: запрещаем закрывать при открытых подзадачах
    const openSubs = subtasks.filter((s: any) => !s.is_done).length;
    if (openSubs > 0) {
      toast.error(`Нельзя закрыть: есть ${openSubs} открытых подзадач`);
      return;
    }
    setCompleting(true);
    try {
      // 1. Log time
      const endedAt = new Date();
      const startedAt = new Date(endedAt.getTime() - minutes * 60 * 1000);
      await supabase.from("task_time_entries").insert({
        task_id: task.id,
        user_id: user.id,
        project_id: editProjectId || task.project_id || null,
        started_at: startedAt.toISOString(),
        ended_at: endedAt.toISOString(),
        comment: "Финальное списание при закрытии задачи",
      });

      // 2. Save result as comment
      await supabase.from("task_comments").insert({
        task_id: task.id,
        body: `✅ Результат: ${result}`,
        is_system: false,
      });

      // 3. Update status -> Выполнено (green)
      const greenColor = "#10b981";
      const { error: updErr } = await supabase.from("crm_tasks").update({
        stage: "Выполнено",
        stage_color: greenColor,
        stage_progress: 100,
      } as any).eq("id", task.id);
      if (updErr) throw updErr;

      await addSystemLog(`Задача завершена. Списано ${Math.floor(minutes / 60)}ч ${minutes % 60}м`);

      setEditStage("Выполнено");
      queryClient.invalidateQueries({ queryKey: ["crm-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["project-tasks"] });
      queryClient.invalidateQueries({ queryKey: ["time-entries", task.id] });
      queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });

      setCompleteOpen(false);
      toast.success("Задача успешно закрыта!");
    } catch (e: any) {
      toast.error(e.message || "Не удалось закрыть задачу");
    } finally {
      setCompleting(false);
    }
  };

  if (!task) return null;

  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const deadlineStatus = getDeadlineStatus(task.deadline, editStage || task.stage);
  const isOverdue = deadlineStatus === "overdue";
  const diffDays = deadlineDate ? Math.abs(Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)) : 0;
  const overduePeriod = diffDays >= 30 ? `${Math.floor(diffDays / 30)} мес.` : `${diffDays} дн.`;
  const taskIdShort = task.id.slice(0, 4).toUpperCase();
  const completedSubs = subtasks.filter((s: any) => s.is_done).length;
  const subtasksProgress = subtasks.length > 0 ? Math.round((completedSubs / subtasks.length) * 100) : 0;

  const copyId = () => {
    navigator.clipboard.writeText(task.id);
    toast.success("ID скопирован");
  };

  const currentProject = projects.find(p => p.id === (editProjectId || task.project_id));

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[92vw] md:max-w-[92vw] p-0 overflow-hidden border-l-0 shadow-2xl flex flex-col h-screen max-h-screen bg-background" side="right">
        {/* HEADER: title + status + quick actions grid */}
        <div className="px-7 py-5 border-b border-border/60 bg-card space-y-4 shrink-0">
          <div className="flex items-start gap-4">
            <div className="flex-1 min-w-0 space-y-2">
              <SheetTitle className="text-2xl font-bold text-foreground leading-tight tracking-tight">
                {task.title}
              </SheetTitle>
              <div className="flex items-center gap-2 flex-wrap text-xs text-muted-foreground">
                <Badge
                  className="text-[11px] h-5 border-0"
                  style={{ backgroundColor: `${task.stage_color || "hsl(var(--primary))"}20`, color: task.stage_color || "hsl(var(--primary))" }}
                >
                  {editStage || task.stage}
                </Badge>
                <span className="text-muted-foreground/60">•</span>
                <span className="font-mono">#{taskIdShort}</span>
                {currentProject && (
                  <>
                    <span className="text-muted-foreground/60">•</span>
                    <span className="flex items-center gap-1.5">
                      <FolderOpen className="h-3 w-3" />
                      {currentProject.name}
                    </span>
                  </>
                )}
              </div>
            </div>
          </div>

          <TaskBlockerSection
            isBlocked={blocker.isBlocked}
            blockReason={blocker.blockReason}
            problemType={blocker.problemType}
            onBlock={blocker.block}
            onUnblock={blocker.unblock}
          />

          {/* Quick actions grid (Bitrix-style) */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-1.5">
            {[
              { icon: ListChecks, label: "Подзадачи", anchor: "subtasks", count: subtasks.length || undefined },
              { icon: Users, label: "Участники", anchor: "members" },
              { icon: FileText, label: "Результат", anchor: "result" },
              { icon: Paperclip, label: "Файлы", anchor: "result" },
              { icon: Timer, label: "Учёт времени", anchor: "time" },
              { icon: Layers, label: task.parent_id ? "Родительская" : "Подзадачи", anchor: "subtasks" },
              { icon: Target, label: "Проект", anchor: "props" },
              { icon: MessageSquare, label: "Чат", anchor: "chat", count: comments.filter(c => !c.is_system).length || undefined },
            ].map((b) => (
              <button
                key={b.label}
                onClick={() => {
                  document.getElementById(`task-section-${b.anchor}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border/50 bg-background/40 hover:bg-muted/50 hover:border-border transition-all text-xs font-medium text-foreground/80 hover:text-foreground group"
              >
                <b.icon className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
                <span className="truncate flex-1 text-left">{b.label}</span>
                {b.count !== undefined && (
                  <span className="text-[10px] tabular-nums text-muted-foreground bg-muted/60 px-1.5 rounded-full">
                    {b.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col md:flex-row flex-1 min-h-0">
          {/* LEFT COLUMN */}
          <div className="w-full md:w-[78%] flex flex-col border-r border-border/50 bg-[hsl(var(--muted)/0.2)] min-h-0">
            <div className="flex-1 overflow-y-auto p-7 space-y-4">

              {/* Description */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                <CardContent className="p-4">
                  {editingField === "description" && canEditFields ? (
                    <div className="space-y-2">
                      <Textarea value={editDesc} onChange={e => setEditDesc(e.target.value)} className="text-sm min-h-[80px]" placeholder="Описание задачи..." autoFocus />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={saveDescription}>Сохранить</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingField(null)}>Отмена</Button>
                      </div>
                    </div>
                  ) : (
                    <div className={cn("flex items-start gap-2 cursor-pointer hover:text-foreground transition-colors", canEditFields ? "" : "cursor-default")} onClick={() => canEditFields && setEditingField("description")}>
                      <Edit3 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      {editDesc ? <p className="text-sm text-foreground whitespace-pre-wrap">{editDesc}</p> : <span className="text-sm text-muted-foreground/60 italic">Описание</span>}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Main properties */}
              <Card id="task-section-props" className="bg-card shadow-sm border-border/60 rounded-xl scroll-mt-4">
                <CardContent className="p-0 divide-y divide-border/40">
                  {/* Assignee */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <User className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Исполнитель</span>
                    {canEditFields ? (
                      <Select value={editAssigneeId || task.assignee_id || ""} onValueChange={saveAssignee}>
                        <SelectTrigger className="h-8 text-sm border-0 bg-transparent shadow-none p-0 w-auto gap-2">
                          <SelectValue placeholder="Назначить...">
                            {(() => {
                              const aid = editAssigneeId || task.assignee_id;
                              const a = task.assignee || members.find(m => m.id === aid);
                              if (!a) return "Назначить...";
                              const name = 'full_name' in a ? a.full_name : '';
                              return (
                                <div className="flex items-center gap-2">
                                  <img src={getAvatarUrl(name)} alt="" className="h-6 w-6 rounded-full object-cover" />
                                  <span className="font-medium">{name}</span>
                                </div>
                              );
                            })()}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : task.assignee ? (
                      <div className="flex items-center gap-2">
                        <img src={getAvatarUrl(task.assignee.full_name)} alt="" className="h-7 w-7 rounded-full object-cover ring-2 ring-background shadow-sm" />
                        <span className="text-sm font-medium text-foreground">{task.assignee.full_name}</span>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Не назначен</span>}
                  </div>

                  {/* Deadline */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <CalendarDays className={cn("h-4 w-4 shrink-0", DEADLINE_STYLES[deadlineStatus].text)} />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Крайний срок</span>
                    {canEditFields ? (
                      <div className="flex items-center gap-2">
                        <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="h-8 text-sm border-0 bg-transparent shadow-none p-0 w-auto" />
                      </div>
                    ) : deadlineDate ? (
                      <span className={cn("text-sm font-medium", DEADLINE_STYLES[deadlineStatus].text)}>
                        {deadlineDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                      </span>
                    ) : <span className="text-sm text-muted-foreground">Не задан</span>}
                    {blocker.isBlocked ? (
                      <FrozenDeadlineBadge />
                    ) : deadlineStatus === "overdue" ? (
                      <Badge variant="destructive" className="text-[10px] h-5 gap-1">
                        <AlertTriangle className="h-3 w-3" /> Просрочено {overduePeriod}
                      </Badge>
                    ) : deadlineStatus === "soon" ? (
                      <Badge className={cn("text-[10px] h-5 gap-1 border-0", DEADLINE_STYLES.soon.bg, DEADLINE_STYLES.soon.text)}>
                        <Clock className="h-3 w-3" /> Скоро
                      </Badge>
                    ) : null}
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <Hourglass className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Статус</span>
                    <Badge className="text-xs" style={{ backgroundColor: `${task.stage_color || '#3b82f6'}20`, color: task.stage_color || '#3b82f6' }}>
                      {editStage || task.stage}
                    </Badge>
                  </div>

                  {/* Project */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <FolderOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Проект</span>
                    {canEditFields ? (
                      <Select value={editProjectId || task.project_id || ""} onValueChange={saveProject}>
                        <SelectTrigger className="h-8 text-sm border-0 bg-transparent shadow-none p-0 w-auto gap-2">
                          <SelectValue placeholder="Привязать...">{currentProject?.name || "Привязать..."}</SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : <span className="text-sm text-foreground">{currentProject?.name || "—"}</span>}
                  </div>

                  {/* ID */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <Copy className="h-4 w-4 text-muted-foreground shrink-0 cursor-pointer hover:text-foreground" onClick={copyId} />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">ID</span>
                    <span className="text-sm font-mono text-muted-foreground cursor-pointer hover:text-foreground" onClick={copyId}>#{taskIdShort}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Members */}
              <div id="task-section-members" className="scroll-mt-4">
                <TaskMembersBlock
                  taskId={task.id}
                  taskOwnerId={task.owner_id}
                  creatorTeamMemberId={task.creator_id}
                  canManage={canEditFields}
                />
              </div>

              {/* Subtasks */}
              <Card id="task-section-subtasks" className="bg-card shadow-sm border-border/60 rounded-xl scroll-mt-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Подзадачи</span>
                      <span className="text-xs text-muted-foreground">{completedSubs}/{subtasks.length}</span>
                    </div>
                    <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setIsCreateSubtaskModalOpen(true)}>
                      <Plus className="h-3 w-3" /> Добавить
                    </Button>
                  </div>
                  {subtasks.length > 0 && (
                    <div className="space-y-1.5">
                      <Progress value={subtasksProgress} className="h-1.5" />
                      <div className="flex justify-between text-[10px] text-muted-foreground">
                        <span>{subtasksProgress}% выполнено</span>
                        <span>{completedSubs}/{subtasks.length} шагов</span>
                      </div>
                    </div>
                  )}
                  <div className="space-y-1">
                    {subtasks.map((s: any) => {
                      const assignee = members.find((m) => m.id === s.assignee_id);
                      const dl = s.deadline ? new Date(s.deadline) : null;
                      return (
                        <div
                          key={s.id}
                          className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
                        >
                          <Checkbox
                            checked={s.is_done}
                            onCheckedChange={(v) => toggleSubtask.mutate({ id: s.id, done: !!v })}
                            className="h-4 w-4"
                          />
                          <span className={cn("text-sm flex-1 truncate", s.is_done && "line-through text-muted-foreground")}>
                            {s.title}
                          </span>
                          {assignee && (
                            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <img
                                src={getAvatarUrl(assignee.full_name)}
                                alt={assignee.full_name}
                                className="h-5 w-5 rounded-full ring-1 ring-border/60"
                              />
                              <span className="hidden sm:inline max-w-[80px] truncate">{assignee.full_name}</span>
                            </div>
                          )}
                          {dl && (
                            <span className="text-[11px] text-muted-foreground tabular-nums whitespace-nowrap flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" />
                              {dl.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" })}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Result field */}
              <Card id="task-section-result" className="bg-card shadow-sm border-border/60 rounded-xl scroll-mt-4">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Результат работы</span>
                  </div>
                  <div className="space-y-2">
                    <Textarea value={resultText} onChange={e => setResultText(e.target.value)} placeholder="Введите текст, ссылку на результат..." className="text-sm min-h-[60px] resize-none" />
                    <div className="flex items-center gap-2">
                      <Button size="sm" className="h-7 text-xs gap-1" onClick={saveResult} disabled={!resultText.trim()}>
                        <Link className="h-3 w-3" /> Сохранить
                      </Button>
                      <input ref={resultFileRef} type="file" className="hidden" accept="image/*,.pdf,.docx,.xlsx" onChange={e => handleResultUpload(e.target.files)} />
                      <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => resultFileRef.current?.click()} disabled={resultUploading}>
                        {resultUploading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Upload className="h-3 w-3" />} Файл
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Time tracking — manual only */}
              <div id="task-section-time" className="scroll-mt-4">
                <TaskTimeManual taskId={task.id} projectId={editProjectId || task.project_id || null} />
              </div>

            </div>

            {/* Sticky bottom action bar — primary CTA */}
            <div className="border-t border-border/60 bg-card px-5 py-3 shrink-0 space-y-2">
              {canEditFields && isDirty && (
                <Button
                  size="lg"
                  className="w-full h-11 gap-2 text-sm font-semibold shadow-md"
                  onClick={() => needsConfirm ? setConfirmSaveOpen(true) : saveAll.mutate()}
                  disabled={saveAll.isPending}
                  variant="default"
                >
                  {saveAll.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  Сохранить изменения{changedFields.length > 0 ? ` (${changedFields.length})` : ""}
                </Button>
              )}
              {!canEditFields && (
                <p className="text-[11px] text-muted-foreground text-center py-1">
                  Редактировать задачу может только постановщик, администратор или директор
                </p>
              )}
              <Button
                size="lg"
                className="w-full h-11 gap-2 text-sm font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md"
                onClick={() => setCompleteOpen(true)}
                disabled={editStage === "Принята" || editStage === "Завершена"}
              >
                <CheckCircle2 className="h-4 w-4" /> Завершить задачу
              </Button>
              <div className="flex items-center gap-2 flex-wrap">
                {(editStage === "Новые" || editStage === "Возвращена") && (
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={startTask}>
                    <Play className="h-3.5 w-3.5" /> Начать
                  </Button>
                )}
                {editStage === "На проверке" && (
                  <>
                    <Button size="sm" variant="outline" className="gap-1.5 border-emerald-600/30 text-emerald-600 hover:bg-emerald-600/5" onClick={acceptTask}>
                      <ThumbsUp className="h-3.5 w-3.5" /> Принять
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1.5 border-destructive/30 text-destructive hover:bg-destructive/5" onClick={returnTask}>
                      <ThumbsDown className="h-3.5 w-3.5" /> Вернуть
                    </Button>
                  </>
                )}
                {(editStage === "Принята" || editStage === "Завершена") && (
                  <Button variant="outline" size="sm" className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5" onClick={resumeTask}>
                    <RotateCcw className="h-3.5 w-3.5" /> Возобновить
                  </Button>
                )}
                <Badge className="ml-auto text-[10px]" style={{ backgroundColor: `${task.stage_color || '#3b82f6'}20`, color: task.stage_color || '#3b82f6' }}>
                  {editStage || task.stage}
                </Badge>
              </div>
            </div>
          </div>
          {/* RIGHT COLUMN: Chat */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="px-5 py-3 border-b border-border/60 bg-card flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Чат задачи</h3>
                <span className="text-xs text-muted-foreground">
                  {[task.creator, task.assignee].filter(Boolean).length + 1} участника
                </span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><Video className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><UserPlus className="h-4 w-4" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground"><SearchIcon className="h-4 w-4" /></Button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4" style={{ backgroundColor: "hsl(var(--muted) / 0.15)" }}>
              {comments.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/15" />
                  <p className="text-sm text-muted-foreground">Нет сообщений. Начните обсуждение...</p>
                </div>
              )}
              {comments.map((m, i) => {
                const prevDate = i > 0 ? comments[i - 1].created_at.split("T")[0] : "";
                const curDate = m.created_at.split("T")[0];
                const showDateSep = curDate !== prevDate;
                return (
                  <div key={m.id}>
                    {showDateSep && (
                      <div className="flex justify-center my-5">
                        <span className="text-[11px] text-muted-foreground bg-muted/60 px-4 py-1.5 rounded-full font-medium shadow-sm border border-border/30">
                          {new Date(curDate).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                        </span>
                      </div>
                    )}
                    {m.is_system ? (
                      <div className="flex justify-center">
                        <div className="bg-muted/60 text-muted-foreground text-xs px-4 py-2 rounded-xl max-w-md text-center leading-relaxed border border-border/30 italic">
                          ⚡ {m.body}
                        </div>
                      </div>
                    ) : (
                      <motion.div className="flex gap-3 group" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.02, duration: 0.2 }}>
                        <img src={m.author ? getAvatarUrl(m.author.full_name) : "https://i.pravatar.cc/80?u=anon"} alt="" className="h-9 w-9 rounded-full object-cover ring-2 ring-background shadow-sm mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-primary">{m.author?.full_name || "Аноним"}</span>
                            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">
                              {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div className="bg-card rounded-2xl rounded-tl-md p-3.5 border border-border/40 shadow-sm max-w-[85%]">
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{m.body}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground/50 ml-1 mt-1 block">
                            {new Date(m.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                          </span>
                        </div>
                      </motion.div>
                    )}
                  </div>
                );
              })}
              <div ref={chatEndRef} />
            </div>

            <div className="px-4 py-3 border-t border-border/40 bg-card/80 backdrop-blur-sm shrink-0">
              <div className="flex items-center gap-2 bg-muted/30 border border-border/50 rounded-xl px-3 py-1.5 focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/40 transition-all">
                <button className="text-muted-foreground hover:text-foreground transition-colors shrink-0">
                  <Paperclip className="h-4 w-4" />
                </button>
                <Input placeholder="Нажмите @ или +, чтобы упомянуть человека, чат или AI" value={msg} onChange={e => setMsg(e.target.value)} className="flex-1 h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50" onKeyDown={e => e.key === "Enter" && msg.trim() && sendComment.mutate()} />
                <Button size="icon" className="h-8 w-8 rounded-lg shrink-0 shadow-sm" disabled={!msg.trim() || sendComment.isPending} onClick={() => sendComment.mutate()}>
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>

      <AlertDialog open={confirmSaveOpen} onOpenChange={setConfirmSaveOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Подтвердите сохранение изменений</AlertDialogTitle>
            <AlertDialogDescription>
              Вы изменяете сразу <strong>{changedFields.length}</strong> {changedFields.length === 1 ? "поле" : changedFields.length < 5 ? "поля" : "полей"} в задаче. Все правки будут применены и записаны в журнал задачи.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-sm space-y-1.5 my-2 px-4 py-3 rounded-lg bg-muted/40 border border-border/60">
            {changedFields.map((f) => (
              <li key={f} className="flex items-center gap-2 text-foreground">
                <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saveAll.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                saveAll.mutate(undefined, {
                  onSettled: () => setConfirmSaveOpen(false),
                });
              }}
              disabled={saveAll.isPending}
            >
              {saveAll.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Применить все изменения
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CompleteTaskDialog
        open={completeOpen}
        onOpenChange={setCompleteOpen}
        onConfirm={handleComplete}
        saving={completing}
      />

      <CreateSubtaskDialog
        open={isCreateSubtaskModalOpen}
        onOpenChange={setIsCreateSubtaskModalOpen}
        parentTaskTitle={task.title}
        parentTaskShortId={taskIdShort}
        members={members as any}
        defaultAssigneeId={editAssigneeId || task.assignee_id || null}
        submitting={creatingSubtask}
        onSubmit={handleCreateSubtask}
      />
    </Sheet>
  );
}
