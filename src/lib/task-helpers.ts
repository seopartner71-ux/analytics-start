// Стадии задач с handoff
export const TASK_STAGES = [
  "Новые",
  "В работе",
  "На проверке",
  "Возвращена",
  "Принята",
  "Завершена",
] as const;

export type TaskStage = typeof TASK_STAGES[number];

export const STAGE_COLORS: Record<string, string> = {
  "Новые": "#3b82f6",
  "В работе": "#f59e0b",
  "На проверке": "#8b5cf6",
  "Возвращена": "#ef4444",
  "Принята": "#10b981",
  "Завершена": "#10b981",
  "Ждёт выполнения": "#8b5cf6", // legacy
};

export const STAGE_PROGRESS: Record<string, number> = {
  "Новые": 0,
  "В работе": 50,
  "На проверке": 80,
  "Возвращена": 40,
  "Принята": 100,
  "Завершена": 100,
};

export type DeadlineStatus = "none" | "ok" | "soon" | "overdue";

/**
 * Возвращает статус дедлайна:
 * - none: нет дедлайна или задача завершена/принята
 * - overdue: дедлайн прошёл
 * - soon: до дедлайна <= 3 дней
 * - ok: до дедлайна > 3 дней
 */
export function getDeadlineStatus(deadline: string | null | undefined, stage: string): DeadlineStatus {
  if (!deadline) return "none";
  if (stage === "Завершена" || stage === "Принята") return "none";
  const d = new Date(deadline).getTime();
  const now = Date.now();
  if (d < now) return "overdue";
  const days = (d - now) / 86400000;
  if (days <= 3) return "soon";
  return "ok";
}

export const DEADLINE_STYLES: Record<DeadlineStatus, { text: string; bg: string; label: string }> = {
  none: { text: "text-muted-foreground", bg: "", label: "" },
  ok: { text: "text-emerald-600 dark:text-emerald-400", bg: "bg-emerald-500/10", label: "В срок" },
  soon: { text: "text-amber-600 dark:text-amber-400", bg: "bg-amber-500/10", label: "Скоро" },
  overdue: { text: "text-destructive", bg: "bg-destructive/10", label: "Просрочено" },
};

export function formatDeadline(deadline: string): string {
  return new Date(deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

export function getDaysUntilDeadline(deadline: string): number {
  return Math.ceil((new Date(deadline).getTime() - Date.now()) / 86400000);
}

/**
 * Возвращает team_members.id текущего auth-пользователя.
 * Используется для записи creator_id в crm_tasks (постановщик задачи).
 * Логика: ищем запись team_members, где owner_id = auth user id ИЛИ email совпадает.
 */
export async function resolveCurrentTeamMemberId(
  supabase: any,
  userId: string,
  email?: string | null
): Promise<string | null> {
  // 1. По owner_id
  const { data: byOwner } = await supabase
    .from("team_members")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (byOwner?.id) return byOwner.id as string;
  // 2. По email
  if (email) {
    const { data: byEmail } = await supabase
      .from("team_members")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .maybeSingle();
    if (byEmail?.id) return byEmail.id as string;
  }
  return null;
}
