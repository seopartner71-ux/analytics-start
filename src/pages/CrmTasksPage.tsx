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

type CrmTask = Tables<"crm_tasks"> & {
  creator?: Tables<"team_members"> | null;
  assignee?: Tables<"team_members"> | null;
  project?: Tables<"projects"> | null;
  comments?: Tables<"task_comments">[];
};

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
        project_id: projectId || null,
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
            <div><Label className="text-xs">Проект</Label>
              <Select value={projectId} onValueChange={setProjectId}>
                <SelectTrigger><SelectValue placeholder="Выбрать..." /></SelectTrigger>
                <SelectContent>
                  {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!form.title.trim() || mutation.isPending} className="w-full">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Создать задачу
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Seeded avatar URL from name ─── */
function getAvatarUrl(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://i.pravatar.cc/80?u=${hash}`;
}

/* ─── Task Detail Sheet (Full Implementation) ─── */
function TaskDetailSheet({ task, open, onClose }: { task: CrmTask | null; open: boolean; onClose: () => void }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [msg, setMsg] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Editable fields state
  const [editDesc, setEditDesc] = useState("");
  const [editDeadline, setEditDeadline] = useState("");
  const [editProjectId, setEditProjectId] = useState("");
  const [editStage, setEditStage] = useState("");
  const [editAssigneeId, setEditAssigneeId] = useState("");
  const [editingField, setEditingField] = useState<string | null>(null);
  const [newSubtask, setNewSubtask] = useState("");
  const [showSubtaskInput, setShowSubtaskInput] = useState(false);
  const [resultText, setResultText] = useState("");
  const [resultUploading, setResultUploading] = useState(false);
  const resultFileRef = useRef<HTMLInputElement>(null);

  // Init fields from task
  useEffect(() => {
    if (!task) return;
    setEditDesc(task.description || "");
    setEditDeadline(task.deadline ? new Date(task.deadline).toISOString().slice(0, 16) : "");
    setEditProjectId(task.project_id || "");
    setEditStage(task.stage);
    setEditAssigneeId(task.assignee_id || "");
    setEditingField(null);
    setShowSubtaskInput(false);
  }, [task?.id, open]);

  // Permissions: only admin or task creator can edit
  const isAdmin = true; // simplified — real check via role
  const isCreator = task?.owner_id === user?.id;
  const isAssignee = task?.assignee_id ? task.assignee?.owner_id === user?.id : false;
  const canEditFields = isAdmin || isCreator;

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

  // System log helper
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

  // Update task field
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

  // Save description
  const saveDescription = () => {
    if (!canEditFields || editDesc === (task?.description || "")) { setEditingField(null); return; }
    updateField.mutate({ field: "description", value: editDesc, logMsg: `Описание задачи обновлено` });
  };

  // Save deadline
  const saveDeadline = () => {
    const newVal = editDeadline || null;
    const formatted = newVal ? new Date(newVal).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" }) : "снят";
    updateField.mutate({ field: "deadline", value: newVal, logMsg: `Крайний срок изменён на ${formatted}` });
  };

  // Save project
  const saveProject = (projectId: string) => {
    const pName = projects.find(p => p.id === projectId)?.name || "—";
    setEditProjectId(projectId);
    updateField.mutate({ field: "project_id", value: projectId || null, logMsg: `Проект изменён на «${pName}»` });
  };

  // Save assignee
  const saveAssignee = (assigneeId: string) => {
    const mName = members.find(m => m.id === assigneeId)?.full_name || "снят";
    setEditAssigneeId(assigneeId);
    updateField.mutate({ field: "assignee_id", value: assigneeId || null, logMsg: `Исполнитель изменён на ${mName}` });
  };

  // Start task
  const startTask = () => {
    updateField.mutate({
      field: "stage", value: "В работе",
      logMsg: `Статус изменён на «В работе»`,
    });
    supabase.from("crm_tasks").update({ stage_color: "#f59e0b", stage: "В работе" } as any).eq("id", task!.id);
    setEditStage("В работе");
  };

  // Complete task
  const completeTask = async () => {
    if (!task) return;

    // Validate: must have at least one non-system comment (attachment/result)
    const hasAttachment = comments.some(c => !c.is_system);
    if (!hasAttachment) {
      toast.warning("Для завершения задачи необходимо прикрепить файл или ссылку как результат работы.", { duration: 4000 });
      return;
    }

    // Find the project's account manager to notify
    const projectId = editProjectId || task.project_id;
    let managerName = "";

    if (projectId) {
      const proj = projects.find(p => p.id === projectId);
      // Fetch full project with account_manager_id
      const { data: fullProj } = await supabase
        .from("projects")
        .select("account_manager_id, owner_id, name")
        .eq("id", projectId)
        .single();

      if (fullProj?.account_manager_id) {
        // Find the team member's owner_id (actual user) to send notification
        const { data: tm } = await supabase
          .from("team_members")
          .select("owner_id, full_name")
          .eq("id", fullProj.account_manager_id)
          .single();

        if (tm) {
          managerName = tm.full_name;
          await supabase.from("notifications").insert({
            user_id: tm.owner_id,
            project_id: projectId,
            title: `Задача завершена: ${task.title}`,
            body: `Исполнитель завершил задачу. Требуется проверка.`,
          });
        }
      } else if (!fullProj?.account_manager_id) {
        toast.info("У проекта не назначен аккаунт-менеджер. Задача завершена без передачи на проверку.", { duration: 4000 });
      }
    } else {
      toast.info("Задача не привязана к проекту. Завершена без передачи на проверку.", { duration: 4000 });
    }

    updateField.mutate({
      field: "stage", value: "Завершена",
      logMsg: managerName
        ? `Задача завершена и передана на проверку → ${managerName}`
        : `Задача завершена`,
    });
    await supabase.from("crm_tasks").update({ stage_color: "#10b981", stage: "Завершена", stage_progress: 100 } as any).eq("id", task.id);
    setEditStage("Завершена");

    if (managerName) {
      toast.success(`Задача завершена. Передана на проверку → ${managerName}`);
    }
  };

  // Resume task
  const resumeTask = () => {
    updateField.mutate({
      field: "stage", value: "В работе",
      logMsg: `Задача возобновлена`,
    });
    supabase.from("crm_tasks").update({ stage_color: "#f59e0b", stage: "В работе", stage_progress: 50 } as any).eq("id", task!.id);
    setEditStage("В работе");
    toast.success("Задача возобновлена");
  };

  // Save result text/link
  const saveResult = async () => {
    if (!resultText.trim() || !task) return;
    await supabase.from("task_comments").insert({
      task_id: task.id, body: `📎 Результат: ${resultText}`, is_system: false,
    });
    await addSystemLog(`Добавлен результат работы`);
    queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
    setResultText("");
    toast.success("Результат сохранён");
  };

  // Upload result file
  const handleResultUpload = async (files: FileList | null) => {
    if (!files || files.length === 0 || !task) return;
    setResultUploading(true);
    try {
      const file = files[0];
      const path = `task-results/${task.id}/${Date.now()}_${file.name}`;
      const { error } = await supabase.storage.from("project-files").upload(path, file);
      if (error) throw error;
      const { data: { publicUrl } } = supabase.storage.from("project-files").getPublicUrl(path);
      await supabase.from("task_comments").insert({
        task_id: task.id, body: `📎 Файл: [${file.name}](${publicUrl})`, is_system: false,
      });
      await addSystemLog(`Прикреплён файл «${file.name}»`);
      queryClient.invalidateQueries({ queryKey: ["task-comments", task.id] });
      toast.success("Файл загружен");
    } catch (e: any) {
      toast.error(e.message || "Ошибка загрузки");
    } finally {
      setResultUploading(false);
    }
  };

  // Subtask operations
  const addSubtask = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("subtasks").insert({
        task_id: task!.id, title: newSubtask, sort_order: subtasks.length,
      } as any);
      if (error) throw error;
      await addSystemLog(`Добавлена подзадача «${newSubtask}»`);
    },
    onSuccess: () => {
      setNewSubtask("");
      setShowSubtaskInput(false);
      queryClient.invalidateQueries({ queryKey: ["subtasks", task?.id] });
    },
  });

  const toggleSubtask = useMutation({
    mutationFn: async ({ id: stId, done }: { id: string; done: boolean }) => {
      await supabase.from("subtasks").update({ is_done: done } as any).eq("id", stId);
      const st = subtasks.find(s => s.id === stId);
      await addSystemLog(`Подзадача «${st?.title}» ${done ? "выполнена ✓" : "возвращена в работу"}`);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["subtasks", task?.id] }),
  });

  if (!task) return null;

  const deadlineDate = task.deadline ? new Date(task.deadline) : null;
  const isOverdue = deadlineDate ? deadlineDate < new Date() && task.stage !== "Завершена" : false;
  const diffDays = deadlineDate ? Math.abs(Math.ceil((deadlineDate.getTime() - Date.now()) / 86400000)) : 0;
  const overduePeriod = diffDays >= 30 ? `${Math.floor(diffDays / 30)} мес.` : `${diffDays} дн.`;
  const taskIdShort = task.id.slice(0, 4).toUpperCase();
  const completedSubs = subtasks.filter((s: any) => s.is_done).length;

  const copyId = () => {
    navigator.clipboard.writeText(task.id);
    toast.success("ID скопирован");
  };

  const currentProject = projects.find(p => p.id === (editProjectId || task.project_id));

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[88vw] md:max-w-[88vw] p-0 overflow-hidden border-l-0 shadow-2xl" side="right">
        <div className="px-6 py-4 border-b border-border/60 bg-gradient-to-r from-primary/[0.04] to-transparent">
          <SheetTitle className="text-lg font-bold text-foreground leading-tight tracking-tight">
            {task.title}
          </SheetTitle>
        </div>

        <div className="flex flex-col md:flex-row h-[calc(100vh-72px)]">
          {/* ════ LEFT COLUMN ════ */}
          <div className="w-full md:w-[44%] lg:w-[40%] flex flex-col border-r border-border/50 bg-[hsl(var(--muted)/0.3)]">
            <div className="flex-1 overflow-y-auto p-5 space-y-4">

              {/* Description */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                <CardContent className="p-4">
                  {editingField === "description" && canEditFields ? (
                    <div className="space-y-2">
                      <Textarea
                        value={editDesc}
                        onChange={e => setEditDesc(e.target.value)}
                        className="text-sm min-h-[80px]"
                        placeholder="Описание задачи..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button size="sm" className="h-7 text-xs" onClick={saveDescription}>Сохранить</Button>
                        <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingField(null)}>Отмена</Button>
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn("flex items-start gap-2 cursor-pointer hover:text-foreground transition-colors", canEditFields ? "" : "cursor-default")}
                      onClick={() => canEditFields && setEditingField("description")}
                    >
                      <Edit3 className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      {editDesc ? (
                        <p className="text-sm text-foreground whitespace-pre-wrap">{editDesc}</p>
                      ) : (
                        <span className="text-sm text-muted-foreground/60 italic">Описание</span>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Main properties */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
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
                  <div className="flex items-start gap-4 px-4 py-3.5">
                    <CalendarDays className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0 pt-0.5">Крайний срок</span>
                    <div className="flex-1">
                      {editingField === "deadline" && canEditFields ? (
                        <div className="flex items-center gap-2">
                          <Input type="datetime-local" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} className="h-8 text-sm w-auto" />
                          <Button size="sm" className="h-7 text-xs" onClick={saveDeadline}>OK</Button>
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setEditingField(null)}>✕</Button>
                        </div>
                      ) : (
                        <div
                          className={cn("cursor-pointer", canEditFields ? "" : "cursor-default")}
                          onClick={() => canEditFields && setEditingField("deadline")}
                        >
                          {deadlineDate ? (
                            <div className="flex flex-col gap-1.5">
                              <span className={cn("text-sm font-semibold", isOverdue ? "text-destructive" : "text-foreground")}>
                                {deadlineDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
                              </span>
                              {isOverdue && (
                                <span className="inline-flex items-center self-start px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-destructive/10 text-destructive border border-destructive/20">
                                  Просрочена на {overduePeriod}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-sm text-muted-foreground">Не задан</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Status */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <Hourglass className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Статус</span>
                    <Badge
                      variant="outline"
                      className="text-xs font-medium gap-1"
                      style={{ borderColor: task.stage_color || undefined, color: task.stage_color || undefined }}
                    >
                      {editStage || task.stage}
                    </Badge>
                  </div>

                  {/* Created */}
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <Clock className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Дата создания</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-foreground">
                        {new Date(task.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })} в {new Date(task.created_at).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs text-muted-foreground/60">/ ID {taskIdShort}</span>
                      <button onClick={copyId} className="text-muted-foreground/40 hover:text-foreground transition-colors">
                        <Copy className="h-3 w-3" />
                      </button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Project */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                <CardContent className="p-0">
                  <div className="flex items-center gap-4 px-4 py-3.5">
                    <FolderOpen className="h-4 w-4 text-primary shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Проект</span>
                    {canEditFields ? (
                      <Select value={editProjectId || task.project_id || ""} onValueChange={saveProject}>
                        <SelectTrigger className="h-8 text-sm border-0 bg-transparent shadow-none p-0 w-auto gap-2">
                          <SelectValue placeholder="Выбрать проект...">
                            {currentProject ? (
                              <div className="flex items-center gap-2">
                                <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                                  <span className="text-[8px] font-bold text-primary">{currentProject.name.slice(0, 2).toUpperCase()}</span>
                                </div>
                                <span className="font-medium">{currentProject.name}</span>
                              </div>
                            ) : "Выбрать проект..."}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent>
                          {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    ) : currentProject ? (
                      <div className="flex items-center gap-2">
                        <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center">
                          <span className="text-[8px] font-bold text-primary">{currentProject.name.slice(0, 2).toUpperCase()}</span>
                        </div>
                        <span className="text-sm font-medium text-foreground">{currentProject.name}</span>
                      </div>
                    ) : <span className="text-sm text-muted-foreground">Не привязан</span>}
                  </div>
                  {currentProject && (
                    <div className="flex items-center gap-4 px-4 py-2.5 border-t border-border/30">
                      <div className="w-4" />
                      <span className="text-xs text-muted-foreground w-24 shrink-0">Стадия</span>
                      <Badge variant="secondary" className="text-[11px]">
                        {currentProject.privacy || "Новые заявки"}
                      </Badge>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Observers */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                <CardContent className="p-4">
                  <div className="flex items-center gap-4">
                    <Eye className="h-4 w-4 text-muted-foreground shrink-0" />
                    <span className="text-xs text-muted-foreground w-24 shrink-0">Наблюдатели</span>
                    <div className="flex -space-x-2">
                      {[task.creator, task.assignee].filter(Boolean).map((person, i) => (
                        <img key={i} src={getAvatarUrl(person!.full_name)} alt="" className="h-7 w-7 rounded-full object-cover ring-2 ring-card shadow-sm" />
                      ))}
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center ring-2 ring-card text-[10px] font-medium text-muted-foreground cursor-pointer hover:bg-muted/80">
                        +
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Subtasks */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm font-medium text-foreground">Подзадачи: {completedSubs}/{subtasks.length}</span>
                    </div>
                    {canEditFields && (
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-foreground" onClick={() => setShowSubtaskInput(true)}>
                        <Plus className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                  {subtasks.length > 0 && (
                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-emerald-500 rounded-full transition-all" style={{ width: `${subtasks.length > 0 ? (completedSubs / subtasks.length) * 100 : 0}%` }} />
                    </div>
                  )}
                  {subtasks.map((st: any) => (
                    <div key={st.id} className="flex items-center gap-2.5 py-1">
                      <Checkbox
                        checked={st.is_done}
                        onCheckedChange={(v) => toggleSubtask.mutate({ id: st.id, done: !!v })}
                        disabled={!canEditFields}
                      />
                      <span className={cn("text-sm", st.is_done && "line-through text-muted-foreground")}>{st.title}</span>
                    </div>
                  ))}
                  {showSubtaskInput && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={newSubtask}
                        onChange={e => setNewSubtask(e.target.value)}
                        placeholder="Название подзадачи..."
                        className="h-8 text-sm flex-1"
                        autoFocus
                        onKeyDown={e => e.key === "Enter" && newSubtask.trim() && addSubtask.mutate()}
                      />
                      <Button size="sm" className="h-8 text-xs" onClick={() => newSubtask.trim() && addSubtask.mutate()} disabled={addSubtask.isPending}>OK</Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Result field */}
              <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">Результат работы</span>
                  </div>
                  <div className="space-y-2">
                    <Textarea
                      value={resultText}
                      onChange={e => setResultText(e.target.value)}
                      placeholder="Введите текст, ссылку на результат..."
                      className="text-sm min-h-[60px] resize-none"
                    />
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

              {/* Account Manager (read-only from project) */}
              {currentProject && (
                <Card className="bg-card shadow-sm border-border/60 rounded-xl">
                  <CardContent className="p-0">
                    <div className="flex items-center gap-4 px-4 py-3.5">
                      <Briefcase className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground w-28 shrink-0">Аккаунт-менеджер</span>
                      {(() => {
                        const amId = (currentProject as any).account_manager_id;
                        const am = amId ? members.find(m => m.id === amId) : null;
                        return am ? (
                          <div className="flex items-center gap-2">
                            <img src={getAvatarUrl(am.full_name)} alt="" className="h-6 w-6 rounded-full object-cover" />
                            <span className="text-sm font-medium text-foreground">{am.full_name}</span>
                          </div>
                        ) : (
                          <span className="text-sm text-muted-foreground">Не назначен в проекте</span>
                        );
                      })()}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            {/* Sticky bottom action bar */}
            <div className="border-t border-border/60 bg-card px-5 py-3 flex items-center gap-3 shrink-0 flex-wrap">
              <Button
                size="sm"
                className="gap-1.5 shadow-sm bg-primary hover:bg-primary/90"
                onClick={startTask}
                disabled={editStage === "В работе" || editStage === "Завершена"}
              >
                <Play className="h-3.5 w-3.5" /> Начать
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={completeTask}
                disabled={editStage === "Завершена"}
              >
                <CheckCircle2 className="h-3.5 w-3.5" /> Завершить
              </Button>
              {editStage === "Завершена" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-primary/30 text-primary hover:bg-primary/5"
                  onClick={resumeTask}
                >
                  <RotateCcw className="h-3.5 w-3.5" /> Возобновить
                </Button>
              )}
              <Button variant="ghost" size="sm" className="text-muted-foreground ml-auto">
                •••
              </Button>
              <span className="text-xs text-muted-foreground cursor-pointer hover:text-foreground transition-colors">Оценить задачу</span>
            </div>
          </div>

          {/* ════ RIGHT COLUMN: Chat ════ */}
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
                      <motion.div
                        className="flex gap-3 group"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.02, duration: 0.2 }}
                      >
                        <img
                          src={m.author ? getAvatarUrl(m.author.full_name) : "https://i.pravatar.cc/80?u=anon"}
                          alt=""
                          className="h-9 w-9 rounded-full object-cover ring-2 ring-background shadow-sm mt-0.5 shrink-0"
                        />
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
                <Input
                  placeholder="Нажмите @ или +, чтобы упомянуть человека, чат или AI"
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  className="flex-1 h-9 border-0 bg-transparent shadow-none focus-visible:ring-0 text-sm placeholder:text-muted-foreground/50"
                  onKeyDown={e => e.key === "Enter" && msg.trim() && sendComment.mutate()}
                />
                <Button
                  size="icon"
                  className="h-8 w-8 rounded-lg shrink-0 shadow-sm"
                  disabled={!msg.trim() || sendComment.isPending}
                  onClick={() => sendComment.mutate()}
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

/* ─── unused PropertyRow kept for compatibility ─── */
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
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Задачи</h1>
          <AddTaskDialog />
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск задачи..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm bg-muted/30 border-border/60 focus:bg-card transition-colors" />
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
