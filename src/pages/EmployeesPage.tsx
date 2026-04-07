import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Loader2, Plus, Users } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type TeamMember = Tables<"team_members">;

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function AvatarCircle({ initials, status }: { initials: string; status?: string }) {
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

function AddEmployeeDialog() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ full_name: "", role: "seo", email: "", phone: "", department: "SEO отдел" });

  const mutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("team_members").insert({
        ...form,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team-members"] });
      toast.success("Сотрудник добавлен");
      setOpen(false);
      setForm({ full_name: "", role: "seo", email: "", phone: "", department: "SEO отдел" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Новый сотрудник</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label className="text-xs">ФИО *</Label><Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} /></div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Должность</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="seo">SEO-специалист</SelectItem>
                  <SelectItem value="manager">Менеджер</SelectItem>
                  <SelectItem value="content">Контент-менеджер</SelectItem>
                  <SelectItem value="linkbuilder">Линкбилдер</SelectItem>
                  <SelectItem value="analyst">Аналитик</SelectItem>
                  <SelectItem value="director">Директор</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div><Label className="text-xs">Подразделение</Label><Input value={form.department} onChange={e => setForm(f => ({ ...f, department: e.target.value }))} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">E-Mail</Label><Input value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} /></div>
            <div><Label className="text-xs">Телефон</Label><Input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} /></div>
          </div>
          <Button onClick={() => mutation.mutate()} disabled={!form.full_name.trim() || mutation.isPending} className="w-full">
            {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            Добавить сотрудника
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const ROLE_LABELS: Record<string, string> = {
  seo: "SEO-специалист",
  manager: "Менеджер",
  content: "Контент-менеджер",
  linkbuilder: "Линкбилдер",
  analyst: "Аналитик",
  director: "Директор",
};

export default function EmployeesPage() {
  const [search, setSearch] = useState("");

  const { data: employees = [], isLoading } = useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    (e.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = employees.filter(e => (e as any).status === "online").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Сотрудники</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего: <span className="font-medium text-foreground">{employees.length}</span>
            {onlineCount > 0 && (
              <>
                <span className="mx-1.5">·</span>
                <span className="text-emerald-500 font-medium">{onlineCount} онлайн</span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <div className="relative flex-1 sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Поиск сотрудника..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/30 border-border/60 focus:bg-card transition-colors" />
          </div>
          <AddEmployeeDialog />
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : employees.length === 0 ? (
        <div className="text-center py-20">
          <Users className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Нет сотрудников. Добавьте первого!</p>
        </div>
      ) : (
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
                        <AvatarCircle initials={getInitials(e.full_name)} status={(e as any).status || "offline"} />
                        <div>
                          <p className="text-sm font-semibold text-foreground">{e.full_name}</p>
                          <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[e.role] || e.role}</p>
                        </div>
                      </div>
                    </td>
                    <td>
                      <Badge variant="secondary" className="text-[10px] font-medium">{(e as any).department || "Общий"}</Badge>
                    </td>
                    <td className="text-sm text-muted-foreground">{e.email || "—"}</td>
                    <td className="text-sm text-muted-foreground">{e.phone || "—"}</td>
                    <td className="text-sm text-muted-foreground">
                      {(e as any).last_active
                        ? new Date((e as any).last_active).toLocaleDateString("ru-RU", { day: "numeric", month: "short" })
                        : "—"}
                    </td>
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
