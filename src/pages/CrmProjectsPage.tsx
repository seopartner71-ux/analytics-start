import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, GripVertical, AlertCircle, Loader2, FolderKanban } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";

type Project = Tables<"projects"> & {
  company?: Tables<"companies"> | null;
};

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

export default function CrmProjectsPage() {
  const [search, setSearch] = useState("");

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

  const filtered = projects.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.company?.name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Проекты</h1>
          </div>
          <Button size="sm" className="gap-1.5 h-8 shadow-sm">
            <Plus className="h-4 w-4" /> Создать
          </Button>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск проекта..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm bg-muted/30 border-border/60 focus:bg-card transition-colors" />
        </div>
      </div>

      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <Badge variant="secondary" className="text-xs font-medium">Все проекты</Badge>
        <span className="text-xs text-muted-foreground">Всего: <span className="font-medium text-foreground">{projects.length}</span></span>
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
      ) : (
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
          <table className="crm-table min-w-[800px]">
            <thead>
              <tr>
                <th className="w-8"><Checkbox /></th>
                <th className="w-8"></th>
                <th>Название ↓</th>
                <th>Клиент</th>
                <th>URL</th>
                <th>Эффективность</th>
                <th>SEO-специалист</th>
                <th>Тип</th>
              </tr>
            </thead>
            <tbody>
              <AnimatePresence>
                {filtered.map((p, i) => (
                  <motion.tr
                    key={p.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                  >
                    <td><Checkbox /></td>
                    <td className="text-muted-foreground/20"><GripVertical className="h-4 w-4" /></td>
                    <td>
                      <div className="flex items-center gap-2.5">
                        <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 ring-1 ring-primary/10">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div>
                          <span className="text-sm font-semibold text-foreground">{p.name}</span>
                          {p.description && <p className="text-[11px] text-muted-foreground line-clamp-1">{p.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td>
                      {p.company ? (
                        <span className="text-sm text-foreground">{p.company.name}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      {p.url ? (
                        <span className="text-sm text-primary">{p.url}</span>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="w-16 h-1.5 rounded-full overflow-hidden bg-muted">
                          <div
                            className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${(p as any).efficiency || 0}%`,
                              backgroundColor: ((p as any).efficiency || 0) >= 80 ? "hsl(var(--success))" : ((p as any).efficiency || 0) >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                            }}
                          />
                        </div>
                        <span className="text-sm font-medium text-foreground">{(p as any).efficiency || 0}%</span>
                      </div>
                    </td>
                    <td>
                      {p.seo_specialist ? (
                        <div className="flex items-center gap-2">
                          <AvatarCircle initials={getInitials(p.seo_specialist)} className="h-7 w-7 text-[10px]" />
                          <span className="text-sm text-foreground">{p.seo_specialist}</span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="text-sm text-muted-foreground">{(p as any).privacy || "Закрытый"}</td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
