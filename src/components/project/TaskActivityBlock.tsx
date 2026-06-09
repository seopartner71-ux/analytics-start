import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { History } from "lucide-react";

const ACTION_LABELS: Record<string, string> = {
  stage_changed: "изменил статус",
  assignee_changed: "изменил исполнителя",
  deadline_changed: "изменил дедлайн",
  priority_changed: "изменил приоритет",
};

function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return "только что";
  if (diff < 3600) return `${Math.floor(diff / 60)} мин назад`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ч назад`;
  return new Date(iso).toLocaleDateString("ru-RU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function formatValue(field: string | null, val: string | null, members: any[]) {
  if (!val) return "—";
  if (field === "assignee_id") {
    const m = members.find((x) => x.id === val);
    return m?.full_name || "—";
  }
  if (field === "deadline") {
    return new Date(val).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" });
  }
  return val;
}

export function TaskActivityBlock({ taskId }: { taskId: string }) {
  const { data: log = [] } = useQuery({
    queryKey: ["task-activity", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_activity_log")
        .select("*")
        .eq("task_id", taskId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      return data ?? [];
    },
    refetchInterval: 30_000,
  });

  const userIds = Array.from(new Set(log.map((l: any) => l.user_id).filter(Boolean)));
  const memberIds = Array.from(
    new Set(log.filter((l: any) => l.field_name === "assignee_id").flatMap((l: any) => [l.old_value, l.new_value]).filter(Boolean))
  );

  const { data: users = [] } = useQuery({
    queryKey: ["activity-users", userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("owner_id, full_name").in("owner_id", userIds);
      return data ?? [];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["activity-members", memberIds],
    enabled: memberIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name").in("id", memberIds);
      return data ?? [];
    },
  });

  return (
    <Card id="task-section-activity" className="bg-card shadow-sm border-border/60 rounded-xl scroll-mt-4">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">История изменений</span>
          <span className="text-xs text-muted-foreground">({log.length})</span>
        </div>
        {log.length === 0 ? (
          <div className="text-center py-3 text-xs text-muted-foreground/60">Изменений ещё не было</div>
        ) : (
          <div className="space-y-1.5">
            {log.map((l: any) => {
              const author = users.find((u: any) => u.owner_id === l.user_id)?.full_name || "Система";
              const action = ACTION_LABELS[l.action] || l.action;
              return (
                <div key={l.id} className="flex items-baseline gap-2 text-xs py-1.5 px-2 rounded hover:bg-muted/30">
                  <span className="font-medium text-foreground">{author}</span>
                  <span className="text-muted-foreground">{action}:</span>
                  <span className="text-muted-foreground line-through">{formatValue(l.field_name, l.old_value, members)}</span>
                  <span className="text-muted-foreground">→</span>
                  <span className="text-foreground font-medium">{formatValue(l.field_name, l.new_value, members)}</span>
                  <span className="ml-auto text-muted-foreground/60 text-2xs">{formatRelative(l.created_at)}</span>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
