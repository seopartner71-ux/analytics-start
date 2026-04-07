import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Plus, Search, GripVertical, AlertCircle } from "lucide-react";
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
      {/* Header — Bitrix24 style */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold text-foreground">Проекты</h1>
          <Button size="sm" className="gap-1.5 h-8">
            <Plus className="h-4 w-4" /> Создать
          </Button>
          <Badge variant="secondary" className="text-xs">Мои ×</Badge>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="+ поиск" value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-8 text-sm" />
        </div>
      </div>

      {/* Counters bar */}
      <div className="flex items-center gap-3 overflow-x-auto pb-1">
        {overdueCount > 0 && (
          <Badge variant="destructive" className="text-[10px] h-5">
            <AlertCircle className="h-3 w-3 mr-1" />{overdueCount} Просрочены
          </Badge>
        )}
        <span className="text-xs text-muted-foreground">99+ Комментарии</span>
        <span className="text-xs text-muted-foreground">Прочитать все</span>
      </div>

      {/* Table — Bitrix24 Projects style */}
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[900px]">
          <thead>
            <tr className="border-b border-border bg-muted/20">
              <th className="w-8 p-2.5"><Checkbox /></th>
              <th className="w-8 p-2.5"></th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5 w-16">ID</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Название ↓</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Активность</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Эффективность</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Участники</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Роль</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-2.5">Тип приватности</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(p => (
              <tr key={p.id} className="border-b border-border/40 hover:bg-muted/10 cursor-pointer transition-colors">
                <td className="p-2.5"><Checkbox /></td>
                <td className="p-2.5 text-muted-foreground/30"><GripVertical className="h-4 w-4" /></td>
                <td className="p-2.5 text-sm text-muted-foreground">{p.tasksTotal}</td>
                <td className="p-2.5">
                  <div className="flex items-center gap-2.5">
                    <div className="h-7 w-7 rounded-lg bg-primary/10 flex items-center justify-center text-[10px] font-bold text-primary shrink-0">
                      {p.name.slice(0, 2).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-foreground">{p.name}</span>
                  </div>
                </td>
                <td className="p-2.5">
                  <div className="flex items-center gap-1.5">
                    <Badge className="h-5 min-w-5 flex items-center justify-center rounded-full text-[10px] bg-destructive text-destructive-foreground border-0 hover:bg-destructive">
                      {p.tasksCompleted}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{p.lastActivity}</span>
                  </div>
                </td>
                <td className="p-2.5">
                  <span className="text-sm text-foreground">{p.efficiency}%</span>
                </td>
                <td className="p-2.5">
                  <div className="flex items-center">
                    <div className="flex -space-x-1.5">
                      {p.members.slice(0, 3).map((m, i) => (
                        <AvatarCircle key={i} initials={m.avatar} className="h-7 w-7 border-2 border-card text-[9px]" />
                      ))}
                    </div>
                    {p.members.length > 3 && (
                      <span className="text-xs text-muted-foreground ml-1">+{p.members.length - 3}</span>
                    )}
                  </div>
                </td>
                <td className="p-2.5">
                  <Badge variant="outline" className="text-[10px] text-primary border-primary/30 whitespace-nowrap">{p.role}</Badge>
                </td>
                <td className="p-2.5 text-sm text-muted-foreground">{p.privacy}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
