import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, ExternalLink, GripVertical } from "lucide-react";
import type { WorkTask } from "@/data/projects";

interface WorkLogTabProps {
  tasks: WorkTask[];
  onTasksChange: (tasks: WorkTask[]) => void;
}

export function WorkLogTab({ tasks, onTasksChange }: WorkLogTabProps) {
  const { t } = useTranslation();
  const [newText, setNewText] = useState("");
  const [newLink, setNewLink] = useState("");
  const [dragId, setDragId] = useState<string | null>(null);

  const handleAdd = () => {
    if (!newText.trim()) return;
    const now = new Date();
    const task: WorkTask = {
      id: String(Date.now()),
      text: newText.trim(),
      link: newLink.trim(),
      done: false,
      month: now.getMonth(),
      year: now.getFullYear(),
      createdAt: Date.now(),
    };
    onTasksChange([...tasks, task]);
    setNewText("");
    setNewLink("");
  };

  const handleToggle = (id: string) => {
    onTasksChange(tasks.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
  };

  const handleDelete = (id: string) => {
    onTasksChange(tasks.filter((t) => t.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleAdd();
  };

  // Group by month/year
  const grouped = tasks.reduce<Record<string, WorkTask[]>>((acc, task) => {
    const key = `${task.year}-${task.month}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(task);
    return acc;
  }, {});

  const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  const monthNames: Record<string, string> = {};
  for (let i = 0; i < 12; i++) {
    monthNames[String(i)] = t(`publicReport.months.${i}`);
  }

  const handleDragStart = (id: string) => setDragId(id);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (targetId: string) => {
    if (!dragId || dragId === targetId) return;
    const updated = [...tasks];
    const fromIdx = updated.findIndex((t) => t.id === dragId);
    const toIdx = updated.findIndex((t) => t.id === targetId);
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    onTasksChange(updated);
    setDragId(null);
  };

  return (
    <div className="space-y-6">
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
        <Button onClick={handleAdd} className="gap-2 shrink-0">
          <Plus className="h-4 w-4" />
          {t("project.worklog.addTask")}
        </Button>
      </div>

      {sortedKeys.length === 0 && (
        <p className="text-center text-muted-foreground py-12">{t("project.worklog.noTasks")}</p>
      )}

      {sortedKeys.map((key) => {
        const [year, monthStr] = key.split("-");
        const label = `${monthNames[monthStr]} ${year}`;
        return (
          <div key={key} className="space-y-2">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">{label}</h3>
            <div className="space-y-1">
              {grouped[key].map((task) => (
                <div
                  key={task.id}
                  draggable
                  onDragStart={() => handleDragStart(task.id)}
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(task.id)}
                  className={`flex items-center gap-3 rounded-lg border border-border/60 bg-card px-3 py-2.5 transition-colors
                    ${dragId === task.id ? "opacity-50" : ""} ${task.done ? "opacity-70" : ""}`}
                >
                  <GripVertical className="h-4 w-4 text-muted-foreground/40 cursor-grab shrink-0" />
                  <Checkbox
                    checked={task.done}
                    onCheckedChange={() => handleToggle(task.id)}
                  />
                  <span className={`flex-1 text-sm ${task.done ? "line-through text-muted-foreground" : "text-foreground"}`}>
                    {task.text}
                  </span>
                  {task.link && (
                    <a href={task.link} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </Button>
                    </a>
                  )}
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(task.id)}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
