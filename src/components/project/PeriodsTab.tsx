import { useState, useMemo, useEffect } from "react";
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
  Trash2, MoreVertical, CalendarDays, User, AlertCircle, Loader2, CalendarRange,
} from "lucide-react";
import { toast } from "sonner";
import { DeleteButton } from "@/components/common/DeleteButton";
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
import { generateWeeksInRange, findWeekForDate, type WeekOption } from "@/lib/iso-week";

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

const toDateOnly = (value?: string | null) => value?.slice(0, 10) || null;

const toDeadlineIso = (value?: string | null) => {
  const dateOnly = toDateOnly(value);
  return dateOnly ? `${dateOnly}T00:00:00.000Z` : null;
};

const formatDateLabel = (value: string) => format(new Date(`${toDateOnly(value)}T00:00:00`), "dd.MM.yyyy");

const getTaskDateError = ({
  startDate,
  deadline,
  periodStart,
  periodEnd,
  projectDeadline,
}: {
  startDate?: string | null;
  deadline?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  projectDeadline?: string | null;
}) => {
  const start = toDateOnly(startDate);
  const due = toDateOnly(deadline);
  const periodFrom = toDateOnly(periodStart);
  const periodTo = toDateOnly(periodEnd);
  const projectDue = toDateOnly(projectDeadline);

  if (start && due && start > due) {
    return "Дата начала не может быть позже срока выполнения";
  }

  if (start && periodFrom && start < periodFrom) {
    return `Дата начала задачи не может быть раньше начала периода (${formatDateLabel(periodFrom)})`;
  }

  if (start && periodTo && start > periodTo) {
    return `Дата начала задачи не может быть позже окончания периода (${formatDateLabel(periodTo)})`;
  }

  if (due && periodFrom && due < periodFrom) {
    return `Срок задачи не может быть раньше начала периода (${formatDateLabel(periodFrom)})`;
  }

  if (due && periodTo && due > periodTo) {
    return `Срок задачи не может быть позже окончания периода (${formatDateLabel(periodTo)})`;
  }

  if (start && projectDue && start > projectDue) {
    return `Дата начала задачи не может быть позже срока проекта (${formatDateLabel(projectDue)})`;
  }

  if (due && projectDue && due > projectDue) {
    return `Срок задачи не может быть позже срока проекта (${formatDateLabel(projectDue)})`;
  }

  return null;
};

type Period = {
  id: string;
  project_id: string;
  year: number;
  month: number;
  title: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  crm_task_id: string | null;
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
  crm_task_id: string | null; // id записи в subtasks
  week_number: number | null;
  week_start: string | null;
  week_end: string | null;
};

type Member = { id: string; full_name: string };

type CreateMode = "template" | "list" | "manual" | "copy";

