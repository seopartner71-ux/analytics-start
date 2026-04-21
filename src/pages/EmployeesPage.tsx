import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Loader2, Plus, Users, Shield, Mail, Copy, Check, Award, Clock } from "lucide-react";
import ReliabilityLeaderboard from "@/components/employees/ReliabilityLeaderboard";
import AdminTimeStatsPage from "@/pages/AdminTimeStatsPage";
import UsersAdminPage from "@/pages/UsersAdminPage";
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

function AvatarCircle({ initials, status, avatarUrl }: { initials: string; status?: string; avatarUrl?: string | null }) {
  const statusColor = status === "online" ? "bg-emerald-500" : status === "away" ? "bg-amber-500" : "bg-muted-foreground/30";
  return (
    <div className="relative">
      <div className="h-9 w-9 rounded-full overflow-hidden bg-primary/15 flex items-center justify-center text-xs font-bold text-primary avatar-ring">
        {avatarUrl ? (
          <img src={avatarUrl} alt={initials} className="h-full w-full object-cover" />
        ) : (
          initials
        )}
      </div>
      {status && (
        <span className={`absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card ${statusColor} ${status === "online" ? "status-online" : ""}`} />
      )}
    </div>
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

const APP_ROLE_LABELS: Record<string, { label: string; color: string }> = {
  admin: { label: "Администратор", color: "bg-destructive/10 text-destructive" },
  manager: { label: "Менеджер", color: "bg-blue-500/10 text-blue-600" },
  viewer: { label: "Наблюдатель", color: "bg-muted text-muted-foreground" },
};

/* ───────── Invite User Dialog ───────── */
function InviteUserDialog() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ email: "", full_name: "", role: "manager" as string });
  const [result, setResult] = useState<{ temp_password?: string; message?: string } | null>(null);
  const [copied, setCopied] = useState(false);

  const invite = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("invite-user", {
        body: form,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      setResult(data);
      if (!data.temp_password) {
        toast.success("Роль обновлена");
        setOpen(false);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const copyCredentials = () => {
    if (!result?.temp_password) return;
    navigator.clipboard.writeText(`Email: ${form.email}\nПароль: ${result.temp_password}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isAdmin) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setResult(null); setCopied(false); } }}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Mail className="h-4 w-4" /> Пригласить пользователя
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Пригласить пользователя</DialogTitle></DialogHeader>
        {result?.temp_password ? (
          <div className="space-y-4">
            <div className="rounded-lg border border-border bg-muted/30 p-4 space-y-2">
              <p className="text-sm font-medium text-foreground">Пользователь создан!</p>
              <p className="text-xs text-muted-foreground">Передайте эти данные для входа:</p>
              <div className="bg-card rounded p-3 text-sm font-mono space-y-1">
                <p>Email: {form.email}</p>
                <p>Пароль: {result.temp_password}</p>
              </div>
            </div>
            <Button onClick={copyCredentials} variant="outline" className="w-full gap-2">
              {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              {copied ? "Скопировано!" : "Скопировать"}
            </Button>
            <Button onClick={() => { setOpen(false); setResult(null); setForm({ email: "", full_name: "", role: "manager" }); }} className="w-full">
              Готово
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Email *</Label>
              <Input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="user@company.com" />
            </div>
            <div>
              <Label className="text-xs">ФИО</Label>
              <Input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} placeholder="Иван Иванов" />
            </div>
            <div>
              <Label className="text-xs">Роль в системе *</Label>
              <Select value={form.role} onValueChange={v => setForm(f => ({ ...f, role: v }))}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">Администратор — полный доступ</SelectItem>
                  <SelectItem value="manager">Менеджер — назначенные проекты</SelectItem>
                  <SelectItem value="viewer">Наблюдатель — только чтение</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button onClick={() => invite.mutate()} disabled={!form.email.trim() || invite.isPending} className="w-full">
              {invite.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Пригласить
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ───────── Add Employee Dialog ───────── */
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
        <Button size="sm" variant="outline" className="gap-1.5">
          <Plus className="h-4 w-4" /> Добавить сотрудника
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

/* ───────── System Users Tab ───────── */
function SystemUsersTab() {
  const { isAdmin } = useAuth();
  const queryClient = useQueryClient();

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["system-users"],
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("*")
        .order("full_name");
      if (error) throw error;

      const { data: roles } = await supabase
        .from("user_roles")
        .select("user_id, role");

      return (profiles || []).map(p => ({
        ...p,
        app_role: roles?.find(r => r.user_id === p.user_id)?.role || "viewer",
      }));
    },
  });

  const updateRole = useMutation({
    mutationFn: async ({ userId, newRole }: { userId: string; newRole: string }) => {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole as any })
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["system-users"] });
      toast.success("Роль обновлена");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (isLoading) {
    return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
      <table className="crm-table min-w-[700px]">
        <thead>
          <tr>
            <th>Пользователь</th>
            <th>Email</th>
            <th>Роль в системе</th>
            <th>Дата регистрации</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => {
            const roleInfo = APP_ROLE_LABELS[u.app_role] || APP_ROLE_LABELS.viewer;
            return (
              <motion.tr
                key={u.id}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.03, duration: 0.2 }}
              >
                <td>
                  <div className="flex items-center gap-3">
                    <AvatarCircle
                      initials={u.full_name ? getInitials(u.full_name) : u.email.charAt(0).toUpperCase()}
                      avatarUrl={u.avatar_url}
                    />
                    <div>
                      <p className="text-sm font-semibold text-foreground">{u.full_name || "—"}</p>
                    </div>
                  </div>
                </td>
                <td className="text-sm text-muted-foreground">{u.email}</td>
                <td>
                  {isAdmin ? (
                    <Select
                      value={u.app_role}
                      onValueChange={(v) => updateRole.mutate({ userId: u.user_id, newRole: v })}
                    >
                      <SelectTrigger className="h-8 w-40">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Администратор</SelectItem>
                        <SelectItem value="manager">Менеджер</SelectItem>
                        <SelectItem value="viewer">Наблюдатель</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Badge className={`${roleInfo.color} text-[10px] font-medium border-0`}>
                      {roleInfo.label}
                    </Badge>
                  )}
                </td>
                <td className="text-sm text-muted-foreground">
                  {new Date(u.created_at).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                </td>
              </motion.tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────── Main Page ───────── */
export default function EmployeesPage() {
  const [search, setSearch] = useState("");
  const { isAdmin, role } = useAuth();
  const isDirector = role === "director";
  const canSeeTime = isAdmin || isDirector;

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

  // Live presence + avatar: соединяем team_members → profiles (по email) → user_time_logs.updated_at
  const { data: presenceMap = {} } = useQuery({
    queryKey: ["team-presence"],
    queryFn: async () => {
      const today = new Date().toISOString().slice(0, 10);
      const [{ data: profiles }, { data: logs }] = await Promise.all([
        supabase.from("profiles").select("user_id, email, avatar_url"),
        supabase.from("user_time_logs").select("user_id, updated_at, active_seconds").eq("log_date", today),
      ]);
      const userIdToProfile = new Map<string, { email: string; avatar_url: string | null }>();
      (profiles || []).forEach((p: any) => p.email && userIdToProfile.set(p.user_id, { email: p.email.toLowerCase(), avatar_url: p.avatar_url }));
      const map: Record<string, { updated_at?: string; active_seconds?: number; avatar_url?: string | null }> = {};
      userIdToProfile.forEach((p) => { map[p.email] = { avatar_url: p.avatar_url }; });
      (logs || []).forEach((l: any) => {
        const p = userIdToProfile.get(l.user_id);
        if (p) map[p.email] = { ...map[p.email], updated_at: l.updated_at, active_seconds: l.active_seconds };
      });
      return map;
    },
    refetchInterval: 30_000,
  });

  const getPresence = (email: string | null) => {
    if (!email) return { status: "offline" as const, activeSeconds: 0, avatarUrl: null as string | null, updatedAt: undefined as string | undefined };
    const entry = presenceMap[email.toLowerCase()];
    if (!entry) return { status: "offline" as const, activeSeconds: 0, avatarUrl: null, updatedAt: undefined };
    const avatarUrl = entry.avatar_url ?? null;
    if (!entry.updated_at) return { status: "offline" as const, activeSeconds: 0, avatarUrl, updatedAt: undefined };
    const ageSec = (Date.now() - new Date(entry.updated_at).getTime()) / 1000;
    const status = ageSec < 180 ? "online" : ageSec < 900 ? "away" : "offline";
    return { status: status as "online" | "away" | "offline", activeSeconds: entry.active_seconds || 0, updatedAt: entry.updated_at, avatarUrl };
  };

  const filtered = employees.filter(e =>
    e.full_name.toLowerCase().includes(search.toLowerCase()) ||
    e.role.toLowerCase().includes(search.toLowerCase()) ||
    (e.email || "").toLowerCase().includes(search.toLowerCase())
  );

  const onlineCount = employees.filter(e => getPresence(e.email).status === "online").length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Сотрудники и доступ</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление командой и правами доступа к системе
          </p>
        </div>
        <div className="flex items-center gap-2">
          <InviteUserDialog />
          <AddEmployeeDialog />
        </div>
      </div>

      <Tabs defaultValue="employees">
        <TabsList>
          <TabsTrigger value="employees" className="gap-1.5">
            <Users className="h-3.5 w-3.5" /> Сотрудники
          </TabsTrigger>
          <TabsTrigger value="reliability" className="gap-1.5">
            <Award className="h-3.5 w-3.5" /> Надёжность
          </TabsTrigger>
          {canSeeTime && (
            <TabsTrigger value="time" className="gap-1.5">
              <Clock className="h-3.5 w-3.5" /> Учёт времени
            </TabsTrigger>
          )}
          {isAdmin && (
            <TabsTrigger value="access" className="gap-1.5">
              <Shield className="h-3.5 w-3.5" /> Доступ к системе
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="employees" className="mt-4 space-y-4">
          <div className="flex items-center gap-2">
            <div className="relative flex-1 sm:max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Поиск сотрудника..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9 h-9 bg-muted/30 border-border/60" />
            </div>
            <p className="text-sm text-muted-foreground">
              Всего: <span className="font-medium text-foreground">{employees.length}</span>
              {onlineCount > 0 && (
                <>
                  <span className="mx-1.5">·</span>
                  <span className="text-emerald-500 font-medium">{onlineCount} онлайн</span>
                </>
              )}
            </p>
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
                    {filtered.map((e, i) => {
                      const presence = getPresence(e.email);
                      const lastSeen = presence.updatedAt
                        ? new Date(presence.updatedAt)
                        : e.last_active
                        ? new Date(e.last_active)
                        : null;
                      const lastSeenLabel = (() => {
                        if (presence.status === "online") return "сейчас в сети";
                        if (!lastSeen) return "—";
                        const ageMin = Math.floor((Date.now() - lastSeen.getTime()) / 60000);
                        if (ageMin < 60) return `${ageMin} мин назад`;
                        const sameDay = lastSeen.toDateString() === new Date().toDateString();
                        return sameDay
                          ? lastSeen.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })
                          : lastSeen.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
                      })();
                      const statusClass =
                        presence.status === "online" ? "text-emerald-500 font-medium"
                        : presence.status === "away" ? "text-amber-500"
                        : "text-muted-foreground";
                      return (
                        <motion.tr
                          key={e.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.03, duration: 0.2 }}
                        >
                          <td>
                            <div className="flex items-center gap-3">
                              <AvatarCircle initials={getInitials(e.full_name)} status={presence.status} avatarUrl={presence.avatarUrl} />
                              <div>
                                <p className="text-sm font-semibold text-foreground">{e.full_name}</p>
                                <p className="text-[11px] text-muted-foreground">{ROLE_LABELS[e.role] || e.role}</p>
                              </div>
                            </div>
                          </td>
                          <td>
                            <Badge variant="secondary" className="text-[10px] font-medium">{e.department || "Общий"}</Badge>
                          </td>
                          <td className="text-sm text-muted-foreground">{e.email || "—"}</td>
                          <td className="text-sm text-muted-foreground">{e.phone || "—"}</td>
                          <td className={`text-sm ${statusClass}`}>{lastSeenLabel}</td>
                        </motion.tr>
                      );
                    })}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>

        <TabsContent value="reliability" className="mt-4">
          <ReliabilityLeaderboard />
        </TabsContent>

        {canSeeTime && (
          <TabsContent value="time" className="mt-4">
            <AdminTimeStatsPage embedded />
          </TabsContent>
        )}

        {isAdmin && (
          <TabsContent value="access" className="mt-4 -mx-6 lg:-mx-8">
            <UsersAdminPage />
          </TabsContent>
        )}
      </Tabs>
    </div>
  );
}
