import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { Plus, Search, Clock, AlertTriangle, Send, List, LayoutGrid, GripVertical, AlertCircle, ChevronDown } from "lucide-react";
import { CRM_TASKS, CrmTask } from "@/data/crm-mock";

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

/* ─── Task Detail Sheet (Bitrix24-style split view) ─── */
function TaskDetailSheet({ task, open, onClose }: { task: CrmTask | null; open: boolean; onClose: () => void }) {
  const [msg, setMsg] = useState("");
  if (!task) return null;

  const deadlineDate = new Date(task.deadline);
  const now = new Date();
  const diffDays = Math.ceil((deadlineDate.getTime() - now.getTime()) / 86400000);
  const overdueLabel = task.overdue
    ? `– ${Math.abs(diffDays)} ${Math.abs(diffDays) === 1 ? "месяц" : Math.abs(diffDays) < 5 ? "месяца" : "месяцев"}`
    : "";

  return (
    <Sheet open={open} onOpenChange={onClose}>
      <SheetContent className="w-full md:w-[85vw] md:max-w-[85vw] p-0 overflow-hidden" side="right">
        {/* Header */}
        <div className="px-5 py-4 border-b border-border">
          <SheetTitle className="text-base font-semibold text-foreground leading-tight">{task.title}</SheetTitle>
          <p className="text-xs text-muted-foreground mt-1">Описание</p>
        </div>

        <div className="flex flex-col md:flex-row h-[calc(100vh-72px)]">
          {/* LEFT: Properties — like Bitrix24 */}
          <div className="w-full md:w-[45%] lg:w-[40%] border-b md:border-b-0 md:border-r border-border overflow-y-auto">
            <div className="p-5 space-y-0">
              {/* Property rows styled like Bitrix */}
              <PropertyRow label="Постановщик">
                <div className="flex items-center gap-2.5">
                  <AvatarCircle initials={task.creator.avatar} className="h-8 w-8" />
                  <span className="text-sm text-foreground">{task.creator.name}</span>
                </div>
              </PropertyRow>
              <PropertyRow label="Исполнитель">
                <div className="flex items-center gap-2.5">
                  <AvatarCircle initials={task.assignee.avatar} className="h-8 w-8" />
                  <span className="text-sm text-foreground">{task.assignee.name}</span>
                </div>
              </PropertyRow>
              <PropertyRow label="Крайний срок">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className={`text-sm font-medium ${task.overdue ? "text-destructive" : "text-foreground"}`}>
                    {new Date(task.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
                {task.overdue && (
                  <Badge className="mt-1.5 text-[10px] bg-destructive/10 text-destructive border-destructive/20 hover:bg-destructive/10">
                    Просрочена на {Math.abs(diffDays)} дн.
                  </Badge>
                )}
              </PropertyRow>
              <PropertyRow label="Статус">
                <div className="flex items-center gap-2">
                  <span className="text-sm">⏳</span>
                  <span className="text-sm text-foreground">{task.stage}</span>
                </div>
              </PropertyRow>
              <PropertyRow label="Дата создания">
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">📅 14 января 12:38 / ID {task.id.replace("t", "264")}</span>
                </div>
              </PropertyRow>

              <Separator className="my-3" />

              <PropertyRow label="Проект">
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 rounded bg-primary/20 flex items-center justify-center">
                    <span className="text-[8px] font-bold text-primary">{task.projectName.slice(0, 2).toUpperCase()}</span>
                  </div>
                  <span className="text-sm text-foreground">{task.projectName}</span>
                </div>
              </PropertyRow>
              <PropertyRow label="Стадия">
                <Badge variant="outline" className="text-xs border-primary/30 text-primary" style={{ borderColor: task.stageColor, color: task.stageColor }}>
                  {task.stage} <ChevronDown className="h-3 w-3 ml-1" />
                </Badge>
              </PropertyRow>

              <Separator className="my-3" />

              <PropertyRow label="Наблюдатели">
                <div className="flex items-center gap-2">
                  <AvatarCircle initials="АС" className="h-7 w-7 text-[10px]" />
                  <span className="text-sm text-foreground">Алиса Синицына</span>
                </div>
              </PropertyRow>

              <Separator className="my-3" />

              {/* Subtasks section */}
              <div className="pt-2">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">🔗</span>
                    <span className="text-sm font-medium text-foreground">Подзадачи: {task.tags.length}</span>
                  </div>
                  <Button variant="ghost" size="icon" className="h-6 w-6"><Plus className="h-3.5 w-3.5" /></Button>
                </div>
                {task.tags.map((tag, i) => (
                  <div key={tag} className="flex items-center justify-between py-2 border-b border-border/30 last:border-0">
                    <span className="text-sm text-primary cursor-pointer hover:underline">{tag}</span>
                    <div className="flex items-center gap-2">
                      <AvatarCircle initials={task.assignee.avatar} className="h-5 w-5 text-[8px]" />
                      <span className="text-xs text-muted-foreground">15 янв 23:59</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* RIGHT: Chat — Bitrix24-style messenger */}
          <div className="flex-1 flex flex-col min-h-0 bg-muted/10">
            <div className="px-5 py-3 border-b border-border flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold text-foreground">Чат задачи</h3>
                <p className="text-xs text-muted-foreground">{task.chatMessages.length} участника</p>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
              {task.chatMessages.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-12">Нет сообщений. Начните обсуждение...</p>
              )}
              {task.chatMessages.map((m, i) => {
                // Date separator
                const prevDate = i > 0 ? task.chatMessages[i - 1].date.split(" ")[0] : "";
                const curDate = m.date.split(" ")[0];
                const showDateSep = curDate !== prevDate;

                return (
                  <div key={m.id}>
                    {showDateSep && (
                      <div className="flex items-center justify-center my-3">
                        <Badge variant="secondary" className="text-[10px] px-3 py-0.5 font-medium">
                          {new Date(curDate).toLocaleDateString("ru-RU", { weekday: "long", day: "numeric", month: "long" })}
                        </Badge>
                      </div>
                    )}
                    {m.isSystem ? (
                      <div className="flex justify-center">
                        <div className="bg-destructive/10 text-destructive text-xs px-4 py-2 rounded-xl max-w-md text-center leading-relaxed">
                          {m.text}
                        </div>
                      </div>
                    ) : (
                      <div className="flex gap-3">
                        <AvatarCircle initials={m.avatar} className="h-9 w-9 mt-0.5" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-baseline gap-2 mb-1">
                            <span className="text-sm font-semibold text-primary">{m.author}</span>
                          </div>
                          <div className="bg-card rounded-xl rounded-tl-sm p-3 border border-border/50 shadow-sm">
                            <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{m.text}</p>
                          </div>
                          <span className="text-[10px] text-muted-foreground mt-1 block text-right">{m.date.split(" ")[1]}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Input — fixed at bottom */}
            <div className="px-5 py-3 border-t border-border bg-card/50">
              <div className="flex gap-2">
                <Input placeholder="Написать сообщение..." value={msg} onChange={e => setMsg(e.target.value)} className="flex-1 h-10 bg-muted/30" />
                <Button size="sm" className="h-10 px-4">
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
    <div className="flex items-start gap-6 py-3 border-b border-border/30 last:border-0">
      <span className="text-xs text-muted-foreground w-28 shrink-0 pt-1">{label}</span>
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
          <div key={stage} className="space-y-2">
            <div className="flex items-center gap-2 pb-2 border-b-2" style={{ borderColor: color }}>
              <span className="text-sm font-semibold text-foreground">{stage}</span>
              <Badge variant="secondary" className="text-[10px] h-5 min-w-5 flex items-center justify-center rounded-full">{stageTasks.length}</Badge>
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

/* ─── Main Tasks Page (Bitrix24-style) ─── */
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
      {/* Header bar — like Bitrix */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Задачи группы</h1>
          <Button size="sm" className="gap-1.5 h-8">
            <Plus className="h-4 w-4" /> Создать
          </Button>
          <Badge variant="secondary" className="text-xs">Все роли <span className="ml-1 bg-primary text-primary-foreground rounded-full h-4 min-w-4 inline-flex items-center justify-center text-[10px] px-1">{CRM_TASKS.length}</span></Badge>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="+ поиск" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
      </div>

      {/* Tab bar — Список | Канбан + counters */}
      <div className="flex items-center gap-1 border-b border-border pb-px overflow-x-auto">
        <Button variant={view === "list" ? "default" : "ghost"} size="sm" className="h-8 text-xs gap-1.5 rounded-b-none" onClick={() => setView("list")}>
          <List className="h-3.5 w-3.5" /> Список
        </Button>
        <Button variant={view === "kanban" ? "default" : "ghost"} size="sm" className="h-8 text-xs gap-1.5 rounded-b-none" onClick={() => setView("kanban")}>
          <LayoutGrid className="h-3.5 w-3.5" /> Канбан
        </Button>
        <div className="w-px h-5 bg-border mx-2" />
        {overdueCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5">
            <AlertCircle className="h-3 w-3 mr-1" />{overdueCount} Просрочены
          </Badge>
        )}
        <span className="text-xs text-muted-foreground ml-2">0 Комментарии</span>
      </div>

      {view === "kanban" ? (
        <KanbanView tasks={filtered} onSelect={setSelectedTask} />
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full min-w-[900px]">
              <thead>
                <tr className="border-b border-border bg-muted/20">
                  <th className="w-8 p-2.5"><Checkbox /></th>
                  <th className="w-8 p-2.5"></th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Название</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Стадия канбана</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Активность ↓</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Крайний срок</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Постановщик</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Исполнитель</th>
                  <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Проект</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map(t => {
                  const diffMs = new Date(t.deadline).getTime() - Date.now();
                  const diffD = Math.abs(Math.ceil(diffMs / 86400000));
                  const overdueText = t.overdue ? `– ${Math.ceil(diffD / 30)} ${Math.ceil(diffD / 30) === 1 ? "месяц" : "месяца"}` : "";

                  return (
                    <tr key={t.id} className="border-b border-border/40 hover:bg-muted/10 cursor-pointer transition-colors group" onClick={() => setSelectedTask(t)}>
                      <td className="p-2.5" onClick={e => e.stopPropagation()}>
                        <Checkbox checked={selected.has(t.id)} onCheckedChange={() => toggle(t.id)} />
                      </td>
                      <td className="p-2.5 text-muted-foreground/30">
                        <GripVertical className="h-4 w-4" />
                      </td>
                      <td className="p-2.5 max-w-[280px]">
                        <p className="text-sm font-medium text-foreground leading-snug">{t.title}</p>
                      </td>
                      <td className="p-2.5">
                        <div className="space-y-1">
                          <div className="w-24 h-2 rounded-full overflow-hidden bg-muted">
                            <div className="h-full rounded-full" style={{ width: `${t.stageProgress}%`, backgroundColor: t.stageColor }} />
                          </div>
                          <span className="text-[11px] text-muted-foreground">{t.stage}</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-1.5">
                          {t.overdue && <AlertCircle className="h-4 w-4 text-destructive shrink-0" />}
                          <span className="text-sm text-muted-foreground">
                            {new Date(t.deadline).toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}, {t.deadline.includes("T") ? "19:00" : "19:13"}
                          </span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        {t.overdue && (
                          <Badge className="text-[10px] bg-destructive/10 text-destructive border-0 hover:bg-destructive/10">
                            {overdueText}
                          </Badge>
                        )}
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <AvatarCircle initials={t.creator.avatar} className="h-7 w-7 text-[10px]" />
                          <span className="text-sm text-foreground">{t.creator.name}</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <AvatarCircle initials={t.assignee.avatar} className="h-7 w-7 text-[10px]" />
                          <span className="text-sm text-foreground">{t.assignee.name}</span>
                        </div>
                      </td>
                      <td className="p-2.5">
                        <div className="flex items-center gap-2">
                          <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center">
                            <span className="text-[7px] font-bold text-primary">{t.projectName.slice(0, 2).toUpperCase()}</span>
                          </div>
                          <span className="text-sm text-muted-foreground">{t.projectName}</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer — selection + pagination like Bitrix */}
          <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
            <div className="flex items-center gap-4">
              <span>ОТМЕЧЕНО: {selected.size} / {CRM_TASKS.length}</span>
              <span>ВСЕГО: <button className="text-primary font-medium hover:underline">ПОКАЗАТЬ КОЛИЧЕСТВО</button></span>
            </div>
            <div className="flex items-center gap-2">
              <span>СТРАНИЦЫ: 1</span>
              <span className="ml-4">НА СТРАНИЦЕ:</span>
              <select className="bg-muted/30 border border-border rounded px-2 py-0.5 text-xs text-foreground">
                <option>50</option>
                <option>100</option>
              </select>
            </div>
          </div>

          {/* Bulk actions */}
          <div className="flex items-center gap-3">
            <select className="bg-muted/30 border border-border rounded px-3 py-1.5 text-xs text-muted-foreground">
              <option>ВЫБЕРИТЕ ДЕЙСТВИЕ</option>
            </select>
            <Button size="sm" className="h-8 text-xs">Применить</Button>
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Checkbox className="h-3.5 w-3.5" /> ДЛЯ ВСЕХ
            </label>
          </div>
        </>
      )}

      <TaskDetailSheet task={selectedTask} open={!!selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
