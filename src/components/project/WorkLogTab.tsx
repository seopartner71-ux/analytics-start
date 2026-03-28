import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose,
} from "@/components/ui/dialog";
import {
  Plus, Trash2, CheckCircle2, Circle, ExternalLink,
  Search as SearchIcon, Filter, FileText, Link2, Code, Megaphone,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

const CATEGORIES = ["seo", "tech", "content", "links"] as const;
type Category = (typeof CATEGORIES)[number];

const categoryMeta: Record<Category, { icon: React.ElementType; colorClass: string }> = {
  seo: { icon: SearchIcon, colorClass: "bg-primary/10 text-primary border-primary/20" },
  tech: { icon: Code, colorClass: "bg-orange-500/10 text-orange-600 border-orange-500/20 dark:text-orange-400" },
  content: { icon: FileText, colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400" },
  links: { icon: Link2, colorClass: "bg-violet-500/10 text-violet-600 border-violet-500/20 dark:text-violet-400" },
};

interface WorkLogTabProps {
  projectId: string;
  tasks: Tables<"work_logs">[];
  isAdmin: boolean;
}

export function WorkLogTab({ projectId, tasks, isAdmin }: WorkLogTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [newLink, setNewLink] = useState("");
  const [newCategory, setNewCategory] = useState<Category>("seo");
  const [newDate, setNewDate] = useState(new Date().toISOString().slice(0, 10));
  const [filterCat, setFilterCat] = useState<Category | "all">("all");

  const resetForm = () => { setNewDesc(""); setNewLink(""); setNewCategory("seo"); setNewDate(new Date().toISOString().slice(0, 10)); };

  const addTask = useMutation({
    mutationFn: async () => {
      if (!newDesc.trim()) return;
      const { error } = await supabase.from("work_logs").insert({
        project_id: projectId,
        description: newDesc.trim(),
        link_url: newLink.trim() || null,
        category: newCategory,
        task_date: newDate,
        status: "in_progress",
        sort_order: tasks.length,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["work_logs", projectId] });
      resetForm();
      setDialogOpen(false);
      toast.success(t("project.worklog.taskAdded"));
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

  const filtered = filterCat === "all" ? tasks : tasks.filter(t => (t as any).category === filterCat);

  const grouped = filtered.reduce<Record<string, Tables<"work_logs">[]>>((acc, task) => {
    const d = new Date(task.task_date);
    const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});
  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const totalDone = tasks.filter(t => t.status === "done").length;

  return (
    <div className="space-y-6">
      {/* Header row */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">{t("project.worklog.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("project.worklog.summary", { total: tasks.length, done: totalDone })}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Category filter */}
          <div className="flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5 text-muted-foreground" />
            <div className="flex gap-1">
              <button
                onClick={() => setFilterCat("all")}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                  filterCat === "all" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                }`}
              >
                {t("project.worklog.allCategories")}
              </button>
              {CATEGORIES.map(cat => (
                <button
                  key={cat}
                  onClick={() => setFilterCat(cat)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                    filterCat === cat ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {t(`project.worklog.cat.${cat}`)}
                </button>
              ))}
            </div>
          </div>
          {isAdmin && (
            <Button onClick={() => setDialogOpen(true)} size="sm" className="gap-2 shrink-0">
              <Plus className="h-3.5 w-3.5" />
              {t("project.worklog.addEntry")}
            </Button>
          )}
        </div>
      </div>

      {/* Timeline */}
      {sortedKeys.length === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <FileText className="h-10 w-10 mx-auto mb-3 opacity-30" />
          <p>{t("project.worklog.noTasks")}</p>
        </div>
      )}

      {sortedKeys.map((key) => {
        const [year, monthStr] = key.split("-");
        const label = `${t(`publicReport.months.${monthStr}`)} ${year}`;
        const doneCount = grouped[key].filter(t => t.status === "done").length;
        const totalCount = grouped[key].length;

        return (
          <div key={key} className="space-y-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
              <span className="text-xs text-muted-foreground">{doneCount}/{totalCount}</span>
            </div>

            <div className="relative pl-6 border-l-2 border-border space-y-3">
              {grouped[key].map((task) => {
                const cat = ((task as any).category || "seo") as Category;
                const meta = categoryMeta[cat] || categoryMeta.seo;
                const Icon = meta.icon;

                return (
                  <div key={task.id} className="relative">
                    {/* Timeline dot */}
                    <div className={`absolute -left-[calc(1.5rem+5px)] top-3 h-2.5 w-2.5 rounded-full border-2 border-background ${
                      task.status === "done" ? "bg-emerald-500" : "bg-muted-foreground/40"
                    }`} />

                    <div className={`rounded-lg border border-border bg-card p-4 transition-all hover:shadow-sm ${
                      task.status === "done" ? "opacity-70" : ""
                    }`}>
                      <div className="flex items-start gap-3">
                        {/* Status toggle */}
                        <button
                          onClick={() => isAdmin && toggleStatus.mutate(task)}
                          disabled={!isAdmin}
                          className="shrink-0 mt-0.5"
                        >
                          {task.status === "done" ? (
                            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                          ) : (
                            <Circle className="h-5 w-5 text-muted-foreground/40" />
                          )}
                        </button>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <Badge variant="outline" className={`text-[10px] gap-1 px-2 py-0.5 ${meta.colorClass}`}>
                              <Icon className="h-3 w-3" />
                              {t(`project.worklog.cat.${cat}`)}
                            </Badge>
                            <span className="text-xs text-muted-foreground">{task.task_date}</span>
                            <Badge
                              variant="outline"
                              className={`text-[10px] px-2 py-0.5 ml-auto shrink-0 ${
                                task.status === "done"
                                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400"
                                  : "bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400"
                              }`}
                            >
                              {task.status === "done" ? t("project.worklog.completed") : t("project.worklog.inProgress")}
                            </Badge>
                          </div>
                          <p className={`text-sm ${task.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}`}>
                            {task.description}
                          </p>
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 shrink-0">
                          {task.link_url && (
                            <a
                              href={task.link_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-primary hover:underline px-2 py-1 rounded-md hover:bg-primary/5"
                            >
                              <ExternalLink className="h-3.5 w-3.5" />
                            </a>
                          )}
                          {isAdmin && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => deleteTask.mutate(task.id)}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}

      {/* Add entry dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("project.worklog.addEntry")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>{t("project.worklog.fieldDate")}</Label>
              <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-2">
              <Label>{t("project.worklog.fieldCategory")}</Label>
              <Select value={newCategory} onValueChange={(v) => setNewCategory(v as Category)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(cat => (
                    <SelectItem key={cat} value={cat}>
                      {t(`project.worklog.cat.${cat}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t("project.worklog.fieldDescription")}</Label>
              <Textarea
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
                placeholder={t("project.worklog.placeholder")}
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label>{t("project.worklog.fieldLink")}</Label>
              <Input
                value={newLink}
                onChange={(e) => setNewLink(e.target.value)}
                placeholder={t("project.worklog.linkPlaceholder")}
                className="h-9"
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="outline" size="sm">{t("common.cancel")}</Button>
            </DialogClose>
            <Button onClick={() => addTask.mutate()} size="sm" disabled={!newDesc.trim() || addTask.isPending}>
              {addTask.isPending ? t("common.loading") : t("project.worklog.addEntry")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
