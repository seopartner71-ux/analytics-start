import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, GripVertical, Globe, CalendarDays, MessageSquare, User, Loader2, FolderKanban, LayoutList, Kanban } from "lucide-react";
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
  tasks?: { id: string; deadline: string | null; stage: string }[];
  latestComment?: string;
};

const KANBAN_COLUMNS = [
  { key: "Новые заявки", color: "#9E9E9E" },
  { key: "Анализ сайта", color: "#2196F3" },
  { key: "Составление стратегии", color: "#FF9800" },
  { key: "В работе", color: "#4CAF50" },
  { key: "На проверке", color: "#9C27B0" },
  { key: "Успешно завершено", color: "#4CAF50" },
  { key: "Отказ", color: "#F44336" },
];

const STAGES = KANBAN_COLUMNS.map(c => c.key);

function getDeadlineColor(deadline: string | null) {
  if (!deadline) return "text-muted-foreground";
  const d = parseISO(deadline);
  if (isPast(d)) return "text-destructive font-medium";
  if (differenceInDays(d, new Date()) <= 3) return "text-warning font-medium";
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
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [view, setView] = useState<"kanban" | "list">("kanban");
  const [filter, setFilter] = useState<"all" | "my" | "overdue">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["crm-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, company:companies(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Project[];
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

  const addMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").insert({
        name: newName,
        url: newUrl || null,
        owner_id: user!.id,
        privacy: "Новые заявки",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["crm-projects"] });
      setAddOpen(false);
      setNewName("");
      setNewUrl("");
      toast.success("Проект создан");
    },
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
    return list;
  }, [projects, search, filter]);

  // Group by stage (using privacy field as stage)
  const columnData = useMemo(() => {
    const map: Record<string, Project[]> = {};
    STAGES.forEach(s => (map[s] = []));
    filtered.forEach(p => {
      const stage = p.privacy || "Новые заявки";
      if (map[stage]) map[stage].push(p);
      else map["Новые заявки"].push(p);
    });
    return map;
  }, [filtered]);

  return (
    <div className="space-y-4">
      {/* Filter bar */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "my", "overdue"] as const).map(f => {
            const labels = { all: "Все проекты", my: "Мои проекты", overdue: "Просроченные" };
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

          <div className="w-px h-6 bg-border mx-1" />

          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Поиск по клиенту или домену..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-8 h-8 w-64 text-[13px] bg-card border-border"
            />
          </div>

          <div className="w-px h-6 bg-border mx-1" />

          {/* View toggle */}
          <div className="flex items-center border border-border rounded-md overflow-hidden">
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

        <Dialog open={addOpen} onOpenChange={setAddOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary hover:bg-primary/90 text-primary-foreground gap-1.5 h-9 text-[13px] shadow-sm">
              <Plus className="h-4 w-4" /> Добавить проект
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Новый проект</DialogTitle>
            </DialogHeader>
            <div className="space-y-3 mt-2">
              <div>
                <Label className="text-[13px]">Название</Label>
                <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder="Название клиента / проекта" className="mt-1" />
              </div>
              <div>
                <Label className="text-[13px]">Домен</Label>
                <Input value={newUrl} onChange={e => setNewUrl(e.target.value)} placeholder="example.ru" className="mt-1" />
              </div>
              <Button onClick={() => addMutation.mutate()} disabled={!newName.trim() || addMutation.isPending} className="w-full">
                {addMutation.isPending ? "Создание..." : "Создать проект"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
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
        /* ---- KANBAN VIEW ---- */
        <ScrollArea className="w-full">
          <div className="flex gap-3 pb-4 min-w-max">
            {KANBAN_COLUMNS.map(col => {
              const items = columnData[col.key] || [];
              return (
                <div key={col.key} className="w-[280px] shrink-0 flex flex-col">
                  {/* Column header */}
                  <div className="flex items-center justify-between px-3 py-2.5 mb-2">
                    <div className="flex items-center gap-2">
                      <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: col.color }} />
                      <span className="text-[13px] font-semibold text-foreground">{col.key}</span>
                    </div>
                    <span className="text-[11px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                      {items.length} {items.length === 1 ? "проект" : "проектов"}
                    </span>
                  </div>

                  {/* Cards */}
                  <div className="space-y-2 min-h-[200px]">
                    {items.map(p => {
                      const manager = getManagerName(p.seo_specialist_id) || p.seo_specialist;
                      return (
                        <div
                          key={p.id}
                          onClick={() => navigate(`/crm-projects/${p.id}`)}
                          className="bg-card rounded-md border border-border p-3 cursor-pointer transition-all hover:shadow-md hover:-translate-y-0.5 group"
                        >
                          {/* Top: drag handle + tag */}
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-accent/10 text-accent font-medium uppercase">SEO</span>
                            <GripVertical className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                          </div>

                          {/* Title */}
                          <p className="text-[14px] font-semibold text-foreground leading-tight mb-1.5">
                            {p.company?.name || p.name}
                          </p>

                          {/* Domain */}
                          {p.url && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <Globe className="h-3 w-3 text-muted-foreground" />
                              <span className="text-[12px] text-muted-foreground">{p.url}</span>
                            </div>
                          )}

                          {/* Deadline */}
                          <div className="flex items-center gap-1.5 mb-1.5">
                            <CalendarDays className="h-3 w-3 text-muted-foreground" />
                            <span className={cn("text-[12px]", getDeadlineColor(p.updated_at))}>
                              Дедлайн: {format(parseISO(p.updated_at), "dd MMM", { locale: undefined })}
                            </span>
                          </div>

                          {/* Manager */}
                          {manager && (
                            <div className="flex items-center gap-1.5 mb-1.5">
                              <AvatarCircle name={manager} />
                              <span className="text-[12px] text-muted-foreground">{manager}</span>
                            </div>
                          )}

                          {/* Comment stub */}
                          <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-border/50">
                            <MessageSquare className="h-3 w-3 text-muted-foreground/50" />
                            <span className="text-[11px] text-muted-foreground italic truncate">Ожидает проверки...</span>
                          </div>
                        </div>
                      );
                    })}

                    {items.length === 0 && (
                      <div className="flex items-center justify-center h-24 text-[12px] text-muted-foreground/50 border border-dashed border-border rounded-md">
                        0 проектов
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      ) : (
        /* ---- LIST VIEW ---- */
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
                const col = KANBAN_COLUMNS.find(c => c.key === (p.privacy || "Новые заявки"));
                const manager = getManagerName(p.seo_specialist_id) || p.seo_specialist;
                return (
                  <tr key={p.id} onClick={() => navigate(`/crm-projects/${p.id}`)} className="cursor-pointer">
                    <td>
                      <span className="text-[13px] font-semibold text-foreground">{p.name}</span>
                    </td>
                    <td className="text-[13px] text-muted-foreground">{p.company?.name || "—"}</td>
                    <td className="text-[13px] text-accent">{p.url || "—"}</td>
                    <td>
                      <span
                        className="px-2 py-0.5 text-[11px] rounded-full font-medium"
                        style={{ background: `${col?.color || '#9E9E9E'}20`, color: col?.color || '#9E9E9E' }}
                      >
                        {p.privacy || "Новые заявки"}
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
