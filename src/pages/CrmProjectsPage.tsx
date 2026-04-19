import { useState, useMemo, useRef, DragEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Search, GripVertical, Globe, CalendarDays, MessageSquare, Loader2, FolderKanban, LayoutList, Kanban } from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { format, isPast, differenceInDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects"> & {
  company?: Tables<"companies"> | null;
  latestComment?: { body: string } | null;
  seo_spec_name?: string | null;
};

const KANBAN_COLUMNS = [
  { key: "В работе", color: "#4CAF50" },
  { key: "На паузе", color: "#FF9800" },
];

const STAGES = KANBAN_COLUMNS.map(c => c.key);

// Roles allowed to create projects
function canAddProject(role: string | null): boolean {
  return role === "admin" || role === "manager";
}

function getDeadlineColor(deadline: string | null) {
  if (!deadline) return "text-muted-foreground";
  const d = parseISO(deadline);
  if (isPast(d)) return "text-destructive font-medium";
  if (differenceInDays(d, new Date()) <= 3) return "text-amber-500 font-medium";
  return "text-muted-foreground";
}

function AvatarCircle({ name }: { name: string }) {
  const initials = name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="h-6 w-6 rounded-full bg-primary/15 text-primary text-[10px] font-bold flex items-center justify-center shrink-0">
      {initials}
    </div>
  );
}

