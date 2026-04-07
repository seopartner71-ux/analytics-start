import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Search } from "lucide-react";
import { EMPLOYEES } from "@/data/crm-mock";
import { motion, AnimatePresence } from "framer-motion";

function AvatarCircle({ initials, status }: { initials: string; status: string }) {
  const statusColor = status === "online" ? "bg-emerald-500" : status === "away" ? "bg-amber-500" : "bg-muted-foreground/30";
  return (
    <div className="relative">
      <div className="h-9 w-9 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary avatar-ring">
        {initials}
      </div>
      <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusColor} ${status === "online" ? "status-online" : ""}`} />
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

  const onlineCount = EMPLOYEES.filter(e => e.status === "online").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Сотрудники</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего: <span className="font-medium text-foreground">{EMPLOYEES.length}</span>
            <span className="mx-1.5">·</span>
            <span className="text-emerald-500 font-medium">{onlineCount} онлайн</span>
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Поиск сотрудника..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/30 border-border/60 focus:bg-card transition-colors" />
        </div>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
        <table className="crm-table min-w-[700px]">
          <thead>
            <tr>
              <th>Сотрудник</th>
              <th>Подразделение</th>
              <th>E-Mail</th>
              <th>Мобильный телефон</th>
              <th>Дата активности</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {filtered.map((e, i) => (
                <motion.tr
                  key={e.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  <td>
                    <div className="flex items-center gap-3">
                      <AvatarCircle initials={e.avatar} status={e.status} />
                      <div>
                        <p className="text-sm font-semibold text-foreground">{e.name}</p>
                        <p className="text-[11px] text-muted-foreground">{e.role}</p>
                      </div>
                    </div>
                  </td>
                  <td>
                    <Badge variant="secondary" className="text-[10px] font-medium">{e.department}</Badge>
                  </td>
                  <td className="text-sm text-muted-foreground">{e.email}</td>
                  <td className="text-sm text-muted-foreground">{e.phone}</td>
                  <td className="text-sm text-muted-foreground">
                    {new Date(e.lastActive).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })}, {e.lastActive.split(" ")[1]}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
