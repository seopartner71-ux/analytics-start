import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { EMPLOYEES } from "@/data/crm-mock";

function AvatarCircle({ initials, status }: { initials: string; status: string }) {
  const statusColor = status === "online" ? "bg-emerald-500" : status === "away" ? "bg-amber-500" : "bg-muted-foreground/30";
  return (
    <div className="relative">
      <div className="h-9 w-9 rounded-full bg-primary/20 flex items-center justify-center text-xs font-bold text-primary">
        {initials}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusColor}`} />
    </div>
  );
}

export default function EmployeesPage() {
  const [search, setSearch] = useState("");

  const filtered = EMPLOYEES.filter(e =>
    e.name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    e.department.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Сотрудники</h1>
          <p className="text-sm text-muted-foreground">Всего: {EMPLOYEES.length}</p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск сотрудника..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[700px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Сотрудник</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Подразделение</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">E-Mail</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Мобильный телефон</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Дата активности</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(e => (
              <tr key={e.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-3">
                    <AvatarCircle initials={e.avatar} status={e.status} />
                    <div>
                      <p className="text-sm font-medium text-foreground">{e.name}</p>
                      <p className="text-xs text-muted-foreground">{e.role}</p>
                    </div>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant="secondary" className="text-xs">{e.department}</Badge>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{e.email}</td>
                <td className="p-3 text-sm text-muted-foreground">{e.phone}</td>
                <td className="p-3 text-sm text-muted-foreground">{e.lastActive}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
