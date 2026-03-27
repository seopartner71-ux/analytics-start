import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ExternalLink, GripVertical } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
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

  // Group by month
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
            className="flex-1"
          />
          <Input
            value={newLink}
            onChange={(e) => setNewLink(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("project.worklog.linkPlaceholder")}
            className="flex-1 sm:max-w-[260px]"
          />
          <Button onClick={() => addTask.mutate()} className="gap-2 shrink-0">
            <Plus className="h-4 w-4" />
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
        return (
          <div key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
            <div className="space-y-1">
              {grouped[key].map((task) => (
                <div
                  key={task.id}
                  className={`flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors ${task.status === "done" ? "opacity-70" : ""}`}
                >
                  {isAdmin && <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />}
                  <Checkbox
                    checked={task.status === "done"}
                    onCheckedChange={() => isAdmin && toggleStatus.mutate(task)}
                    disabled={!isAdmin}
                  />
                  <span className={`flex-1 text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.description}
                  </span>
                  <span className="text-xs text-muted-foreground">{task.task_date}</span>
                  {task.link_url && (
                    <a href={task.link_url} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  {isAdmin && (
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => deleteTask.mutate(task.id)}>
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
