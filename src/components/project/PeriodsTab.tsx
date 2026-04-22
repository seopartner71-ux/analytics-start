import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Plus, Calendar, FileText, ListPlus, Copy, FileStack, GripVertical,
  Trash2, MoreVertical, CalendarDays, User, AlertCircle, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import {
  DndContext, closestCenter, PointerSensor, useSensor, useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove, SortableContext, useSortable, verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { cn } from "@/lib/utils";

const MONTH_NAMES = [
  "Январь", "Февраль", "Март", "Апрель", "Май", "Июнь",
  "Июль", "Август", "Сентябрь", "Октябрь", "Ноябрь", "Декабрь",
];

const CATEGORIES = [
  { value: "general", label: "Общее" },
  { value: "analytics", label: "Аналитика" },
  { value: "tech", label: "Технические" },
  { value: "content", label: "Контент" },
  { value: "links", label: "Ссылки" },
  { value: "reports", label: "Отчётность" },
];

type Period = {
  id: string;
  project_id: string;
  year: number;
  month: number;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
};

type PeriodTask = {
  id: string;
  period_id: string;
  title: string;
  category: string;
  assignee_id: string | null;
  deadline: string | null;
  required: boolean;
  completed: boolean;
  sort_order: number;
  crm_task_id: string | null;
};

type Member = { id: string; full_name: string };

type CreateMode = "template" | "list" | "manual" | "copy";

export function PeriodsTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const { data: periods = [] } = useQuery({
    queryKey: ["project-periods", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_periods").select("*")
        .eq("project_id", projectId)
        .order("year", { ascending: false })
        .order("month", { ascending: false });
      return (data || []) as Period[];
    },
  });

  const activePeriod = useMemo(
    () => periods.find((p) => p.id === selectedPeriodId) || periods[0],
    [periods, selectedPeriodId],
  );

  const { data: tasks = [] } = useQuery({
    queryKey: ["period-tasks", activePeriod?.id],
    queryFn: async () => {
      if (!activePeriod) return [];
      const { data } = await supabase
        .from("period_tasks").select("*")
        .eq("period_id", activePeriod.id)
        .order("sort_order", { ascending: true });
      return (data || []) as PeriodTask[];
    },
    enabled: !!activePeriod?.id,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members-min"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name").order("full_name");
      return (data || []) as Member[];
    },
  });

  const { data: templates = [] } = useQuery({
    queryKey: ["onb-templates-active"],
    queryFn: async () => {
      const { data } = await supabase
        .from("onboarding_task_templates").select("*")
        .eq("is_active", true).order("sort_order");
      return data || [];
    },
  });

  // Создаёт CRM-задачу и возвращает её id (если переданы данные задачи).
  const createCrmTask = async (t: Partial<PeriodTask>) => {
    if (!t.title) return null;
    const { data, error } = await supabase
      .from("crm_tasks")
      .insert({
        title: t.title,
        stage: "Новые",
        priority: "medium",
        deadline: t.deadline ? new Date(t.deadline).toISOString() : null,
        assignee_id: t.assignee_id || null,
        project_id: projectId,
        creator_id: null,
        owner_id: user!.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    return data.id as string;
  };

  // Mutations
  const createPeriod = useMutation({
    mutationFn: async (vars: {
      year: number;
      month: number;
      title: string;
      start_date: string;
      end_date: string;
      tasks: Partial<PeriodTask>[];
    }) => {
      const { data: p, error } = await supabase
        .from("project_periods")
        .insert({
          project_id: projectId,
          owner_id: user!.id,
          year: vars.year,
          month: vars.month,
          title: vars.title,
          start_date: vars.start_date,
          end_date: vars.end_date,
        })
        .select().single();
      if (error) throw error;
      if (vars.tasks.length > 0) {
        // Создаём CRM-задачи последовательно, чтобы получить id для связи
        const rows: any[] = [];
        for (let i = 0; i < vars.tasks.length; i++) {
          const t = vars.tasks[i];
          const crmId = await createCrmTask(t);
          rows.push({
            period_id: p.id,
            title: t.title!,
            category: t.category || "general",
            assignee_id: t.assignee_id || null,
            deadline: t.deadline || null,
            required: t.required || false,
            sort_order: i,
            crm_task_id: crmId,
          });
        }
        const { error: te } = await supabase.from("period_tasks").insert(rows);
        if (te) throw te;
      }
      return p as Period;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["project-periods", projectId] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      setSelectedPeriodId(p.id);
      setCreateOpen(false);
      toast.success(`Период «${p.title}» создан`);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка создания периода"),
  });

  const addTask = useMutation({
    mutationFn: async (vars: Partial<PeriodTask>) => {
      const sort_order = tasks.length;
      const crmId = await createCrmTask(vars);
      const { error } = await supabase.from("period_tasks").insert({
        period_id: activePeriod!.id,
        title: vars.title!,
        category: vars.category || "general",
        assignee_id: vars.assignee_id || null,
        deadline: vars.deadline || null,
        required: vars.required || false,
        sort_order,
        crm_task_id: crmId,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      toast.success("Задача создана и добавлена в проект");
    },
    onError: (e: any) => toast.error(e.message || "Ошибка создания задачи"),
  });

  const updateTask = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<PeriodTask> }) => {
      const { error } = await supabase.from("period_tasks").update(vars.patch).eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] }),
  });

  const deleteTasks = useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from("period_tasks").delete().in("id", ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      setSelectedTaskIds(new Set());
    },
  });

  const reorder = useMutation({
    mutationFn: async (newOrder: PeriodTask[]) => {
      await Promise.all(
        newOrder.map((t, i) =>
          supabase.from("period_tasks").update({ sort_order: i }).eq("id", t.id),
        ),
      );
    },
  });

  const bulkUpdate = useMutation({
    mutationFn: async (vars: { ids: string[]; patch: Partial<PeriodTask> }) => {
      const { error } = await supabase.from("period_tasks").update(vars.patch).in("id", vars.ids);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      setSelectedTaskIds(new Set());
      toast.success("Обновлено");
    },
  });

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
  const handleDragEnd = (e: DragEndEvent) => {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldIdx = tasks.findIndex((t) => t.id === active.id);
    const newIdx = tasks.findIndex((t) => t.id === over.id);
    const next = arrayMove(tasks, oldIdx, newIdx);
    qc.setQueryData(["period-tasks", activePeriod?.id], next);
    reorder.mutate(next);
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-4 gap-5">
      {/* Sidebar: periods list */}
      <div className="space-y-2">
        <Button onClick={() => setCreateOpen(true)} className="w-full" size="sm">
          <Plus className="h-4 w-4 mr-1.5" /> Новый период
        </Button>
        <div className="space-y-1.5 mt-3">
          {periods.length === 0 && (
            <Card className="p-4 text-center border-dashed">
              <Calendar className="h-7 w-7 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-xs text-muted-foreground">Нет периодов</p>
            </Card>
          )}
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPeriodId(p.id)}
              className={cn(
                "w-full text-left px-3 py-2.5 rounded-lg border transition-all",
                activePeriod?.id === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card",
              )}
            >
              <div className="text-sm font-medium">{p.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">
                {p.status === "active" ? "Активный" : "Завершён"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Main: tasks */}
      <div className="lg:col-span-3">
        {!activePeriod ? (
          <Card className="p-12 text-center border-dashed">
            <Calendar className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <h3 className="text-base font-medium">Создайте первый период</h3>
            <p className="text-sm text-muted-foreground mt-1">
              Сгруппируйте задачи по месяцам и отслеживайте прогресс
            </p>
          </Card>
        ) : (
          <PeriodTasksPanel
            period={activePeriod}
            tasks={tasks}
            members={members}
            selectedIds={selectedTaskIds}
            onToggleSelect={(id) => {
              setSelectedTaskIds((s) => {
                const n = new Set(s);
                n.has(id) ? n.delete(id) : n.add(id);
                return n;
              });
            }}
            onSelectAll={(all) => setSelectedTaskIds(all ? new Set(tasks.map((t) => t.id)) : new Set())}
            onAddTask={(t) => addTask.mutate(t)}
            onUpdateTask={(id, patch) => updateTask.mutate({ id, patch })}
            onDeleteSelected={() => deleteTasks.mutate(Array.from(selectedTaskIds))}
            onBulkUpdate={(patch) => bulkUpdate.mutate({ ids: Array.from(selectedTaskIds), patch })}
            sensors={sensors}
            onDragEnd={handleDragEnd}
          />
        )}
      </div>

      <CreatePeriodDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        existingPeriods={periods}
        templates={templates as any[]}
        onCreate={(payload) => createPeriod.mutate(payload)}
        creating={createPeriod.isPending}
        loadPastTasks={async (periodId) => {
          const { data } = await supabase.from("period_tasks").select("*").eq("period_id", periodId);
          return (data || []) as PeriodTask[];
        }}
      />
    </div>
  );
}

