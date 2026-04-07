import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, TrendingUp, TrendingDown } from "lucide-react";
import { CRM_PROJECTS } from "@/data/crm-mock";

function AvatarCircle({ initials, className = "" }: { initials: string; className?: string }) {
  return (
    <div className={`flex items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold shrink-0 ${className}`}>
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
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Проекты</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">Всего: {CRM_PROJECTS.length}</p>
            {overdueCount > 0 && <Badge variant="destructive" className="text-xs">{overdueCount} просрочены</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск проекта..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
          </div>
          <Button size="sm" className="gap-1.5 shrink-0"><Plus className="h-4 w-4" /> Создать</Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[800px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="w-10 p-3"><Checkbox /></th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">ID</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Название</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Активность</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Эффективность</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Участники</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Роль</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Тип</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/50 hover:bg-muted/20 cursor-pointer transition-colors">
                <td className="p-3"><Checkbox /></td>
                <td className="p-3 text-sm text-muted-foreground">{p.tasksTotal}</td>
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-foreground">{p.name}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="secondary" className="text-xs">
                    {p.tasksCompleted}
                  </Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <Progress value={p.efficiency} className="h-2 w-16" />
                    <span className="text-xs text-muted-foreground">{p.efficiency}%</span>
                  </div>
                </td>
                <td className="p-3">
                  <div className="flex -space-x-2">
                    {p.members.slice(0, 3).map((m, i) => (
                      <AvatarCircle key={i} initials={m.avatar} className="h-7 w-7 border-2 border-card" />
                    ))}
                    {p.members.length > 3 && (
                      <div className="h-7 w-7 rounded-full bg-muted flex items-center justify-center text-[10px] text-muted-foreground border-2 border-card">
                        +{p.members.length - 3}
                      </div>
                    )}
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="outline" className="text-[10px] whitespace-nowrap">{p.role}</Badge>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{p.privacy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
