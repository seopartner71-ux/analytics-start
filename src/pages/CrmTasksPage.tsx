import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, Clock, AlertTriangle, Send, List, LayoutGrid } from "lucide-react";
import { CRM_TASKS, CrmTask } from "@/data/crm-mock";

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

function TaskDetailSheet({ task, open, onClose }: { task: CrmTask | null; open: boolean; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  if (!task) return null;

  const deadlineDate = new Date(task.deadline);
  const now = new Date();
  const diffMs = deadlineDate.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  const overdueText = task.overdue
    ? `– ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "день" : Math.abs(diffDays) < 5 ? "дня" : "дней"}`
    : `${diffDays} ${diffDays === 1 ? "день" : diffDays < 5 ? "дня" : "дней"}`;

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[80vw] md:max-w-[80vw] p-0 overflow-hidden" side="right">
        <SheetHeader className="p-4 md:p-6 border-b border-border">
          <SheetTitle className="text-lg">{task.title}</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col md:flex-row h-[calc(100vh-80px)]">
          {/* Left/Top — Properties */}
          <div className="w-full md:w-[35%] border-b md:border-b-0 md:border-r border-border p-4 md:p-6 overflow-y-auto space-y-5">
            <PropRow label="Постановщик">
              <div className="flex items-center gap-2">
                <AvatarCircle initials={task.creator.avatar} className="h-7 w-7" />
                <span className="text-sm">{task.creator.name}</span>
              </div>
            </PropRow>
            <PropRow label="Исполнитель">
              <div className="flex items-center gap-2">
                <AvatarCircle initials={task.assignee.avatar} className="h-7 w-7" />
                <span className="text-sm">{task.assignee.name}</span>
              </div>
            </PropRow>
            <PropRow label="Крайний срок">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground" />
                <span className={`text-sm font-medium ${task.overdue ? "text-destructive" : "text-foreground"}`}>
                  {task.deadline}
                </span>
                {task.overdue && (
                  <Badge variant="destructive" className="text-[10px]">
                    <AlertTriangle className="h-3 w-3 mr-1" />{overdueText}
                  </Badge>
                )}
              </div>
            </PropRow>
            <PropRow label="Статус">
              <Badge style={{ backgroundColor: task.stageColor, color: "#fff" }} className="text-xs">{task.stage}</Badge>
            </PropRow>
            <PropRow label="Стадия">
              <div className="w-full">
                <Progress value={task.stageProgress} className="h-2" />
                <span className="text-xs text-muted-foreground mt-1 block">{task.stageProgress}%</span>
              </div>
            </PropRow>
            <PropRow label="Проект">
              <span className="text-sm">{task.projectName}</span>
            </PropRow>
            <PropRow label="Приоритет">
              <Badge variant={task.priority === "high" ? "destructive" : "secondary"} className="text-xs">
                {task.priority === "high" ? "Высокий" : task.priority === "medium" ? "Средний" : "Низкий"}
              </Badge>
            </PropRow>
            <PropRow label="Теги">
              <div className="flex flex-wrap gap-1">
                {task.tags.map(tag => (
                  <Badge key={tag} variant="outline" className="text-[10px]">{tag}</Badge>
                ))}
              </div>
            </PropRow>
          </div>

          {/* Right/Bottom — Chat */}
          <div className="flex-1 flex flex-col min-h-0">
            <div className="p-4 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">Чат задачи</h3>
              <p className="text-xs text-muted-foreground">{task.chatMessages.length} сообщений</p>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {task.chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-8">Нет сообщений</p>
              )}
              {task.chatMessages.map(m => (
                <div key={m.id} className={`flex gap-3 ${m.isSystem ? "justify-center" : ""}`}>
                  {m.isSystem ? (
                    <div className="bg-destructive/10 text-destructive text-xs px-3 py-2 rounded-lg max-w-md text-center">
                      {m.text}
                    </div>
                  ) : (
                    <>
                      <AvatarCircle initials={m.avatar} className="h-8 w-8 mt-0.5" />
                      <div className="flex-1">
                        <div className="flex items-baseline gap-2">
                          <span className="text-sm font-medium text-primary">{m.author}</span>
                          <span className="text-[10px] text-muted-foreground">{m.date}</span>
                        </div>
                        <p className="text-sm text-foreground mt-1 bg-muted/30 rounded-lg p-3">{m.text}</p>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
            <div className="p-4 border-t border-border">
              <div className="flex gap-2">
                <Input placeholder="Написать сообщение..." value={msg} onChange={e => setMsg(e.target.value)} className="flex-1 h-9" />
                <Button size="sm" className="h-9 px-3">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function PropRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  );
}

// Kanban view
function KanbanView({ tasks, onSelect }: { tasks: CrmTask[]; onSelect: (t: CrmTask) => void }) {
  const stages = ["Новые", "В работе", "Ждёт выполнения", "Завершена"];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stages.map(stage => {
        const stageTasks = tasks.filter(t => t.stage === stage);
        const color = stageTasks[0]?.stageColor || "hsl(var(--muted))";
        return (
          <div key={stage} className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b-2" style={{ borderColor: color }}>
              <span className="text-sm font-semibold text-foreground">{stage}</span>
              <Badge variant="secondary" className="text-[10px]">{stageTasks.length}</Badge>
            </div>
            {stageTasks.map(t => (
              <Card key={t.id} className="cursor-pointer hover:border-primary/30 transition-colors" onClick={() => onSelect(t)}>
                <CardContent className="p-3 space-y-2">
                  <p className="text-sm font-medium text-foreground line-clamp-2">{t.title}</p>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs ${t.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {t.overdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                      {t.deadline}
                    </span>
                    <AvatarCircle initials={t.assignee.avatar} className="h-6 w-6 text-[10px]" />
                  </div>
                  <Progress value={t.stageProgress} className="h-1.5" />
                </CardContent>
              </Card>
            ))}
          </div>
        );
      })}
    </div>
  );
}

export default function CrmTasksPage() {
  const [search, setSearch] = useState("");
  const [selectedTask, setSelectedTask] = useState<CrmTask | null>(null);
  const [view, setView] = useState<"list" | "kanban">("list");
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const filtered = CRM_TASKS.filter(t =>
    t.title.toLowerCase().includes(search.toLowerCase()) ||
    t.assignee.name.toLowerCase().includes(search.toLowerCase()) ||
    t.projectName.toLowerCase().includes(search.toLowerCase())
  );

  const overdueCount = CRM_TASKS.filter(t => t.overdue).length;

  const toggle = (id: string) => {
    const s = new Set(selected);
    s.has(id) ? s.delete(id) : s.add(id);
    setSelected(s);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Задачи</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">Всего: {CRM_TASKS.length}</p>
            {overdueCount > 0 && (
              <Badge variant="destructive" className="text-xs">{overdueCount} просрочены</Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск задачи..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <div className="flex border border-border rounded-md">
            <Button variant={view === "list" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("list")}><List className="h-4 w-4" /></Button>
            <Button variant={view === "kanban" ? "secondary" : "ghost"} size="icon" className="h-9 w-9" onClick={() => setView("kanban")}><LayoutGrid className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Создать</Button>
        </div>
      </div>

      {view === "kanban" ? (
        <KanbanView tasks={filtered} onSelect={setSelectedTask} />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border">
          <table className="w-full min-w-[800px]">
            <thead>
              <tr className="border-b border-border bg-muted/30">
                <th className="w-10 p-3"><Checkbox /></th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Название</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Стадия канбана</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Крайний срок</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Постановщик</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Исполнитель</th>
                <th className="text-left text-xs font-medium text-muted-foreground p-3">Проект</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(t => (
                <tr key={t.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors" onClick={() => setSelectedTask(t)}>
                  <td className="p-3" onClick={e => e.stopPropagation()}>
                    <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                  </td>
                  <td className="p-3">
                    <p className="text-sm font-medium text-foreground">{t.title}</p>
                  </td>
                  <td className="p-3">
                    <div className="space-y-1">
                      <Progress value={t.stageProgress} className="h-2 w-24" style={{ "--progress-color": t.stageColor } as any} />
                      <span className="text-xs text-muted-foreground">{t.stage}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <span className={`text-sm ${t.overdue ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {t.deadline}
                    </span>
                    {t.overdue && <Badge variant="destructive" className="text-[9px] ml-2">просрочена</Badge>}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <AvatarCircle initials={t.creator.avatar} className="h-6 w-6 text-[10px]" />
                      <span className="text-sm">{t.creator.name}</span>
                    </div>
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      <AvatarCircle initials={t.assignee.avatar} className="h-6 w-6 text-[10px]" />
                      <span className="text-sm">{t.assignee.name}</span>
                    </div>
                  </td>
                  <td className="p-3 text-sm text-muted-foreground">{t.projectName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selected.size > 0 && (
        <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
          <span className="text-sm text-muted-foreground">Отмечено: {selected.size} / {CRM_TASKS.length}</span>
          <Button variant="outline" size="sm">Применить</Button>
        </div>
      )}

      <TaskDetailSheet task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