/* -------------------- Tasks panel -------------------- */

function PeriodTasksPanel(props: {
  period: Period;
  tasks: PeriodTask[];
  members: Member[];
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (all: boolean) => void;
  onAddTask: (t: Partial<PeriodTask>) => void;
  onUpdateTask: (id: string, patch: Partial<PeriodTask>) => void;
  onDeleteSelected: () => void;
  onBulkUpdate: (patch: Partial<PeriodTask>) => void;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  const { period, tasks, members, selectedIds } = props;
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("none");
  const [newDeadline, setNewDeadline] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("general");
  const [newRequired, setNewRequired] = useState(false);
  const completed = tasks.filter((t) => t.completed).length;

  const handleQuickAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    props.onAddTask({
      title,
      assignee_id: newAssignee === "none" ? null : newAssignee,
      deadline: newDeadline || null,
      category: newCategory,
      required: newRequired,
    });
    setNewTitle("");
    setNewAssignee("none");
    setNewDeadline("");
    setNewCategory("general");
    setNewRequired(false);
  };

  return (
    <Card className="p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-base font-semibold">{period.title}</h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {completed} из {tasks.length} задач выполнено
          </p>
        </div>
        {selectedIds.size > 0 && (
          <BulkActionsBar
            count={selectedIds.size}
            members={members}
            onAssign={(assignee_id) => props.onBulkUpdate({ assignee_id })}
            onDeadline={(deadline) => props.onBulkUpdate({ deadline })}
            onDelete={props.onDeleteSelected}
          />
        )}
      </div>

      {/* Tasks list */}
      {tasks.length > 0 && (
        <div className="flex items-center gap-2 px-2 pb-2 border-b border-border/60 mb-2">
          <Checkbox
            checked={selectedIds.size === tasks.length}
            onCheckedChange={(v) => props.onSelectAll(!!v)}
          />
          <span className="text-[11px] text-muted-foreground">Выбрать все</span>
        </div>
      )}

      <DndContext sensors={props.sensors} collisionDetection={closestCenter} onDragEnd={props.onDragEnd}>
        <SortableContext items={tasks.map((t) => t.id)} strategy={verticalListSortingStrategy}>
          <div className="space-y-1">
            {tasks.map((t) => (
              <SortableTaskRow
                key={t.id}
                task={t}
                members={members}
                selected={selectedIds.has(t.id)}
                onToggleSelect={() => props.onToggleSelect(t.id)}
                onUpdate={(patch) => props.onUpdateTask(t.id, patch)}
                onDelete={() => props.onUpdateTask(t.id, { completed: !t.completed })}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {/* Add task form (как в CRM) */}
      <div className="mt-3 pt-3 border-t border-border/60 space-y-2">
        <Input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleQuickAdd()}
          placeholder="Название задачи..."
          className="h-9"
        />
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <Select value={newAssignee} onValueChange={setNewAssignee}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder="Ответственный" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Не назначен</SelectItem>
              {members.map((m) => (
                <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newCategory} onValueChange={setNewCategory}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="date"
            value={newDeadline}
            onChange={(e) => setNewDeadline(e.target.value)}
            className="h-9 text-xs"
            placeholder="Дедлайн"
          />
        </div>
        <div className="flex items-center justify-between">
          <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
            <Checkbox checked={newRequired} onCheckedChange={(v) => setNewRequired(!!v)} />
            Обязательная
          </label>
          <Button onClick={handleQuickAdd} disabled={!newTitle.trim()} size="sm">
            <Plus className="h-3.5 w-3.5 mr-1" /> Добавить задачу
          </Button>
        </div>
      </div>
    </Card>
  );
}

function SortableTaskRow(props: {
  task: PeriodTask;
  members: Member[];
  selected: boolean;
  onToggleSelect: () => void;
  onUpdate: (patch: Partial<PeriodTask>) => void;
  onDelete: () => void;
}) {
  const { task, members, selected } = props;
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: task.id });
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.5 : 1 };
  const assignee = members.find((m) => m.id === task.assignee_id);

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "group flex items-center gap-2 px-2 py-2 rounded-md border transition-colors",
        selected ? "bg-primary/5 border-primary/40" : "border-transparent hover:bg-muted/40",
      )}
    >
      <button
        {...attributes}
        {...listeners}
        className="opacity-0 group-hover:opacity-100 cursor-grab text-muted-foreground"
      >
        <GripVertical className="h-4 w-4" />
      </button>
      <Checkbox checked={selected} onCheckedChange={props.onToggleSelect} />
      <Checkbox
        checked={task.completed}
        onCheckedChange={(v) => props.onUpdate({ completed: !!v })}
      />
      <div className="flex-1 min-w-0">
        <div className={cn("text-sm truncate", task.completed && "line-through text-muted-foreground")}>
          {task.title}
        </div>
        <div className="flex items-center gap-2 mt-0.5">
          {task.required && (
            <Badge variant="outline" className="h-4 text-[9px] px-1">
              Обязат.
            </Badge>
          )}
          {assignee && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" /> {assignee.full_name}
            </span>
          )}
          {task.deadline && (
            <span className="text-[11px] text-muted-foreground flex items-center gap-1">
              <CalendarDays className="h-3 w-3" />
              {format(new Date(task.deadline), "d MMM", { locale: ru })}
            </span>
          )}
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon" className="h-7 w-7 opacity-0 group-hover:opacity-100">
            <MoreVertical className="h-3.5 w-3.5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <div className="px-2 py-1.5 space-y-2">
            <div>
              <Label className="text-[10px]">Ответственный</Label>
              <Select
                value={task.assignee_id || "none"}
                onValueChange={(v) => props.onUpdate({ assignee_id: v === "none" ? null : v })}
              >
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {members.map((m) => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[10px]">Дедлайн</Label>
              <Input
                type="date"
                value={task.deadline || ""}
                onChange={(e) => props.onUpdate({ deadline: e.target.value || null })}
                className="h-8"
              />
            </div>
          </div>
          <DropdownMenuItem
            onClick={() => props.onUpdate({ required: !task.required })}
            className="gap-2"
          >
            <AlertCircle className="h-3.5 w-3.5" />
            {task.required ? "Снять обязательность" : "Сделать обязательной"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function BulkActionsBar(props: {
  count: number;
  members: Member[];
  onAssign: (id: string | null) => void;
  onDeadline: (date: string | null) => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex items-center gap-2 bg-primary/10 px-3 py-1.5 rounded-md">
      <span className="text-xs font-medium">{props.count} выбрано</span>
      <Select onValueChange={(v) => props.onAssign(v === "none" ? null : v)}>
        <SelectTrigger className="h-7 w-40 text-xs"><SelectValue placeholder="Назначить..." /></SelectTrigger>
        <SelectContent>
          <SelectItem value="none">Снять</SelectItem>
          {props.members.map((m) => (
            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        onChange={(e) => e.target.value && props.onDeadline(e.target.value)}
        className="h-7 w-32 text-xs"
      />
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить {props.count} задач?</AlertDialogTitle>
            <AlertDialogDescription>Действие необратимо.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={props.onDelete}>Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* -------------------- Create dialog -------------------- */

function CreatePeriodDialog(props: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingPeriods: Period[];
  templates: any[];
  onCreate: (payload: {
    year: number;
    month: number;
    title: string;
    start_date: string;
    end_date: string;
    tasks: Partial<PeriodTask>[];
  }) => void;
  creating: boolean;
  loadPastTasks: (periodId: string) => Promise<PeriodTask[]>;
}) {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const monthEndIso = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);

  const [step, setStep] = useState<"select" | "build">("select");
  const [mode, setMode] = useState<CreateMode>("template");
  const [startDate, setStartDate] = useState(todayIso);
  const [endDate, setEndDate] = useState(monthEndIso);
  const [title, setTitle] = useState("");

  // Year/Month вычисляем из startDate (для совместимости и UNIQUE-ключа)
  const start = new Date(startDate);
  const year = start.getFullYear();
  const month = start.getMonth() + 1;
  const autoTitle = `${MONTH_NAMES[month - 1]} ${year}`;
  const effectiveTitle = title.trim() || autoTitle;

  // Build state per mode
  const [templateTasks, setTemplateTasks] = useState<Partial<PeriodTask>[]>([]);
  const [listText, setListText] = useState("");
  const [manualTasks, setManualTasks] = useState<Partial<PeriodTask>[]>([]);
  const [copyFromId, setCopyFromId] = useState<string>("");
  const [copyOptions, setCopyOptions] = useState({ onlyOpen: false, assignees: true, deadlines: false });
  const [copyTasks, setCopyTasks] = useState<Partial<PeriodTask>[]>([]);

  const reset = () => {
    setStep("select");
    setMode("template");
    setTitle("");
    setTemplateTasks([]);
    setListText("");
    setManualTasks([]);
    setCopyFromId("");
    setCopyTasks([]);
  };

  const handleNext = async () => {
    if (mode === "template") {
      setTemplateTasks(
        props.templates.map((t) => ({
          title: t.title,
          category: "general",
          required: false,
        })),
      );
    } else if (mode === "copy" && copyFromId) {
      const past = await props.loadPastTasks(copyFromId);
      const filtered = copyOptions.onlyOpen ? past.filter((t) => !t.completed) : past;
      setCopyTasks(
        filtered.map((t) => ({
          title: t.title,
          category: t.category,
          assignee_id: copyOptions.assignees ? t.assignee_id : null,
          deadline: copyOptions.deadlines && t.deadline
            ? recalcDeadline(t.deadline, year, month)
            : null,
          required: t.required,
        })),
      );
    }
    setStep("build");
  };

  const handleCreate = () => {
    if (!startDate || !endDate) {
      toast.error("Укажите даты начала и окончания");
      return;
    }
    if (endDate < startDate) {
      toast.error("Дата окончания должна быть позже даты начала");
      return;
    }
    let finalTasks: Partial<PeriodTask>[] = [];
    if (mode === "template") finalTasks = templateTasks;
    else if (mode === "list") {
      finalTasks = listText
        .split("\n").map((s) => s.trim()).filter(Boolean)
        .map((t) => ({ title: t, category: "general" }));
    } else if (mode === "manual") finalTasks = manualTasks;
    else if (mode === "copy") finalTasks = copyTasks;

    props.onCreate({
      year,
      month,
      title: effectiveTitle,
      start_date: startDate,
      end_date: endDate,
      tasks: finalTasks,
    });
    reset();
  };

  return (
    <Dialog open={props.open} onOpenChange={(v) => { props.onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {step === "select" ? "Создание периода" : `Задачи: ${effectiveTitle}`}
          </DialogTitle>
        </DialogHeader>

        {step === "select" ? (
          <div className="space-y-4">
            <div>
              <Label>Название периода</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={autoTitle}
              />
              <p className="text-[11px] text-muted-foreground mt-1">
                По умолчанию — месяц и год начала периода.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label>Дата начала</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
              </div>
              <div>
                <Label>Дата окончания</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="mb-2 block">Способ создания задач</Label>
              <RadioGroup value={mode} onValueChange={(v) => setMode(v as CreateMode)} className="space-y-2">
                <ModeOption value="template" icon={<FileStack />} label="Из шаблона" hint="Стандартный набор задач из настроек" />
                <ModeOption value="list" icon={<ListPlus />} label="Загрузить списком" hint="Вставить задачи построчно" />
                <ModeOption value="manual" icon={<Plus />} label="Создать вручную" hint="Добавлять по одной с настройками" />
                <ModeOption
                  value="copy"
                  icon={<Copy />}
                  label="Скопировать из прошлого периода"
                  hint="Перенести задачи из предыдущего периода"
                  disabled={props.existingPeriods.length === 0}
                />
              </RadioGroup>
            </div>

            <DialogFooter>
              <Button variant="ghost" onClick={() => props.onOpenChange(false)}>Отмена</Button>
              <Button onClick={handleNext}>Продолжить</Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            {mode === "template" && (
              <TemplatePreview tasks={templateTasks} setTasks={setTemplateTasks} />
            )}
            {mode === "list" && (
              <Textarea
                value={listText}
                onChange={(e) => setListText(e.target.value)}
                placeholder={"Анализ позиций за апрель\nOn-Page оптимизация страниц\nПодготовка ТЗ на тексты\n..."}
                rows={10}
                className="font-mono text-sm"
              />
            )}
            {mode === "manual" && (
              <ManualBuilder tasks={manualTasks} setTasks={setManualTasks} />
            )}
            {mode === "copy" && (
              <CopyBuilder
                periods={props.existingPeriods}
                copyFromId={copyFromId}
                setCopyFromId={setCopyFromId}
                options={copyOptions}
                setOptions={setCopyOptions}
                tasks={copyTasks}
              />
            )}

            <DialogFooter>
              <Button variant="ghost" onClick={() => setStep("select")}>Назад</Button>
              <Button onClick={handleCreate} disabled={props.creating}>
                {props.creating && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Создать период
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ModeOption({ value, icon, label, hint, disabled }: {
  value: string; icon: React.ReactNode; label: string; hint: string; disabled?: boolean;
}) {
  return (
    <Label
      htmlFor={value}
      className={cn(
        "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
        "hover:border-primary/40 hover:bg-muted/30",
        disabled && "opacity-50 cursor-not-allowed",
      )}
    >
      <RadioGroupItem value={value} id={value} disabled={disabled} />
      <div className="text-muted-foreground [&>svg]:h-4 [&>svg]:w-4">{icon}</div>
      <div className="flex-1">
        <div className="text-sm font-medium">{label}</div>
        <div className="text-[11px] text-muted-foreground">{hint}</div>
      </div>
    </Label>
  );
}

function TemplatePreview({ tasks, setTasks }: {
  tasks: Partial<PeriodTask>[]; setTasks: (t: Partial<PeriodTask>[]) => void;
}) {
  if (tasks.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-6">В шаблоне нет задач. Заполните в админке.</p>;
  }
  return (
    <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
      <p className="text-xs text-muted-foreground mb-2">Снимите галочки с ненужных задач:</p>
      {tasks.map((t, i) => (
        <div key={i} className="flex items-center gap-2 p-2 rounded-md border border-border/60">
          <Checkbox
            defaultChecked
            onCheckedChange={(v) => {
              if (!v) setTasks(tasks.filter((_, idx) => idx !== i));
            }}
          />
          <span className="text-sm">{t.title}</span>
        </div>
      ))}
    </div>
  );
}

function ManualBuilder({ tasks, setTasks }: {
  tasks: Partial<PeriodTask>[]; setTasks: (t: Partial<PeriodTask>[]) => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("general");
  const [required, setRequired] = useState(false);
  const add = () => {
    if (!title.trim()) return;
    setTasks([...tasks, { title: title.trim(), category, required }]);
    setTitle(""); setRequired(false);
  };
  return (
    <div className="space-y-3">
      <div className="space-y-2 p-3 border border-border/60 rounded-lg">
        <Input placeholder="Название задачи" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => e.key === "Enter" && add()} />
        <div className="grid grid-cols-2 gap-2">
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={required} onCheckedChange={(v) => setRequired(!!v)} />
            Обязательная
          </label>
        </div>
        <Button onClick={add} disabled={!title.trim()} size="sm" className="w-full">
          <Plus className="h-3.5 w-3.5 mr-1" /> Добавить задачу
        </Button>
      </div>
      <div className="space-y-1 max-h-[250px] overflow-y-auto">
        {tasks.map((t, i) => (
          <div key={i} className="flex items-center justify-between p-2 rounded-md border border-border/60">
            <span className="text-sm">{t.title}</span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setTasks(tasks.filter((_, x) => x !== i))}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        ))}
        {tasks.length === 0 && <p className="text-xs text-muted-foreground text-center py-3">Пока нет задач</p>}
      </div>
    </div>
  );
}

function CopyBuilder(props: {
  periods: Period[]; copyFromId: string; setCopyFromId: (v: string) => void;
  options: { onlyOpen: boolean; assignees: boolean; deadlines: boolean };
  setOptions: (v: any) => void; tasks: Partial<PeriodTask>[];
}) {
  return (
    <div className="space-y-3">
      <div>
        <Label>Источник</Label>
        <Select value={props.copyFromId} onValueChange={props.setCopyFromId}>
          <SelectTrigger><SelectValue placeholder="Выберите период..." /></SelectTrigger>
          <SelectContent>
            {props.periods.map((p) => (
              <SelectItem key={p.id} value={p.id}>{p.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2 p-3 border border-border/60 rounded-lg">
        <Label className="text-xs mb-1">Что копировать</Label>
        {[
          { key: "onlyOpen" as const, label: "Только невыполненные" },
          { key: "assignees" as const, label: "Ответственных" },
          { key: "deadlines" as const, label: "Дедлайны (пересчитать на новый месяц)" },
        ].map((opt) => (
          <label key={opt.key} className="flex items-center gap-2 text-sm">
            <Checkbox
              checked={props.options[opt.key]}
              onCheckedChange={(v) => props.setOptions({ ...props.options, [opt.key]: !!v })}
            />
            {opt.label}
          </label>
        ))}
      </div>
    </div>
  );
}

function recalcDeadline(originalIso: string, newYear: number, newMonth: number): string {
  const d = new Date(originalIso);
  const day = Math.min(d.getDate(), 28);
  return `${newYear}-${String(newMonth).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}
