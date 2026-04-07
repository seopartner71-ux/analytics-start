import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Search, GripVertical, AlertCircle, TrendingUp, TrendingDown } from "lucide-react";
import { CRM_PROJECTS } from "@/data/crm-mock";
import { motion, AnimatePresence } from "framer-motion";

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-bold shrink-0 ${className}`}>
      {initials}
    </div>
  );
}

export default function CrmProjectsPage() {
  const [search, setSearch] = useState("");

  const filtered = CRM_PROJECTS.filter(p =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.client.toLowerCase().includes(search.toLowerCase())
  );

  const overdueCount = CRM_PROJECTS.filter(p => p.efficiency === 0).length;

  return (
    <div className="space-y-5">
      {/* Header */}
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

      {/* Counters bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        <Badge variant="secondary" className="text-xs font-medium">Мои проекты</Badge>
        {overdueCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5 gap-1">
            <AlertCircle className="h-3 w-3" />{overdueCount} Просрочены
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">Всего: <span className="font-medium text-foreground">{CRM_PROJECTS.length}</span></span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
        <table className="crm-table min-w-[900px]">
          <thead>
            <tr>
              <th className="w-8"><Checkbox /></th>
              <th className="w-8"></th>
              <th className="w-16">ID</th>
              <th>Название ↓</th>
              <th>Активность</th>
              <th>Эффективность</th>
              <th>Участники</th>
              <th>Роль</th>
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
                  <td className="text-muted-foreground/30"><GripVertical className="h-4 w-4" /></td>
                  <td className="text-sm text-muted-foreground font-mono">{p.tasksTotal}</td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="h-8 w-8 rounded-xl bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0 ring-1 ring-primary/10">
                        {p.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <span className="text-sm font-semibold text-foreground">{p.name}</span>
                        <p className="text-[11px] text-muted-foreground">{p.client}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full text-[10px] bg-destructive text-destructive-foreground border-0 hover:bg-destructive">
                        {p.tasksCompleted}
                      </Badge>
                      <span className="text-[11px] text-muted-foreground">{p.lastActivity.split(" ")[0]}</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-16 h-1.5 rounded-full overflow-hidden bg-muted">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${p.efficiency}%`,
                            backgroundColor: p.efficiency >= 80 ? "hsl(var(--success))" : p.efficiency >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                          }}
                        />
                      </div>
                      <span className="text-sm font-medium text-foreground">{p.efficiency}%</span>
                    </div>
                  </td>
                  <td>
                    <div className="flex items-center">
                      <div className="flex -space-x-1.5">
                        {p.members.slice(0, 3).map((m, i) => (
                          <AvatarCircle key={i} initials={m.avatar} className="h-7 w-7 border-2 border-card text-[9px]" />
                        ))}
                      </div>
                      {p.members.length > 3 && (
                        <span className="text-xs text-muted-foreground ml-1.5">+{p.members.length - 3}</span>
                      )}
                    </div>
                  </td>
                  <td>
                    <Badge variant="outline" className="text-[10px] text-primary border-primary/20 whitespace-nowrap font-medium">{p.role}</Badge>
                  </td>
                  <td className="text-sm text-muted-foreground">{p.privacy}</td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
