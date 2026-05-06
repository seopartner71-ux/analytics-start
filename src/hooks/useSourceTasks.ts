import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type TaskSourceType = "crawl_issue" | "webmaster" | "audit_check";

export interface SourceTaskRef {
  id: string;
  shortId: string;
  title: string;
  stage: string;
}

export function useSourceTasks(projectId: string, sourceType: TaskSourceType) {
  return useQuery({
    queryKey: ["source-tasks", projectId, sourceType],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, stage, source_id")
        .eq("project_id", projectId)
        .eq("source_type", sourceType)
        .is("archived_at", null);
      if (error) throw error;
      const map = new Map<string, SourceTaskRef>();
      for (const t of (data || []) as any[]) {
        if (!t.source_id) continue;
        map.set(String(t.source_id), {
          id: t.id,
          shortId: String(t.id).slice(0, 4).toUpperCase(),
          title: t.title,
          stage: t.stage,
        });
      }
      return map;
    },
  });
}