export function PeriodsTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [selectedTaskIds, setSelectedTaskIds] = useState<Set<string>>(new Set());

  const { data: project } = useQuery({
    queryKey: ["period-project", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, deadline")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

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

  // Realtime: при изменении пунктов периода или связанных CRM-задач — обновляем данные
  useEffect(() => {
    if (!activePeriod?.id) return;
    const channel = supabase
      .channel(`period-sync-${activePeriod.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "period_tasks", filter: `period_id=eq.${activePeriod.id}` }, () => {
        qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod.id] });
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "crm_tasks" }, () => {
        qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod.id] });
        qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [activePeriod?.id, qc, projectId]);

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

  // Создаёт CRM-задачу проекта как дочернюю к главной задаче периода и возвращает её id.
  // Так задача появится во вкладке «Задачи» проекта.
  // Дополнительно: дата начала пишется в description, наблюдатель — в task_members.
  const createChildCrmTaskFor = async (parentTaskId: string, t: Partial<PeriodTask> & { start_date?: string | null; watcher_id?: string | null }) => {
    if (!t.title) return null;
    const startDate = toDateOnly(t.start_date);
    const description = startDate ? `Начало: ${format(new Date(startDate), "dd.MM.yyyy")}` : null;
    const { resolveCurrentTeamMemberId } = await import("@/lib/task-helpers");
    const creatorTmId = await resolveCurrentTeamMemberId(supabase, user!.id, user!.email);
    const { data, error } = await supabase
      .from("crm_tasks")
      .insert({
        title: t.title,
        stage: t.completed ? "Завершена" : "Новые",
        stage_color: t.completed ? "#10b981" : "#3b82f6",
        stage_progress: t.completed ? 100 : 0,
        priority: "medium",
        deadline: toDeadlineIso(t.deadline),
        description,
        assignee_id: t.assignee_id || null,
        creator_id: creatorTmId,
        project_id: projectId,
        parent_id: parentTaskId,
        owner_id: user!.id,
      })
      .select("id")
      .single();
    if (error) throw error;
    // Добавим наблюдателя, если выбран
    if (t.watcher_id) {
      await supabase.from("task_members").insert({
        task_id: data.id as string,
        team_member_id: t.watcher_id,
        role: "auditor" as any,
        added_by: user!.id,
      });
    }
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
      const periodDatesError = getTaskDateError({
        startDate: vars.start_date,
        deadline: vars.end_date,
        projectDeadline: project?.deadline || null,
      });
      if (periodDatesError) throw new Error(periodDatesError);

      // 1) Главная CRM-задача периода
      const { data: parentTask, error: ptErr } = await supabase
        .from("crm_tasks")
        .insert({
          title: vars.title,
          stage: "В работе",
          stage_color: "#f59e0b",
          priority: "medium",
          deadline: toDeadlineIso(vars.end_date),
          project_id: projectId,
          owner_id: user!.id,
        })
        .select("id")
        .single();
      if (ptErr) throw ptErr;

      // 2) Сам период со ссылкой на главную задачу
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
          crm_task_id: parentTask.id,
        })
        .select().single();
      if (error) throw error;

      // 3) Пункты периода → дочерние CRM-задачи (видны во вкладке «Задачи»)
      if (vars.tasks.length > 0) {
        const rows: any[] = [];
        for (let i = 0; i < vars.tasks.length; i++) {
          const t = vars.tasks[i];
          const taskDatesError = getTaskDateError({
            startDate: (t as any).start_date,
            deadline: t.deadline,
            periodStart: vars.start_date,
            periodEnd: vars.end_date,
            projectDeadline: project?.deadline || null,
          });
          if (taskDatesError) throw new Error(`Задача «${t.title || `#${i + 1}`}»: ${taskDatesError}`);
          const childId = await createChildCrmTaskFor(parentTask.id, t);
          rows.push({
            period_id: p.id,
            title: t.title!,
            category: t.category || "general",
            assignee_id: t.assignee_id || null,
            deadline: toDateOnly(t.deadline),
            required: t.required || false,
            sort_order: i,
            crm_task_id: childId,
            week_number: (t as any).week_number ?? null,
            week_start: (t as any).week_start ?? null,
            week_end: (t as any).week_end ?? null,
          });
        }
        const { error: te } = await supabase.from("period_tasks").insert(rows);
        if (te) throw te;
      }
      return p as Period;
    },
    onSuccess: (p) => {
      qc.invalidateQueries({ queryKey: ["project-periods", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      setSelectedPeriodId(p.id);
      setCreateOpen(false);
      toast.success(`Период «${p.title}» создан`);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка создания периода"),
  });

  // Гарантирует наличие главной CRM-задачи у периода и синхронизирует её title/deadline с полями периода
  const ensurePeriodParentTask = async (period: Period): Promise<string> => {
    const deadlineIso = toDeadlineIso(period.end_date);
    if (period.crm_task_id) {
      // Всегда подтягиваем актуальные title и deadline периода в главную CRM-задачу
      await supabase
        .from("crm_tasks")
        .update({ title: period.title, deadline: deadlineIso })
        .eq("id", period.crm_task_id);
      return period.crm_task_id;
    }
    const { data: parentTask, error: ptErr } = await supabase
      .from("crm_tasks")
      .insert({
        title: period.title,
        stage: "В работе",
        stage_color: "#f59e0b",
        priority: "medium",
        deadline: deadlineIso,
        project_id: projectId,
        owner_id: user!.id,
      })
      .select("id")
      .single();
    if (ptErr) throw ptErr;
    const { error: upErr } = await supabase
      .from("project_periods")
      .update({ crm_task_id: parentTask.id })
      .eq("id", period.id);
    if (upErr) throw upErr;
    return parentTask.id as string;
  };

  // Пересчитывает stage главной CRM-задачи периода по состоянию дочерних задач
  const syncMainTaskStage = async (parentTaskId: string) => {
    const { data: children } = await supabase
      .from("crm_tasks")
      .select("stage")
      .eq("parent_id", parentTaskId);
    const list = children || [];
    const allDone = list.length > 0 && list.every((c: any) => c.stage === "Завершена" || c.stage === "Принята");
    const stage = allDone ? "Завершена" : "В работе";
    const stage_color = allDone ? "#10b981" : "#f59e0b";
    const stage_progress = allDone ? 100 : 50;
    await supabase
      .from("crm_tasks")
      .update({ stage, stage_color, stage_progress })
      .eq("id", parentTaskId);
  };

  const addTask = useMutation({
    mutationFn: async (vars: Partial<PeriodTask>) => {
      if (!activePeriod) throw new Error("Период не выбран");
      const taskDatesError = getTaskDateError({
        startDate: (vars as any).start_date,
        deadline: vars.deadline,
        periodStart: activePeriod.start_date,
        periodEnd: activePeriod.end_date,
        projectDeadline: project?.deadline || null,
      });
      if (taskDatesError) throw new Error(taskDatesError);
      const parentId = await ensurePeriodParentTask(activePeriod);
      const sort_order = tasks.length;
      const childId = await createChildCrmTaskFor(parentId, vars);
      const { error } = await supabase.from("period_tasks").insert({
        period_id: activePeriod.id,
        title: vars.title!,
        category: vars.category || "general",
        assignee_id: vars.assignee_id || null,
        deadline: toDateOnly(vars.deadline),
        required: vars.required || false,
        sort_order,
        crm_task_id: childId,
        week_number: vars.week_number ?? null,
        week_start: vars.week_start ?? null,
        week_end: vars.week_end ?? null,
      });
      if (error) throw error;
      await syncMainTaskStage(parentId);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-periods", projectId] });
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      toast.success("Задача добавлена в период и в проект");
    },
    onError: (e: any) => toast.error(e.message || "Ошибка создания задачи"),
  });

  const updateTask = useMutation({
    mutationFn: async (vars: { id: string; patch: Partial<PeriodTask> }) => {
      const row = tasks.find((t) => t.id === vars.id);
      const taskDatesError = getTaskDateError({
        deadline: "deadline" in vars.patch ? vars.patch.deadline : row?.deadline,
        periodStart: activePeriod?.start_date,
        periodEnd: activePeriod?.end_date,
        projectDeadline: project?.deadline || null,
      });
      if (taskDatesError) throw new Error(taskDatesError);

      const { error } = await supabase.from("period_tasks").update(vars.patch).eq("id", vars.id);
      if (error) throw error;
      // Синхронизация со связанной CRM-задачей
      if (row?.crm_task_id) {
        const subPatch: any = {};
        if ("title" in vars.patch) subPatch.title = vars.patch.title;
        if ("assignee_id" in vars.patch) subPatch.assignee_id = vars.patch.assignee_id;
        if ("deadline" in vars.patch)
          subPatch.deadline = toDeadlineIso(vars.patch.deadline as string | null | undefined);
        if ("completed" in vars.patch) {
          subPatch.stage = vars.patch.completed ? "Завершена" : "Новые";
          subPatch.stage_color = vars.patch.completed ? "#10b981" : "#3b82f6";
          subPatch.stage_progress = vars.patch.completed ? 100 : 0;
        }
        if (Object.keys(subPatch).length > 0) {
          await supabase.from("crm_tasks").update(subPatch).eq("id", row.crm_task_id);
        }
      }
      if ("completed" in vars.patch && activePeriod?.crm_task_id) {
        await syncMainTaskStage(activePeriod.crm_task_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
    },
  });

  const deleteTasks = useMutation({
    mutationFn: async (ids: string[]) => {
      const childIds = tasks.filter((t) => ids.includes(t.id) && t.crm_task_id).map((t) => t.crm_task_id!) as string[];
      const { error } = await supabase.from("period_tasks").delete().in("id", ids);
      if (error) throw error;
      if (childIds.length > 0) {
        await supabase.from("crm_tasks").delete().in("id", childIds);
      }
      if (activePeriod?.crm_task_id) {
        await syncMainTaskStage(activePeriod.crm_task_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      setSelectedTaskIds(new Set());
      toast.success("Задачи удалены");
    },
    onError: (e: any) => toast.error(e?.message || "Не удалось удалить задачи"),
  });

  const deletePeriod = useMutation({
    mutationFn: async (id: string) => {
      const period = periods.find((p) => p.id === id);
      // Удаляем дочерние CRM-задачи периода и саму главную задачу
      if (period?.crm_task_id) {
        await supabase.from("crm_tasks").delete().eq("parent_id", period.crm_task_id);
        await supabase.from("crm_tasks").delete().eq("id", period.crm_task_id);
      }
      const { error } = await supabase.from("project_periods").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-periods", projectId] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
      qc.invalidateQueries({ queryKey: ["crm-tasks"] });
      setSelectedPeriodId(null);
      toast.success("Период удалён");
    },
    onError: (e: any) => toast.error(e?.message || "Не удалось удалить период"),
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
      if ("deadline" in vars.patch) {
        const taskDatesError = getTaskDateError({
          deadline: vars.patch.deadline,
          periodStart: activePeriod?.start_date,
          periodEnd: activePeriod?.end_date,
          projectDeadline: project?.deadline || null,
        });
        if (taskDatesError) throw new Error(taskDatesError);
      }

      const { error } = await supabase.from("period_tasks").update(vars.patch).in("id", vars.ids);
      if (error) throw error;
      const childIds = tasks.filter((t) => vars.ids.includes(t.id) && t.crm_task_id).map((t) => t.crm_task_id!) as string[];
      if (childIds.length > 0) {
        const subPatch: any = {};
        if ("assignee_id" in vars.patch) subPatch.assignee_id = vars.patch.assignee_id;
        if ("deadline" in vars.patch)
          subPatch.deadline = toDeadlineIso(vars.patch.deadline as string | null | undefined);
        if ("completed" in vars.patch) {
          subPatch.stage = vars.patch.completed ? "Завершена" : "Новые";
          subPatch.stage_color = vars.patch.completed ? "#10b981" : "#3b82f6";
          subPatch.stage_progress = vars.patch.completed ? 100 : 0;
        }
        if (Object.keys(subPatch).length > 0) {
          await supabase.from("crm_tasks").update(subPatch).in("id", childIds);
        }
      }
      if ("completed" in vars.patch && activePeriod?.crm_task_id) {
        await syncMainTaskStage(activePeriod.crm_task_id);
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["period-tasks", activePeriod?.id] });
      qc.invalidateQueries({ queryKey: ["project-tasks", projectId] });
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

  // Авто-создание черновиков недельных отчётов из задач периода.
  // Группируем задачи по неделям (week_start/week_end или по deadline) и создаём по одному
  // weekly_reports на каждую неделю, у которой есть задачи. Существующие отчёты не пересоздаём.
  const generatePlans = useMutation({
    mutationFn: async () => {
      if (!activePeriod?.start_date || !activePeriod?.end_date) {
        throw new Error("У периода не указаны даты");
      }
      const weeks = generateWeeksInRange(activePeriod.start_date, activePeriod.end_date);
      if (weeks.length === 0) throw new Error("Не удалось рассчитать недели периода");

      // Раскладываем задачи периода по неделям
      const buckets = new Map<string, { week: WeekOption; items: PeriodTask[] }>();
      for (const t of tasks) {
        let week: WeekOption | null = null;
        if (t.week_start && t.week_end) {
          week = weeks.find((w) => w.start === t.week_start.slice(0, 10)) || null;
        }
        if (!week && t.deadline) week = findWeekForDate(weeks, t.deadline);
        if (!week) continue;
        const key = `${week.week_year}-${week.week_number}`;
        if (!buckets.has(key)) buckets.set(key, { week, items: [] });
        buckets.get(key)!.items.push(t);
      }

      if (buckets.size === 0) {
        throw new Error("Ни у одной задачи нет недели или дедлайна — нечего распределять");
      }

      // Тянем уже существующие отчёты, чтобы не создавать дубликаты
      const { data: existing } = await supabase
        .from("weekly_reports")
        .select("id, week_number, week_year")
        .eq("project_id", projectId);
      const existingKeys = new Set((existing || []).map((r) => `${r.week_year}-${r.week_number}`));

      let created = 0;
      for (const [key, bucket] of buckets) {
        if (existingKeys.has(key)) continue;
        const planned_items = bucket.items.map((t) => ({
          id: t.id,
          title: t.title,
          source: "crm_task" as const,
          hidden: false,
        }));
        const { error } = await supabase.from("weekly_reports").insert({
          project_id: projectId,
          period_id: activePeriod.id,
          week_number: bucket.week.week_number,
          week_year: bucket.week.week_year,
          week_start: bucket.week.start,
          week_end: bucket.week.end,
          status: "draft",
          planned_items,
          done_items: [],
          metrics: { positions_text: "", traffic_text: "" },
          manager_comment: "",
          created_by: user!.id,
        });
        if (!error) created++;
      }
      return { created, totalWeeks: buckets.size };
    },
    onSuccess: ({ created, totalWeeks }) => {
      qc.invalidateQueries({ queryKey: ["weekly-reports", projectId] });
      if (created === 0) {
        toast.info(`Все ${totalWeeks} недельных плана уже созданы`);
      } else {
        toast.success(`Создано ${created} недельн${created === 1 ? "ый план" : created < 5 ? "ых плана" : "ых планов"}`);
      }
    },
    onError: (e: any) => toast.error(e.message || "Не удалось создать недельные планы"),
  });


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
            <div
              key={p.id}
              className={cn(
                "group w-full flex items-stretch rounded-lg border transition-all overflow-hidden",
                activePeriod?.id === p.id
                  ? "border-primary bg-primary/5"
                  : "border-border/60 hover:border-border bg-card",
              )}
            >
              <button
                onClick={() => setSelectedPeriodId(p.id)}
                className="flex-1 text-left px-3 py-2.5"
              >
                <div className="text-sm font-medium">{p.title}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  {p.status === "active" ? "Активный" : "Завершён"}
                </div>
              </button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-auto w-8 rounded-none text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Удалить период «{p.title}»?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Все задачи периода также будут удалены. Действие необратимо.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>Отмена</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => deletePeriod.mutate(p.id)}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      Удалить
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
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
            onDeleteTask={(id) => deleteTasks.mutate([id])}
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
        projectDeadline={project?.deadline || null}
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
  onDeleteTask: (id: string) => void;
  onDeleteSelected: () => void;
  onBulkUpdate: (patch: Partial<PeriodTask>) => void;
  sensors: ReturnType<typeof useSensors>;
  onDragEnd: (e: DragEndEvent) => void;
}) {
  const { period, tasks, members, selectedIds } = props;
  const [newTitle, setNewTitle] = useState("");
  const [newAssignee, setNewAssignee] = useState<string>("none");
  const [newWatcher, setNewWatcher] = useState<string>("none");
  const [newStartDate, setNewStartDate] = useState<string>("");
  const [newDeadline, setNewDeadline] = useState<string>("");
  const [newCategory, setNewCategory] = useState<string>("general");
  const [newRequired, setNewRequired] = useState(false);
  const completed = tasks.filter((t) => t.completed).length;

  const handleQuickAdd = () => {
    const title = newTitle.trim();
    if (!title) return;
    const taskDatesError = getTaskDateError({
      startDate: newStartDate || null,
      deadline: newDeadline || null,
      periodStart: period.start_date,
      periodEnd: period.end_date,
    });
    if (taskDatesError) {
      toast.error(taskDatesError);
      return;
    }
    props.onAddTask({
      title,
      assignee_id: newAssignee === "none" ? null : newAssignee,
      deadline: newDeadline || null,
      category: newCategory,
      required: newRequired,
      // extras для пробрасывания в CRM-задачу
      ...( { start_date: newStartDate || null, watcher_id: newWatcher === "none" ? null : newWatcher } as any ),
    });
    setNewTitle("");
    setNewAssignee("none");
    setNewWatcher("none");
    setNewStartDate("");
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
            {period.start_date && period.end_date && (
              <>
                {format(new Date(period.start_date), "d MMM", { locale: ru })} — {format(new Date(period.end_date), "d MMM yyyy", { locale: ru })} · {" "}
              </>
            )}
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
                onDelete={() => props.onDeleteTask(t.id)}
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Исполнитель</Label>
            <Select value={newAssignee} onValueChange={setNewAssignee}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Не назначен" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Наблюдатель</Label>
            <Select value={newWatcher} onValueChange={setNewWatcher}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder="Не назначен" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Не назначен</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Категория</Label>
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
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Дата начала</Label>
            <Input
              type="date"
              value={newStartDate}
              onChange={(e) => setNewStartDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
          <div className="space-y-1">
            <Label className="text-[10px] text-muted-foreground">Срок выполнения</Label>
            <Input
              type="date"
              value={newDeadline}
              onChange={(e) => setNewDeadline(e.target.value)}
              className="h-9 text-xs"
            />
          </div>
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
      <DeleteButton
        entityName={task.title}
        entityLabel="задачу"
        onConfirm={async () => props.onDelete()}
        className="shrink-0"
      />
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
  projectDeadline: string | null;
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
  const getInitialDates = () => {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().slice(0, 10);
    const projectDeadline = props.projectDeadline?.slice(0, 10) || null;

    if (!projectDeadline) {
      return { start: today, end: monthEnd };
    }

    if (today > projectDeadline) {
      return { start: projectDeadline, end: projectDeadline };
    }

    return {
      start: today,
      end: monthEnd > projectDeadline ? projectDeadline : monthEnd,
    };
  };

  const initialDates = getInitialDates();
  const [step, setStep] = useState<"select" | "build">("select");
  const [mode, setMode] = useState<CreateMode>("template");
  const [startDate, setStartDate] = useState(initialDates.start);
  const [endDate, setEndDate] = useState(initialDates.end);
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
    const dates = getInitialDates();
    setStep("select");
    setMode("template");
    setStartDate(dates.start);
    setEndDate(dates.end);
    setTitle("");
    setTemplateTasks([]);
    setListText("");
    setManualTasks([]);
    setCopyFromId("");
    setCopyTasks([]);
  };

  const handleNext = async () => {
    const periodDatesError = getTaskDateError({
      startDate,
      deadline: endDate,
      projectDeadline: props.projectDeadline,
    });
    if (periodDatesError) {
      toast.error(periodDatesError);
      return;
    }
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
    const periodDatesError = getTaskDateError({
      startDate,
      deadline: endDate,
      projectDeadline: props.projectDeadline,
    });
    if (periodDatesError) {
      toast.error(periodDatesError);
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
