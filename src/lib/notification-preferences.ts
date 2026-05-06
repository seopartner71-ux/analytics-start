import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_NOTIFICATION_SETTINGS: Record<string, boolean> = {
  task_assigned: true,
  task_status_changed: true,
  task_deadline_soon: true,
  task_overdue: true,
  task_any_change: false,
  task_comment: true,
  task_mention: true,
  project_new_task: true,
  project_any_event: false,
  audit_complete: true,
  weekly_report: false,
  new_employee: false,
  email_notifications: false,
};

const KIND_TO_KEY: Record<string, string> = {
  task_assigned: "task_assigned",
  task_status_changed: "task_status_changed",
  task_comment: "task_comment",
  task_mention: "task_mention",
  task_deadline: "task_deadline_soon",
  task_deadline_soon: "task_deadline_soon",
  task_overdue: "task_overdue",
  audit_complete: "audit_complete",
  weekly_report: "weekly_report",
  new_employee: "new_employee",
  project_new_task: "project_new_task",
};

export async function shouldNotify(userId: string, kind: string): Promise<boolean> {
  try {
    const { data } = await supabase
      .from("notification_settings" as any)
      .select("settings")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return true;
    const key = KIND_TO_KEY[kind];
    if (!key) return true;
    const settings = (data as any).settings as Record<string, boolean>;
    return settings?.[key] ?? true;
  } catch {
    return true;
  }
}
