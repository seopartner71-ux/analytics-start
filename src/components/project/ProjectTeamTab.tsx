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
import { Bell, BellOff, MoreHorizontal, Trash2, Plus, Users, UserPlus } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const ROLES = [
  "SEO специалист",
  "Аккаунт-менеджер",
  "Руководитель проекта",
  "Наблюдатель",
  "Соисполнитель",
] as const;
type Role = (typeof ROLES)[number];

const ROLE_STYLES: Record<Role, string> = {
  "SEO специалист": "bg-emerald-900/40 text-emerald-300 border-emerald-800/60",
  "Аккаунт-менеджер": "bg-violet-900/40 text-violet-300 border-violet-800/60",
  "Руководитель проекта": "bg-blue-900/50 text-blue-300 border-blue-800/60",
  "Наблюдатель": "bg-gray-800/70 text-gray-300 border-gray-700/60",
  "Соисполнитель": "bg-amber-900/40 text-amber-300 border-amber-800/60",
};

interface Member {
  id: string;
  name: string;
  avatar: string;
  role: Role;
  notificationsEnabled: boolean;
}

const MOCK_CANDIDATES = [
  "Лейсан Габдрахманова",
  "Владимир Сорокин",
  "Анна Иванова",
  "Дмитрий Петров",
  "Екатерина Смирнова",
  "Артём Кузнецов",
  "Мария Орлова",
];

const avatarFor = (name: string) => {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://i.pravatar.cc/120?u=${hash}`;
};

const initialTeam: Member[] = [
  { id: "u1", name: "Владимир Сорокин", avatar: avatarFor("Владимир Сорокин"), role: "Руководитель проекта", notificationsEnabled: true },
  { id: "u2", name: "Лейсан Габдрахманова", avatar: avatarFor("Лейсан Габдрахманова"), role: "SEO специалист", notificationsEnabled: true },
  { id: "u3", name: "Анна Иванова", avatar: avatarFor("Анна Иванова"), role: "Аккаунт-менеджер", notificationsEnabled: false },
];

export function ProjectTeamTab() {
  const [projectTeam, setProjectTeam] = useState<Member[]>(initialTeam);
  const [addOpen, setAddOpen] = useState(false);

  // Add form state
  const [newName, setNewName] = useState("");
  const [newRole, setNewRole] = useState<Role>("SEO специалист");
  const [newNotify, setNewNotify] = useState(true);

  const toggleNotifications = (id: string) => {
    setProjectTeam((cur) =>
      cur.map((m) => (m.id === id ? { ...m, notificationsEnabled: !m.notificationsEnabled } : m))
    );
    toast.success("Настройки уведомлений обновлены");
  };

  const removeMember = (id: string) => {
    const m = projectTeam.find((x) => x.id === id);
    setProjectTeam((cur) => cur.filter((x) => x.id !== id));
    toast.success(`${m?.name ?? "Участник"} удалён из проекта`);
  };

  const handleAdd = () => {
    if (!newName) {
      toast.error("Выберите сотрудника");
      return;
    }
    if (projectTeam.some((m) => m.name === newName)) {
      toast.error("Этот сотрудник уже в проекте");
      return;
    }
    const newMember: Member = {
      id: crypto.randomUUID(),
      name: newName,
      avatar: avatarFor(newName),
      role: newRole,
      notificationsEnabled: newNotify,
    };
    setProjectTeam((cur) => [...cur, newMember]);
    setAddOpen(false);
    setNewName("");
    setNewRole("SEO специалист");
    setNewNotify(true);
    toast.success(`${newMember.name} добавлен в проект`);
  };

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
            Участники имеют доступ ко всем задачам данного проекта. Управляйте ролями и уведомлениями, чтобы избежать спама.
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
        {projectTeam.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">
            <Users className="h-8 w-8 mx-auto mb-3 opacity-40" />
            В проекте пока нет участников
          </div>
        )}

        {projectTeam.map((m) => (
          <div
            key={m.id}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted/20 transition-colors"
          >
            {/* Avatar + Name */}
            <img
              src={m.avatar}
              alt={m.name}
              className="h-10 w-10 rounded-full ring-1 ring-border/60 object-cover"
            />
            <div className="flex-1 min-w-0">
              <div className="text-[13.5px] font-medium text-foreground truncate">{m.name}</div>
              <div className="text-[11.5px] text-muted-foreground truncate">
                {m.notificationsEnabled ? "Получает уведомления" : "Уведомления отключены"}
              </div>
            </div>

            {/* Role badge */}
            <Badge
              variant="outline"
              className={cn(
                "text-[11.5px] px-2.5 py-1 font-medium border",
                ROLE_STYLES[m.role]
              )}
            >
              {m.role}
            </Badge>

            {/* Notification toggle */}
            <button
              onClick={() => toggleNotifications(m.id)}
              className={cn(
                "flex items-center gap-1.5 h-9 px-2.5 rounded-md border text-[12px] transition-colors",
                m.notificationsEnabled
                  ? "border-amber-500/40 text-amber-400 bg-amber-500/10 hover:bg-amber-500/15"
                  : "border-border/60 text-muted-foreground hover:bg-muted/40"
              )}
              title={m.notificationsEnabled ? "Уведомления включены" : "Без звука"}
            >
              {m.notificationsEnabled ? (
                <Bell className="h-4 w-4" />
              ) : (
                <BellOff className="h-4 w-4" />
              )}
              <span className="hidden md:inline">
                {m.notificationsEnabled ? "Уведомления включены" : "Без звука"}
              </span>
            </button>

            {/* Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-muted-foreground hover:text-foreground">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuItem
                  onClick={() => removeMember(m.id)}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Удалить из проекта
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ))}
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
              Выберите сотрудника, его роль и настройте уведомления.
            </DialogDescription>
          </DialogHeader>

          <div className="px-6 py-5 space-y-4">
            <div className="space-y-1.5">
              <Label className="text-[12px] font-medium text-foreground/80">Сотрудник</Label>
              <Select value={newName} onValueChange={setNewName}>
                <SelectTrigger className="h-9 text-[13px]">
                  <SelectValue placeholder="Выберите сотрудника" />
                </SelectTrigger>
                <SelectContent>
                  {MOCK_CANDIDATES.map((n) => (
                    <SelectItem key={n} value={n} className="text-[13px]">
                      {n}
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
            <Button variant="ghost" size="sm" className="h-9 text-[13px]" onClick={() => setAddOpen(false)}>
              Отмена
            </Button>
            <Button
              size="sm"
              className="h-9 text-[13px] bg-amber-500 hover:bg-amber-500/90 text-white gap-1.5"
              onClick={handleAdd}
              disabled={!newName}
            >
              <Plus className="h-4 w-4" /> Добавить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
