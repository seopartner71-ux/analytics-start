import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Bell, BellOff, MoreHorizontal, Trash2, Plus, Users, UserPlus, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const ROLES = [
  "SEO специалист",
  "Аккаунт-менеджер",
  "Руководитель проекта",
  "Наблюдатель",
  "Соисполнитель",
] as const;
type Role = (typeof ROLES)[number];

const ROLE_STYLES: Record<string, string> = {
  "SEO специалист": "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
  "Аккаунт-менеджер": "bg-violet-900/40 text-violet-300 border-violet-800/60",
  "Руководитель проекта": "bg-blue-900/50 text-blue-300 border-blue-800/60",
  "Наблюдатель": "bg-gray-800/70 text-gray-300 border-gray-700/60",
  "Соисполнитель": "bg-amber-900/40 text-amber-300 border-amber-800/60",
};

interface ProjectMemberRow {
  id: string;
  team_member_id: string;
  role: string;
  notifications_enabled: boolean;
  team_member?: { id: string; full_name: string; email: string | null; owner_id: string | null } | null;
}

const initialsOf = (name: string) =>
  name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

export function ProjectTeamTab({ projectId }: { projectId: string }) {
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [newTeamMemberId, setNewTeamMemberId] = useState<string>("");
  const [newRole, setNewRole] = useState<Role>("SEO специалист");
  const [newNotify, setNewNotify] = useState(true);

  // Текущие участники проекта
  const { data: members = [], isLoading } = useQuery<ProjectMemberRow[]>({
    queryKey: ["project-members", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_members")
        .select("id, team_member_id, role, notifications_enabled, team_member:team_members(id, full_name, email, owner_id)")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as any;
    },
  });

  // Аватарки реальных пользователей: тянем profiles по email участников
  const memberEmails = members.map((m) => m.team_member?.email).filter(Boolean) as string[];
  const memberOwnerIds = members.map((m) => m.team_member?.owner_id).filter(Boolean) as string[];
  const { data: avatarMap = {} } = useQuery<Record<string, string>>({
    queryKey: ["project-members-avatars", projectId, memberEmails.join(","), memberOwnerIds.join(",")],
    enabled: memberEmails.length > 0 || memberOwnerIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("user_id, email, avatar_url")
        .or([
          memberEmails.length ? `email.in.(${memberEmails.map((e) => `"${e}"`).join(",")})` : "",
          memberOwnerIds.length ? `user_id.in.(${memberOwnerIds.join(",")})` : "",
        ].filter(Boolean).join(","));
      const map: Record<string, string> = {};
      (data || []).forEach((p: any) => {
        if (!p.avatar_url) return;
        if (p.email) map[`email:${p.email.toLowerCase()}`] = p.avatar_url;
        if (p.user_id) map[`uid:${p.user_id}`] = p.avatar_url;
      });
      return map;
    },
  });

  const avatarUrlFor = (m: ProjectMemberRow) => {
    if (m.team_member?.owner_id && avatarMap[`uid:${m.team_member.owner_id}`]) return avatarMap[`uid:${m.team_member.owner_id}`];
    if (m.team_member?.email && avatarMap[`email:${m.team_member.email.toLowerCase()}`]) return avatarMap[`email:${m.team_member.email.toLowerCase()}`];
    return null;
  };

  // Все сотрудники для выбора
  const { data: allMembers = [] } = useQuery({
    queryKey: ["team-members-all"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name").order("full_name");
      return data || [];
    },
  });

  const availableCandidates = allMembers.filter(
    (m) => !members.some((pm) => pm.team_member_id === m.id)
  );

  const addMember = useMutation({
    mutationFn: async () => {
      if (!newTeamMemberId) throw new Error("Выберите сотрудника");
      const { error } = await supabase.from("project_members").insert({
        project_id: projectId,
        team_member_id: newTeamMemberId,
        role: newRole,
        notifications_enabled: newNotify,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] });
      qc.invalidateQueries({ queryKey: ["project-chat-participants", projectId] });
      const name = allMembers.find((m) => m.id === newTeamMemberId)?.full_name || "Сотрудник";
      toast.success(`${name} добавлен(а) в проект и в чат`);
      setAddOpen(false);
      setNewTeamMemberId("");
      setNewRole("SEO специалист");
      setNewNotify(true);
    },
    onError: (e: any) => toast.error(e.message || "Не удалось добавить участника"),
  });

  const toggleNotifications = useMutation({
    mutationFn: async (m: ProjectMemberRow) => {
      const { error } = await supabase
        .from("project_members")
        .update({ notifications_enabled: !m.notifications_enabled })
        .eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      toast.success("Настройки уведомлений обновлены");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const removeMember = useMutation({
    mutationFn: async (m: ProjectMemberRow) => {
      const { error } = await supabase.from("project_members").delete().eq("id", m.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-members", projectId] });
      qc.invalidateQueries({ queryKey: ["project-messages", projectId] });
      qc.invalidateQueries({ queryKey: ["project-chat-participants", projectId] });
      toast.success("Участник удалён из проекта");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5 p-1">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
              <Users className="h-4 w-4" />
            </span>
            <h2 className="text-[18px] font-semibold tracking-tight">Команда проекта</h2>
          </div>
          <p className="text-[12.5px] text-muted-foreground max-w-xl">
            Участники имеют доступ ко всем задачам данного проекта и автоматически добавляются в чат проекта.
          </p>
        </div>
        <Button
          size="sm"
          className="h-9 text-[13px] bg-amber-500 hover:bg-amber-500/90 text-white gap-1.5"
          onClick={() => setAddOpen(true)}
        >
          <Plus className="h-4 w-4" /> Добавить участника
        </Button>
      </div>

      {/* Team list */}
      <Card className="bg-card border-border/60 divide-y divide-border/50 overflow-hidden">
        {isLoading ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Loader2 className="h-5 w-5 mx-auto mb-2 animate-spin opacity-50" />
            Загрузка...
          </div>
        ) : members.length === 0 ? (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
            В проекте пока нет участников
          </div>
        ) : (
          members.map((m) => {
            const name = m.team_member?.full_name || "Без имени";
            return (
              <div
                key={m.id}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
              >
                <img
                  src={avatarFor(name)}
                  alt={name}
                  className="h-10 w-10 rounded-full ring-1 ring-border/60 object-cover"
                />
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-medium text-foreground truncate">{name}</div>
                  <div className="text-[11.5px] text-muted-foreground truncate">
                    {m.notifications_enabled ? "Получает уведомления" : "Уведомления отключены"}
                  </div>
                </div>

                <Badge
                  variant="outline"
                  className={cn(
                    "text-[11.5px] px-2.5 py-1 font-medium border",
                    ROLE_STYLES[m.role] || ROLE_STYLES["Наблюдатель"]
                  )}
                >
                  {m.role}
                </Badge>

                <button
                  onClick={() => toggleNotifications.mutate(m)}
                  disabled={toggleNotifications.isPending}
                  className={cn(
                    "flex items-center gap-1.5 h-9 px-2.5 rounded-md border text-[12px] transition-colors",
                    m.notifications_enabled
                      ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/15"
                      : "border-border/60 text-muted-foreground hover:bg-muted/40"
                  )}
                  title={m.notifications_enabled ? "Уведомления включены" : "Без звука"}
                >
                  {m.notifications_enabled ? <Bell className="h-4 w-4" /> : <BellOff className="h-4 w-4" />}
                  <span className="hidden md:inline">
                    {m.notifications_enabled ? "Уведомления включены" : "Без звука"}
                  </span>
                </button>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-44">
                    <DropdownMenuItem
                      onClick={() => removeMember.mutate(m)}
                      className="text-destructive focus:text-destructive gap-2"
                    >
                      <Trash2 className="h-3.5 w-3.5" /> Удалить из проекта
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })
        )}
      </Card>

      {/* Add member modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-[480px] p-0 overflow-hidden bg-card border-border/70">
          <DialogHeader className="px-6 pt-5 pb-4 border-b border-border/60 bg-gradient-to-r from-primary/[0.05] to-transparent space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-[16px] font-semibold tracking-tight">
              <span className="h-7 w-7 rounded-lg bg-primary/15 text-primary flex items-center justify-center">
                <UserPlus className="h-4 w-4" />
              </span>
              Добавление в проект
            </DialogTitle>
            <DialogDescription className="text-[12px] text-muted-foreground">
              Сотрудник появится в команде и автоматически будет добавлен в чат проекта.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground/80">Сотрудник</Label>
              <Select value={newTeamMemberId} onValueChange={setNewTeamMemberId}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder={availableCandidates.length ? "Выберите сотрудника" : "Все сотрудники уже в проекте"} />
                </SelectTrigger>
                <SelectContent>
                  {availableCandidates.map((m) => (
                    <SelectItem key={m.id} value={m.id} className="text-[13px]">
                      {m.full_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground/80">Роль в проекте</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as Role)}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ROLES.map((r) => (
                    <SelectItem key={r} value={r} className="text-[13px]">
                      {r}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-start justify-between gap-3 rounded-lg border border-border/60 bg-muted/20 px-3 py-3">
              <div className="space-y-0.5 flex-1">
                <Label className="text-[13px] font-medium text-foreground">Присылать уведомления</Label>
                <p className="text-[11.5px] text-muted-foreground leading-snug">
                  Оповещать о создании, выполнении и закрытии задач в этом проекте.
                </p>
              </div>
              <Switch checked={newNotify} onCheckedChange={setNewNotify} />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border/60 bg-muted/30 flex items-center justify-end gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-9 text-[13px]"
              onClick={() => setAddOpen(false)}
              disabled={addMember.isPending}
            >
              Отмена
            </Button>
            <Button
              size="sm"
              className="h-9 text-[13px] bg-amber-500 hover:bg-amber-500/90 text-white gap-1.5"
              onClick={() => addMember.mutate()}
              disabled={!newTeamMemberId || addMember.isPending}
            >
              {addMember.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
