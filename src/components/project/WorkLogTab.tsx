import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, GripVertical, CheckCircle2, Circle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { ArtifactCard } from "./ArtifactCard";
import type { Tables } from "@/integrations/supabase/types";

interface WorkLogTabProps {
  projectId: string;
  tasks: Tables<"work_logs">[];
  isAdmin: boolean;
}

export function WorkLogTab({ projectId, tasks, isAdmin }: WorkLogTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [newText, setNewText] = useState("");
  const [newLink, setNewLink] = useState("");

  const addTask = useMutation({
    mutationFn: async () => {
      if (!newText.trim()) return;
      const { error } = await supabase.from("work_logs").insert({
        project_id: projectId,
        description: newText.trim(),
        link_url: newLink.trim() || null,
        status: "in_progress",
        sort_order: tasks.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work_logs", projectId] });
      setNewText("");
      setNewLink("");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleStatus = useMutation({
    mutationFn: async (task: Tables<"work_logs">) => {
      const { error } = await supabase.from("work_logs").update({
        status: task.status === "done" ? "in_progress" : "done",
      }).eq("id", task.id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work_logs", projectId] }),
  });

  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("work_logs").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["work_logs", projectId] }),
  });

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") addTask.mutate();
  };

  const grouped = tasks.reduce<Record<string, Tables<"work_logs">[]>>((acc, task) => {
    const d = new Date(task.task_date);
    const key = `${d.getFullYear()}-${d.getMonth()}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {isAdmin && (
        <div className="flex gap-2 flex-col sm:flex-row">
          <Input
            value={newText}
            onChange={(e) => setNewText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("project.worklog.placeholder")}
            className="flex-1 h-9"
          />
          <Input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("project.worklog.linkPlaceholder")}
            className="flex-1 sm:max-w-[260px] h-9"
          />
          <Button onClick={() => addTask.mutate()} size="sm" className="gap-2 shrink-0 h-9">
            <Plus className="h-3.5 w-3.5" />
            {t("project.worklog.addTask")}
          </Button>
        </div>
      )}

      {sortedKeys.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("project.worklog.noTasks")}</p>
      )}

      {sortedKeys.map((key) => {
        const [year, monthStr] = key.split("-");
        const label = `${t(`publicReport.months.${monthStr}`)} ${year}`;
        const doneCount = grouped[key].filter(t => t.status === "done").length;
        const totalCount = grouped[key].length;

        return (
          <div key={key} className="space-y-2">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
              <span className="text-xs text-muted-foreground">{doneCount}/{totalCount}</span>
            </div>
            <div className="space-y-1.5">
              {grouped[key].map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3 transition-all ${
                    task.status === "done" ? "opacity-60" : ""
                  }`}
                >
                  {isAdmin && <GripVertical className="h-4 w-4 text-muted-foreground/30 cursor-grab shrink-0" />}
                  <button
                    onClick={() => isAdmin && toggleStatus.mutate(task)}
                    disabled={!isAdmin}
                    className="shrink-0"
                  >
                    {task.status === "done" ? (
                      <CheckCircle2 className="h-4.5 w-4.5 text-success" />
                    ) : (
                      <Circle className="h-4.5 w-4.5 text-muted-foreground/40" />
                    )}
                  </button>
                  <span className={`flex-1 text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.description}
                  </span>
                  <span className="text-xs text-muted-foreground shrink-0">{task.task_date}</span>
                  <Badge
                    variant={task.status === "done" ? "default" : "secondary"}
                    className={`text-[10px] px-2 py-0.5 shrink-0 ${
                      task.status === "done"
                        ? "bg-success/10 text-success border-success/20 hover:bg-success/10"
                        : "bg-warning/10 text-warning border-warning/20 hover:bg-warning/10"
                    }`}
                  >
                    {task.status === "done" ? t("project.worklog.completed") : t("project.worklog.inProgress")}
                  </Badge>
                  {task.link_url && (
                    <ArtifactCard url={task.link_url} />
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deleteTask.mutate(task.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