export default function CrmProjectsPage() {
  const navigate = useNavigate();
  const { user, role } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filter, setFilter] = useState<"all" | "my" | "overdue">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newStage, setNewStage] = useState("В работе");
  const [newDeadline, setNewDeadline] = useState("");
  const [newManager, setNewManager] = useState("");
  const [dragOverCol, setDragOverCol] = useState<string | null>(null);
  const dragItemId = useRef<string | null>(null);

  // Load projects with latest comment
  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["crm-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, company:companies(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;

      // Fetch latest comment per project
      const projectIds = (data || []).map(p => p.id);
      let commentsMap: Record<string, string> = {};
      if (projectIds.length > 0) {
        const { data: comments } = await supabase
          .from("project_comments")
          .select("project_id, body")
          .in("project_id", projectIds)
          .order("created_at", { ascending: false });
        if (comments) {
          for (const c of comments) {
            if (!commentsMap[c.project_id]) commentsMap[c.project_id] = c.body;
          }
        }
      }

      return (data || []).map(p => ({
        ...p,
        latestComment: commentsMap[p.id] ? { body: commentsMap[p.id] } : null,
      })) as Project[];
    },
  });

  const { data: members = [] } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("id, full_name");
      if (error) throw error;
      return data;
    },
  });

  // Create project
  const addMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        name: newName,
        url: newUrl || null,
        owner_id: user!.id,
        privacy: newStage,
      };
      if (newDeadline) payload.updated_at = new Date(newDeadline).toISOString();
      if (newManager) payload.seo_specialist_id = newManager;
      const { error } = await supabase.from("projects").insert(payload);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-projects"] });
      setAddOpen(false);
      setNewName(""); setNewUrl(""); setNewStage("В работе"); setNewDeadline(""); setNewManager("");
      toast.success("Проект создан");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Update stage (drag & drop)
  const updateStageMutation = useMutation({
    mutationFn: async ({ projectId, stage }: { projectId: string; stage: string }) => {
      const { error } = await supabase
        .from("projects")
        .update({ privacy: stage })
        .eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-projects"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const getManagerName = (id: string | null) => {
    if (!id) return null;
    return members.find(m => m.id === id)?.full_name || null;
  };

  const filtered = useMemo(() => {
    let list = projects;
    if (search) {
      const q = search.toLowerCase();
      list = list.filter(p =>
        p.name.toLowerCase().includes(q) ||
        (p.url || "").toLowerCase().includes(q) ||
        (p.company?.name || "").toLowerCase().includes(q)
      );
    }
    if (filter === "my") {
      list = list.filter(p => p.seo_specialist_id || p.account_manager_id);
    }
    if (filter === "overdue") {
      list = list.filter(p => p.updated_at && isPast(parseISO(p.updated_at)));
    }
    return list;
  }, [projects, search, filter]);

  const columnData = useMemo(() => {
    const map: Record<string, Project[]> = {};
    STAGES.forEach(s => (map[s] = []));
    filtered.forEach(p => {
      const stage = p.privacy || "В работе";
      if (map[stage]) map[stage].push(p);
      else map["В работе"].push(p);
    });
    return map;
  }, [filtered]);

  // Drag handlers
  const handleDragStart = (e: DragEvent, projectId: string) => {
    dragItemId.current = projectId;
    e.dataTransfer.effectAllowed = "move";
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "0.5";
    }
  };

  const handleDragEnd = (e: DragEvent) => {
    if (e.currentTarget instanceof HTMLElement) {
      e.currentTarget.style.opacity = "1";
    }
    setDragOverCol(null);
  };

  const handleDragOver = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverCol(colKey);
  };

  const handleDragLeave = () => {
    setDragOverCol(null);
  };

  const handleDrop = (e: DragEvent, colKey: string) => {
    e.preventDefault();
    setDragOverCol(null);
    const projectId = dragItemId.current;
    if (!projectId) return;

    const project = projects.find(p => p.id === projectId);
    if (!project || project.privacy === colKey) return;

    // Optimistic update
    queryClient.setQueryData(["crm-projects"], (old: Project[] | undefined) =>
      (old || []).map(p => p.id === projectId ? { ...p, privacy: colKey } : p)
    );

    updateStageMutation.mutate({ projectId, stage: colKey });
    dragItemId.current = null;
  };

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto">
          {(["all", "my", "overdue"] as const).map(f => {
            const labels = { all: "Все", my: "Мои", overdue: "Просрочен." };
            return (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 text-[13px] rounded-md border transition-colors",
                  filter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/30"
                )}
              >
                {labels[f]}
              </button>
            );
          })}

          <div className="hidden md:block w-px h-6 bg-border mx-1" />

          <div className="relative flex-1 md:flex-initial min-w-[160px] order-last md:order-none w-full md:w-auto">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 w-full md:w-64 text-[13px] bg-card border-border"
            />
          </div>

          <div className="hidden md:block w-px h-6 bg-border mx-1" />

          <div className="flex items-center border border-border rounded-md overflow-hidden ml-auto md:ml-0">
            <button
              onClick={() => setView("kanban")}
              className={cn("p-1.5 transition-colors", view === "kanban" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
              title="Канбан"
            >
              <Kanban className="h-4 w-4" />
            </button>
            <button
              onClick={() => setView("list")}
              className={cn("p-1.5 transition-colors", view === "list" ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:text-foreground")}
              title="Список"
            >
              <LayoutList className="h-4 w-4" />
            </button>
          </div>
        </div>

        {canAddProject(role) && (
          <Dialog open={addOpen} onOpenChange={setAddOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 text-[13px] shadow-sm w-full md:w-auto">
                <Plus className="h-4 w-4" /> Добавить проект
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Новый проект</DialogTitle>
              </DialogHeader>
              <div className="space-y-3 mt-2">
                <div>
                  <Label className="text-[13px]">Название *</Label>
                  <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название клиента / проекта" className="mt-1" />
                </div>
                <div>
                  <Label className="text-[13px]">Домен</Label>
                  <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="example.ru" className="mt-1" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-[13px]">Статус</Label>
                    <Select value={newStage} onValueChange={setNewStage}>
                      <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-[13px]">Дедлайн</Label>
                    <Input type="date" value={newDeadline} onChange={e => setNewDeadline(e.target.value)} className="mt-1" />
                  </div>
                </div>
                <div>
                  <Label className="text-[13px]">Ответственный</Label>
                  <Select value={newManager} onValueChange={setNewManager}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="Выберите сотрудника" /></SelectTrigger>
                    <SelectContent>
                      {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <Button onClick={() => addMutation.mutate()} disabled={!newName.trim() || addMutation.isPending} className="w-full">
                  {addMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                  Создать проект
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20">
          <FolderKanban className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Нет проектов. Создайте первый!</p>
        </div>
      ) : view === "kanban" ? (
        <div className="space-y-6">
          {KANBAN_COLUMNS.map(col => {
            const items = columnData[col.key] || [];
            const isOver = dragOverCol === col.key;
            return (
              <div
                key={col.key}
                className={cn(
                  "rounded-lg transition-colors",
                  isOver && "bg-primary/5 ring-2 ring-primary/20"
                )}
                onDragOver={e => handleDragOver(e, col.key)}
                onDragLeave={handleDragLeave}
                onDrop={e => handleDrop(e, col.key)}
              >
                {/* Row header */}
                <div className="flex items-center gap-2 px-1 py-2 mb-2">
                  <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                  <span className="text-[13px] font-semibold text-foreground">{col.key}</span>
                  <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {items.length}
                  </span>
                </div>

                {/* Cards grid */}
                {items.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                    {items.map(p => {
                      const manager = getManagerName(p.seo_specialist_id) || p.seo_specialist;
                      return (
                        <div
                          key={p.id}
                          draggable
                          onDragStart={e => handleDragStart(e, p.id)}
                          onDragEnd={handleDragEnd}
                          onClick={() => navigate(`/crm-projects/${p.id}`)}
                          className="bg-card rounded-md border border-border p-3 cursor-grab active:cursor-grabbing transition-all hover:shadow-md hover:-translate-y-0.5 group"
                          style={{ borderLeftWidth: 3, borderLeftColor: col.color }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium uppercase">SEO</span>
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                          </div>

                          <p className="text-[14px] font-semibold text-foreground leading-tight mb-1.5 truncate">
                            {p.company?.name || p.name}
                          </p>

                          {p.url && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Globe className="h-3 w-3 text-muted-foreground shrink-0" />
                              <span className="text-[12px] text-muted-foreground truncate">{p.url}</span>
                            </div>
                          )}

                          <div className="flex items-center gap-1.5 mb-1.5">
                            <CalendarDays className="h-3 w-3 text-muted-foreground shrink-0" />
                            <span className={cn("text-[12px]", getDeadlineColor(p.updated_at))}>
                              {format(parseISO(p.created_at), "dd.MM.yyyy")}
                            </span>
                          </div>

                          {manager && (
                            <div className="flex items-center gap-1.5">
                              <AvatarCircle name={manager} />
                              <span className="text-[12px] text-muted-foreground truncate">{manager}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-16 text-[12px] text-muted-foreground/50 border border-dashed border-border rounded-md">
                    Перетащите сюда
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
          <table className="crm-table min-w-[800px]">
            <thead>
              <tr>
                <th>Название</th>
                <th>Клиент</th>
                <th>Домен</th>
                <th>Этап</th>
                <th>Эффективность</th>
                <th>SEO-специалист</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(p => {
                const col = KANBAN_COLUMNS.find(c => c.key === (p.privacy || "В работе"));
                const manager = getManagerName(p.seo_specialist_id) || p.seo_specialist;
                return (
                  <tr key={p.id} onClick={() => navigate(`/crm-projects/${p.id}`)} className="cursor-pointer">
                    <td><span className="text-[13px] font-semibold text-foreground">{p.name}</span></td>
                    <td className="text-[13px] text-muted-foreground">{p.company?.name || "—"}</td>
                    <td className="text-[13px] text-accent">{p.url || "—"}</td>
                    <td>
                      <span
                        className="px-2 py-0.5 text-[11px] rounded-full font-medium"
                        style={{ background: `${col?.color || '#9E9E9E'}20`, color: col?.color || '#9E9E9E' }}
                      >
                        {p.privacy || "В работе"}
                      </span>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden bg-muted">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${p.efficiency || 0}%`,
                              backgroundColor: (p.efficiency || 0) >= 80 ? "#4CAF50" : (p.efficiency || 0) >= 40 ? "#FF9800" : "#F44336",
                            }}
                          />
                        </div>
                        <span className="text-[12px] font-medium text-foreground">{p.efficiency || 0}%</span>
                      </div>
                    </td>
                    <td>
                      {manager ? (
                        <div className="flex items-center gap-2">
                          <AvatarCircle name={manager} />
                          <span className="text-[13px] text-foreground">{manager}</span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
