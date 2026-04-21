import { supabase } from "@/integrations/supabase/client";

export type DeletionEntity =
  | "task"
  | "project"
  | "employee"
  | "client"
  | "invoice"
  | "expense"
  | "payment"
  | "report"
  | "knowledge_article"
  | "chat_message"
  | "onboarding"
  | "link"
  | "period"
  | "checklist_task";

interface LogParams {
  entityType: DeletionEntity;
  entityId?: string | null;
  entityName: string;
  context?: Record<string, any>;
  action?: "archive" | "hard_delete" | "restore";
}

/**
 * Записать факт удаления в журнал. Не критично если падает — глотаем ошибку.
 */
export async function logDeletion(params: LogParams) {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("user_id", user.id)
      .maybeSingle();

    await supabase.from("deletion_log").insert({
      actor_id: user.id,
      actor_email: prof?.email || user.email || "",
      actor_name: prof?.full_name || "",
      entity_type: params.entityType,
      entity_id: params.entityId ?? null,
      entity_name: params.entityName,
      context: params.context || {},
      action: params.action || "archive",
    });
  } catch (e) {
    console.warn("[deletion-log] failed", e);
  }
}
