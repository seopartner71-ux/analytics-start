import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Shield, UserCheck, UserX, Mail, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

const ROLE_OPTIONS: { value: AppRole; label: string; desc: string }[] = [
  { value: "admin", label: "Admin", desc: "Полный доступ" },
  { value: "director", label: "Director", desc: "Финансы + все проекты" },
  { value: "seo", label: "SEO-специалист", desc: "Свои проекты" },
  { value: "manager", label: "Менеджер", desc: "Свои проекты + клиенты" },
  { value: "junior", label: "Junior", desc: "Свои проекты + база знаний" },
];

interface UserRow {
  user_id: string;
  email: string | null;
  full_name: string | null;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  telegram: string | null;
  position: string | null;
  status: string;
  finance_access: boolean | null;
  onboarding_access: boolean | null;
  knowledge_edit_access: boolean | null;
  all_projects_access: boolean | null;
  created_at: string;
  role: AppRole | null;
}

export default function UsersAdminPage() {
  const { isAdmin, loading } = useAuth();
  const qc = useQueryClient();
  const [editing, setEditing] = useState<UserRow | null>(null);

  const { data: users = [], isLoading } = useQuery({
    queryKey: ["admin-users"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data: profiles, error } = await supabase
        .from("profiles")
        .select("user_id, email, full_name, first_name, last_name, phone, telegram, position, status, finance_access, onboarding_access, knowledge_edit_access, all_projects_access, created_at")
        .order("created_at", { ascending: false });
      if (error) throw error;

      const { data: roles } = await supabase.from("user_roles").select("user_id, role");
      const roleMap = new Map<string, AppRole>();
      roles?.forEach((r) => roleMap.set(r.user_id, r.role));

      return (profiles ?? []).map((p) => ({ ...p, role: roleMap.get(p.user_id) ?? null })) as UserRow[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["admin-projects-all"],
    enabled: isAdmin,
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  if (loading) {
    return <div className="flex items-center justify-center p-12"><Loader2 className="animate-spin" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Доступ только для администраторов.
      </div>
    );
  }

  const pending = users.filter((u) => u.status === "pending");
  const active = users.filter((u) => u.status === "active");
  const blocked = users.filter((u) => u.status === "blocked");

  return (
    <div className="p-6 lg:p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Пользователи</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Управление учётными записями и доступами
          </p>
        </div>
      </div>

      <Tabs defaultValue="pending">
        <TabsList>
          <TabsTrigger value="pending">
            🟡 Ожидают ({pending.length})
          </TabsTrigger>
          <TabsTrigger value="active">
            🟢 Активные ({active.length})
          </TabsTrigger>
          <TabsTrigger value="blocked">
            ⛔ Заблокированы ({blocked.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4 space-y-2">
          {isLoading && <Loader2 className="animate-spin" />}
          {!isLoading && pending.length === 0 && (
            <p className="text-sm text-muted-foreground p-4">Нет заявок.</p>
          )}
          {pending.map((u) => (
            <UserListRow key={u.user_id} user={u} onSelect={() => setEditing(u)} />
          ))}
        </TabsContent>

        <TabsContent value="active" className="mt-4 space-y-2">
          {active.map((u) => (
            <UserListRow key={u.user_id} user={u} onSelect={() => setEditing(u)} />
          ))}
        </TabsContent>

        <TabsContent value="blocked" className="mt-4 space-y-2">
          {blocked.length === 0 && <p className="text-sm text-muted-foreground p-4">Нет заблокированных.</p>}
          {blocked.map((u) => (
            <UserListRow key={u.user_id} user={u} onSelect={() => setEditing(u)} />
          ))}
        </TabsContent>
      </Tabs>

      <UserEditSheet
        user={editing}
        projects={projects}
        onClose={() => setEditing(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ["admin-users"] });
          setEditing(null);
        }}
      />
    </div>
  );
}

function UserListRow({ user, onSelect }: { user: UserRow; onSelect: () => void }) {
  const name = [user.first_name, user.last_name].filter(Boolean).join(" ") || user.full_name || user.email || "Без имени";
  const roleLabel = user.role ? ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role : "—";

  return (
    <Card className="border-border/60">
      <CardContent className="p-4 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
            {name.slice(0, 2).toUpperCase()}
          </div>
          <div className="min-w-0">
            <p className="font-medium truncate">{name}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {user.role && <Badge variant="secondary">{roleLabel}</Badge>}
          {user.status === "pending" && <Badge variant="outline" className="border-warning/40 text-warning">Ожидает</Badge>}
          {user.status === "blocked" && <Badge variant="destructive">Заблокирован</Badge>}
          <Button size="sm" variant="outline" onClick={onSelect}>Настроить</Button>
        </div>
      </CardContent>
    </Card>
  );
}

function UserEditSheet({
  user,
  projects,
  onClose,
  onSaved,
}: {
  user: UserRow | null;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [telegram, setTelegram] = useState("");
  const [position, setPosition] = useState("");
  const [role, setRole] = useState<AppRole>("seo");
  const [financeAccess, setFinanceAccess] = useState(false);
  const [onboardingAccess, setOnboardingAccess] = useState(false);
  const [knowledgeEdit, setKnowledgeEdit] = useState(false);
  const [allProjects, setAllProjects] = useState(false);
  const [linkedProjects, setLinkedProjects] = useState<Set<string>>(new Set());

  // Hydrate when user changes
  useEffect(() => {
    if (!user) return;
    setFirstName(user.first_name ?? "");
    setLastName(user.last_name ?? "");
    setPhone(user.phone ?? "");
    setTelegram(user.telegram ?? "");
    setPosition(user.position ?? "");
    setRole(user.role ?? "seo");
    setFinanceAccess(!!user.finance_access);
    setOnboardingAccess(!!user.onboarding_access);
    setKnowledgeEdit(!!user.knowledge_edit_access);
    setAllProjects(!!user.all_projects_access);
    setLinkedProjects(new Set());
    supabase
      .from("project_members")
      .select("project_id")
      .eq("user_id", user.user_id)
      .then(({ data }) => {
        if (data) setLinkedProjects(new Set(data.map((r) => r.project_id)));
      });
  }, [user?.user_id]);

  const reset = () => {
    setFirstName(""); setLastName(""); setPhone(""); setTelegram(""); setPosition("");
    setRole("seo"); setFinanceAccess(false); setOnboardingAccess(false);
    setKnowledgeEdit(false); setAllProjects(false); setLinkedProjects(new Set());
  };

  const save = useMutation({
    mutationFn: async (action: "approve" | "save" | "reject") => {
      if (!user) return;

      if (action === "reject") {
        const { error } = await supabase
          .from("profiles")
          .update({ status: "blocked" })
          .eq("user_id", user.user_id);
        if (error) throw error;
        return;
      }

      const status = action === "approve" || user.status === "active" ? "active" : user.status;

      const { error: pErr } = await supabase
        .from("profiles")
        .update({
          first_name: firstName || null,
          last_name: lastName || null,
          full_name: [firstName, lastName].filter(Boolean).join(" ") || null,
          phone: phone || null,
          telegram: telegram || null,
          position: position || null,
          status,
          finance_access: financeAccess,
          onboarding_access: onboardingAccess,
          knowledge_edit_access: knowledgeEdit,
          all_projects_access: allProjects,
          confirmed_at: action === "approve" ? new Date().toISOString() : undefined,
        })
        .eq("user_id", user.user_id);
      if (pErr) throw pErr;

      // Roles: upsert one role
      await supabase.from("user_roles").delete().eq("user_id", user.user_id);
      const { error: rErr } = await supabase.from("user_roles").insert({ user_id: user.user_id, role });
      if (rErr) throw rErr;

      // Auto-create / sync team_members record (so user appears in employees and can be assigned)
      if (status === "active" && user.email) {
        const { data: existingTm } = await supabase
          .from("team_members")
          .select("id")
          .eq("email", user.email)
          .is("archived_at", null)
          .maybeSingle();

        const fullName = [firstName, lastName].filter(Boolean).join(" ") || user.full_name || user.email;
        // team_members.role is constrained to 'seo' | 'account_manager'
        const tmRole = role === "manager" ? "account_manager" : "seo";

        if (!existingTm) {
          await supabase.from("team_members").insert({
            owner_id: user.user_id,
            full_name: fullName,
            email: user.email,
            phone: phone || null,
            role: tmRole,
            status: "active",
          } as any);
        } else {
          await supabase.from("team_members").update({
            full_name: fullName,
            phone: phone || null,
            role: tmRole,
            status: "active",
          } as any).eq("id", existingTm.id);
        }
      }

      // Project memberships
      await supabase.from("project_members").delete().eq("user_id", user.user_id);
      const toInsert = Array.from(linkedProjects).map((pid) => ({
        project_id: pid,
        user_id: user.user_id,
        team_member_id: user.user_id, // satisfy NOT NULL legacy column
        role: "member",
      }));
      if (toInsert.length > 0) {
        await supabase.from("project_members").insert(toInsert as any);
      }
    },
    onSuccess: (_d, action) => {
      toast.success(
        action === "approve" ? "Пользователь подтверждён" :
        action === "reject" ? "Заявка отклонена" : "Изменения сохранены"
      );
      reset();
      onSaved();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const open = !!user;
  const handleClose = () => { reset(); onClose(); };

  return (
    <Sheet open={open} onOpenChange={(o) => !o && handleClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle>{user?.email ?? "Пользователь"}</SheetTitle>
        </SheetHeader>

        <div className="space-y-5 mt-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Имя</Label>
              <Input value={firstName} onChange={(e) => setFirstName(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Фамилия</Label>
              <Input value={lastName} onChange={(e) => setLastName(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs"><Phone className="inline h-3 w-3 mr-1" />Телефон</Label>
              <Input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+7..." />
            </div>
            <div>
              <Label className="text-xs"><Send className="inline h-3 w-3 mr-1" />Telegram</Label>
              <Input value={telegram} onChange={(e) => setTelegram(e.target.value)} placeholder="@username" />
            </div>
          </div>

          <div>
            <Label className="text-xs">Должность</Label>
            <Input value={position} onChange={(e) => setPosition(e.target.value)} placeholder="SEO-специалист" />
          </div>

          <div>
            <Label className="text-xs flex items-center gap-1"><Shield className="h-3 w-3" />Роль в системе</Label>
            <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {ROLE_OPTIONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label} — <span className="text-muted-foreground text-xs">{r.desc}</span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2 border-t pt-4">
            <Label className="text-xs font-semibold">Дополнительные доступы</Label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={financeAccess} onCheckedChange={(v) => setFinanceAccess(!!v)} />
              Финансы
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={onboardingAccess} onCheckedChange={(v) => setOnboardingAccess(!!v)} />
              Онбординг
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={knowledgeEdit} onCheckedChange={(v) => setKnowledgeEdit(!!v)} />
              База знаний (редактирование)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={allProjects} onCheckedChange={(v) => setAllProjects(!!v)} />
              Все проекты (не только привязанные)
            </label>
          </div>

          {!allProjects && (
            <div className="space-y-2 border-t pt-4">
              <Label className="text-xs font-semibold">Привязка к проектам</Label>
              <div className="max-h-48 overflow-y-auto space-y-1.5 rounded-md border p-2">
                {projects.length === 0 && <p className="text-xs text-muted-foreground">Нет проектов.</p>}
                {projects.map((p) => (
                  <label key={p.id} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={linkedProjects.has(p.id)}
                      onCheckedChange={(v) => {
                        const next = new Set(linkedProjects);
                        if (v) next.add(p.id); else next.delete(p.id);
                        setLinkedProjects(next);
                      }}
                    />
                    {p.name}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex justify-between gap-2 pt-4 border-t sticky bottom-0 bg-background pb-2">
            {user?.status === "pending" ? (
              <>
                <Button variant="outline" onClick={() => save.mutate("reject")} disabled={save.isPending}>
                  <UserX className="h-4 w-4 mr-1" />Отклонить
                </Button>
                <Button onClick={() => save.mutate("approve")} disabled={save.isPending}>
                  {save.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <UserCheck className="h-4 w-4 mr-1" />}
                  Подтвердить
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={handleClose}>Отмена</Button>
                <Button onClick={() => save.mutate("save")} disabled={save.isPending}>
                  {save.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                  Сохранить
                </Button>
              </>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
