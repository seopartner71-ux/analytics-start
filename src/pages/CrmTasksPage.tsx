import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Clock, AlertTriangle, Send, List, LayoutGrid, GripVertical, AlertCircle, ChevronDown, MessageSquare, Hash } from "lucide-react";
import { CRM_TASKS, CrmTask } from "@/data/crm-mock";
import { motion, AnimatePresence } from "framer-motion";

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

/* ─── Task Detail Sheet ─── */
function TaskDetailSheet({ task, open, onClose }: { task: CrmTask | null; open: boolean; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  if (!task) return null;

  const deadlineDate = new Date(task.deadline);
  const now = new Date();
  const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000);

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[85vw] md:max-w-[85vw] p-0 overflow-hidden" side="right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border bg-gradient-to-r from-primary/[0.03] to-transparent">
          <SheetTitle className="text-base font-bold text-foreground leading-tight tracking-tight">{task.title}</SheetTitle>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="outline" className="text-[10px] font-medium" style={{ borderColor: task.stageColor, color: task.stageColor }}>
              {task.stage}
            </Badge>
            <span className="text-[11px] text-muted-foreground">·</span>
            <span className="text-[11px] text-muted-foreground">{task.projectName}</span>
          </div>
        </div>

        <div className="flex flex-col md:flex-row h-[calc(100vh-80px)]">
          {/* LEFT: Properties */}
          <div className="w-full md:w-[42%] lg:w-[38%] border-b md:border-b-0 md:border-r border-border overflow-y-auto">
            <div className="p-5 space-y-0">
              <PropertyRow label="Постановщик">
                <div className="flex items-center gap-2.5">
                  <AvatarCircle initials={task.creator.avatar} className="h-8 w-8 avatar-ring" />
                  <span className="text-sm font-medium text-foreground">{task.creator.name}</span>
                </div>
              </PropertyRow>
              <PropertyRow label="Исполнитель">
                <div className="flex items-center gap-2.5">
                  <AvatarCircle initials={task.assignee.avatar} className="h-8 w-8 avatar-ring" />
                  <span className="text-sm font-medium text-foreground">{task.assignee.name}</span>
                </div>
              </PropertyRow>
              <PropertyRow label="Крайний срок">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={`text-sm font-medium ${task.overdue ? "text-destructive" : "text-foreground"}`}>
                    {deadlineDate.toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {task.overdue && (
                  <Badge className="mt-1.5 text-[10px] bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10">
                    Просрочена на {Math.abs(diffDays)} дн.
                  </Badge>
                )}
              </PropertyRow>
              <PropertyRow label="Статус">
                <Badge variant="outline" className="text-xs font-medium" style={{ borderColor: task.stageColor, color: task.stageColor }}>
                  {task.stage} <ChevronDown className="h-3 w-3 ml-1" />
                </Badge>
              </PropertyRow>
              <PropertyRow label="Дата создания">
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  14 января 12:38 / ID {task.id.replace("t", "264")}
                </span>
              </PropertyRow>

              <Separator className="my-3" />

              <PropertyRow label="Проект">
                <div className="flex items-center gap-2">
                  <div className="h-6 w-6 rounded-lg bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                    <span className="text-[8px] font-bold text-primary">{task.projectName.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <span className="text-sm font-medium text-foreground">{task.projectName}</span>
                </div>
              </PropertyRow>

              <PropertyRow label="Наблюдатели">
                <div className="flex items-center gap-2">
                  <AvatarCircle initials="АС" className="h-7 w-7 text-[10px]" />
                  <span className="text-sm text-foreground">Алиса Синицына</span>
                </div>
              </PropertyRow>

              <Separator className="my-3" />

              {/* Subtasks */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-foreground">Подзадачи</span>
                    <Badge variant="secondary" className="text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full">{task.tags.length}</Badge>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-muted-foreground hover:text-primary"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                {task.tags.map((tag) => (
                  <div key={tag} className="flex items-center justify-between py-2.5 border-b border-border/30 last:border-0 group">
                    <span className="text-sm text-primary cursor-pointer group-hover:underline">{tag}</span>
                    <div className="flex items-center gap-2">
                      <AvatarCircle initials={task.assignee.avatar} className="h-5 w-5 text-[8px]" />
                      <span className="text-[11px] text-muted-foreground">15 янв 23:59</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Chat */}
          <div className="flex-1 flex flex-col min-h-0 bg-muted/[0.03]">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-muted-foreground" />
                <h3 className="text-sm font-semibold text-foreground">Чат задачи</h3>
                <Badge variant="secondary" className="text-[10px] h-5">{task.chatMessages.length}</Badge>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {task.chatMessages.length === 0 && (
                <div className="text-center py-16">
                  <MessageSquare className="h-10 w-10 mx-auto mb-3 text-muted-foreground/20" />
                  <p className="text-sm text-muted-foreground">Нет сообщений. Начните обсуждение...</p>
                </div>
              )}
              {task.chatMessages.map((m, i) => {
                const prevDate = i > 0 ? task.chatMessages[i - 1].date.split(" ")[0] : "";
                const curDate = m.date.split(" ")[0];
                const showDateSep = curDate !== prevDate;

                return (
                  <motion.div
                    key={m.id}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05, duration: 0.25 }}
                  >
                    {showDateSep && (
                      <div className="flex items-center justify-center my-4">
                        <div className="h-px flex-1 bg-border/50" />
                        <Badge variant="secondary" className="text-[10px] px-3 py-0.5 font-medium mx-3">
                          {new Date(curDate).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                        </Badge>
                        <div className="h-px flex-1 bg-border/50" />
                      </div>
                    )}
                    {m.isSystem ? (
                      <div className="flex justify-center">
                        <div className="bg-destructive/8 text-destructive text-xs px-4 py-2.5 rounded-xl max-w-md text-center leading-relaxed border border-destructive/10">
                          {m.text}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3 group">
                        <AvatarCircle initials={m.avatar} className="h-9 w-9 mt-0.5 avatar-ring" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-primary">{m.author}</span>
                            <span className="text-[10px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{m.date.split(" ")[1]}</span>
                          </div>
                          <div className="bg-card rounded-2xl rounded-tl-md p-3.5 border border-border/50 shadow-sm">
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{m.text}</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            {/* Input */}
            <div className="px-5 py-3 border-t border-border bg-card/80 backdrop-blur-sm">
              <div className="flex gap-2">
                <Input
                  placeholder="Написать сообщение..."
                  value={msg}
                  onChange={e => setMsg(e.target.value)}
                  className="flex-1 h-10 bg-muted/30 border-border/60 focus:bg-card transition-colors"
                  onKeyDown={e => e.key === "Enter" && msg.trim() && setMsg("")}
                />
                <Button size="sm" className="h-10 px-4 shadow-sm" disabled={!msg.trim()}>
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

function PropertyRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-6 py-3 border-b border-border/30 last:border-0 group">
      <span className="text-[11px] text-muted-foreground w-28 shrink-0 pt-1 uppercase tracking-wider">{label}</span>
      <div className="flex-1">{children}</div>
    </div>
  );
}

/* ─── Kanban ─── */
function KanbanView({ tasks, onSelect }: { tasks: CrmTask[]; onSelect: (t: CrmTask) => void }) {
  const stages = ["Новые", "В работе", "Ждёт выполнения", "Завершена"];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {stages.map(stage => {
        const stageTasks = tasks.filter(t => t.stage === stage);
        const color = stageTasks[0]?.stageColor || "hsl(var(--muted-foreground))";
        return (
          <div key={stage} className="space-y-2.5">
            <div className="flex items-center gap-2 pb-2.5 border-b-2" style={{ borderColor: color }}>
              <span className="text-sm font-semibold text-foreground">{stage}</span>
              <Badge variant="secondary" className="text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full">{stageTasks.length}</Badge>
            </div>
            <AnimatePresence>
              {stageTasks.map((t, i) => (
                <motion.div
                  key={t.id}
                  initial={{ opacity: 0, scale: 0.97 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05, duration: 0.2 }}
                >
                  <Card className="cursor-pointer card-glow" onClick={() => onSelect(t)}>
                    <CardContent className="p-3.5 space-y-2.5">
                      <p className="text-sm font-medium text-foreground line-clamp-2 leading-snug">{t.title}</p>
                      <div className="flex items-center justify-between">
                        <span className={`text-[11px] ${t.overdue ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                          {t.overdue && <AlertTriangle className="h-3 w-3 inline mr-1" />}
                          {new Date(t.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}
                        </span>
                        <AvatarCircle initials={t.assignee.avatar} className="h-6 w-6 text-[10px]" />
                      </div>
                      <div className="w-full h-1.5 rounded-full overflow-hidden bg-muted">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.stageProgress}%`, backgroundColor: t.stageColor }} />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        );
      })}
    </div>
  );
}

/* ─── Main Tasks Page ─── */
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
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Задачи</h1>
          <Button size="sm" className="gap-1.5 h-8 shadow-sm">
            <Plus className="h-4 w-4" /> Создать
          </Button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск задачи..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm bg-muted/30 border-border/60 focus:bg-card transition-colors" />
        </div>
      </div>

      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        <Button
          variant={view === "list" ? "default" : "ghost"}
          size="sm"
          className="h-8 text-xs gap-1.5 rounded-b-none"
          onClick={() => setView("list")}
        >
          <List className="h-3.5 w-3.5" /> Список
        </Button>
        <Button
          variant={view === "kanban" ? "default" : "ghost"}
          size="sm"
          className="h-8 text-xs gap-1.5 rounded-b-none"
          onClick={() => setView("kanban")}
        >
          <LayoutGrid className="h-3.5 w-3.5" /> Канбан
        </Button>
        <div className="w-px h-5 bg-border mx-2" />
        {overdueCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
            <AlertCircle className="h-3 w-3" />{overdueCount} Просрочены
          </Badge>
        )}
        <Badge variant="secondary" className="text-[10px] h-5 ml-1">Все: {CRM_TASKS.length}</Badge>
      </div>

      {view === "kanban" ? (
        <KanbanView tasks={filtered} onSelect={setSelectedTask} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
            <table className="crm-table min-w-[900px]">
              <thead>
                <tr>
                  <th className="w-8"><Checkbox /></th>
                  <th className="w-8"></th>
                  <th>Название</th>
                  <th>Стадия</th>
                  <th>Крайний срок</th>
                  <th></th>
                  <th>Постановщик</th>
                  <th>Исполнитель</th>
                  <th>Проект</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filtered.map((t, idx) => {
                    const diffMs = new Date(t.deadline).getTime() - Date.now();
                    const diffD = Math.abs(Math.ceil(diffMs / 86400000));
                    const overdueText = t.overdue ? `– ${Math.ceil(diffD / 30)} мес.` : "";

                    return (
                      <motion.tr
                        key={t.id}
                        initial={{ opacity: 0, y: 4 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.03, duration: 0.2 }}
                        onClick={() => setSelectedTask(t)}
                      >
                        <td onClick={e => e.stopPropagation()}>
                          <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                        </td>
                        <td className="text-muted-foreground/20">
                          <GripVertical className="h-4 w-4" />
                        </td>
                        <td className="max-w-[280px]">
                          <p className="text-sm font-medium text-foreground leading-snug">{t.title}</p>
                        </td>
                        <td>
                          <div className="space-y-1">
                            <div className="w-24 h-2 rounded-full overflow-hidden bg-muted">
                              <div className="h-full rounded-full transition-all duration-500" style={{ width: `${t.stageProgress}%`, backgroundColor: t.stageColor }} />
                            </div>
                            <span className="text-[11px] text-muted-foreground">{t.stage}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-1.5">
                            {t.overdue && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                            <span className="text-sm text-muted-foreground">
                              {new Date(t.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}
                            </span>
                          </div>
                        </td>
                        <td>
                          {t.overdue && (
                            <Badge className="text-[10px] bg-destructive/10 text-destructive border-0 hover:bg-destructive/10 font-medium">
                              {overdueText}
                            </Badge>
                          )}
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <AvatarCircle initials={t.creator.avatar} className="h-7 w-7 text-[10px]" />
                            <span className="text-sm text-foreground">{t.creator.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <AvatarCircle initials={t.assignee.avatar} className="h-7 w-7 text-[10px]" />
                            <span className="text-sm text-foreground">{t.assignee.name}</span>
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center gap-2">
                            <div className="h-5 w-5 rounded-md bg-primary/10 flex items-center justify-center ring-1 ring-primary/10">
                              <span className="text-[7px] font-bold text-primary">{t.projectName.slice(0, 2).toUpperCase()}</span>
                            </div>
                            <span className="text-sm text-muted-foreground">{t.projectName}</span>
                          </div>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-4">
              <span>Отмечено: <span className="font-medium text-foreground">{selected.size}</span> / {CRM_TASKS.length}</span>
            </div>
            <div className="flex items-center gap-3">
              <select className="bg-muted/30 border border-border rounded-md px-3 py-1.5 text-xs text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30">
                <option>Выберите действие</option>
              </select>
              <Button size="sm" className="h-7 text-xs shadow-sm">Применить</Button>
            </div>
          </div>
        </>
      )}

      <TaskDetailSheet task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
