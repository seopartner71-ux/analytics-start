import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Users, UserPlus, X, Search } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type Role = "accomplice" | "auditor";

const ROLE_META: Record<Role, { label: string; hint: string; cls: string }> = {
  accomplice: {
    label: "Соисполнитель",
    hint: "Помогает выполнять задачу. Может менять статус «В работе».",
    cls: "bg-amber-500/10 text-amber-600 border-amber-500/20",
  },
  auditor: {
    label: "Наблюдатель",
    hint: "Только просмотр и комментарии.",
    cls: "bg-sky-500/10 text-sky-600 border-sky-500/20",
  },
};

function getAvatarUrl(name: string) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://i.pravatar.cc/80?u=${hash}`;
}

interface Props {
  taskId: string;
  taskOwnerId: string;
  creatorTeamMemberId?: string | null;
  canManage: boolean;
}

type MemberRow = {
  id: string;
  team_member_id: string;
  role: Role;
  team_members?: { id: string; full_name: string; owner_id: string | null } | null;
};

export function TaskMembersBlock({ taskId, taskOwnerId, creatorTeamMemberId, canManage }: Props) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerRole, setPickerRole] = useState<Role>("accomplice");
  const [search, setSearch] = useState("");

  const { data: rows = [] } = useQuery({
    queryKey: ["task-members", taskId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_members")
        .select("id, team_member_id, role, team_members!task_members_team_member_id_fkey(id, full_name, owner_id)")
        .eq("task_id", taskId);
      if (error) throw error;
      return (data ?? []) as unknown as MemberRow[];
    },
  });

  const { data: allMembers = [] } = useQuery({
    queryKey: ["team-members-picker"],
    queryFn: async () => {
      const { data } = await supabase
        .from("team_members")
        .select("id, full_name, owner_id")
        .order("full_name");
      return data ?? [];
    },
  });

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel(`task-members-${taskId}-${Date.now()}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "task_members", filter: `task_id=eq.${taskId}` },
        () => queryClient.invalidateQueries({ queryKey: ["task-members", taskId] })
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [taskId, queryClient]);

  const addMember = useMutation({
    mutationFn: async ({ teamMemberId, role }: { teamMemberId: string; role: Role }) => {
      const { error } = await supabase.from("task_members").insert({
        task_id: taskId,
        team_member_id: teamMemberId,
        role,
        added_by: user?.id ?? null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-members", taskId] });
      setPickerOpen(false);
      setSearch("");
      toast.success("Участник добавлен");
    },
    onError: (e: any) => {
      const msg = e?.message ?? "Не удалось добавить";
      if (msg.includes("duplicate") || msg.includes("unique")) {
        toast.error("Этот участник уже добавлен с такой ролью");
      } else {
        toast.error(msg);
      }
    },
  });

  const removeMember = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("task_members").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["task-members", taskId] });
      toast.success("Участник удалён");
    },
    onError: (e: any) => toast.error(e?.message ?? "Не удалось удалить"),
  });

  const accomplices = rows.filter((r) => r.role === "accomplice");
  const auditors = rows.filter((r) => r.role === "auditor");

  // Исключаем уже добавленных в выбранной роли + создателя (он и так постановщик)
  const usedIds = new Set(rows.filter((r) => r.role === pickerRole).map((r) => r.team_member_id));
  const filteredCandidates = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allMembers.filter((m) => {
      if (usedIds.has(m.id)) return false;
      if (creatorTeamMemberId && m.id === creatorTeamMemberId) return false;
      if (q && !m.full_name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [allMembers, usedIds, creatorTeamMemberId, search]);

  const renderRow = (r: MemberRow) => {
    const name = r.team_members?.full_name ?? "Участник";
    return (
      <div
        key={r.id}
        className="flex items-center gap-2.5 py-1.5 px-2 rounded-lg hover:bg-muted/30 transition-colors"
      >
        <img
          src={getAvatarUrl(name)}
          alt={name}
          className="h-7 w-7 rounded-full ring-1 ring-border/60 object-cover"
        />
        <span className="text-sm flex-1 truncate text-foreground">{name}</span>
        <Badge variant="outline" className={cn("text-[10px] h-5", ROLE_META[r.role].cls)}>
          {ROLE_META[r.role].label}
        </Badge>
        {canManage && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-destructive"
            onClick={() => removeMember.mutate(r.id)}
            disabled={removeMember.isPending}
            title="Удалить"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    );
  };

  return (
    <Card className="bg-card shadow-sm border-border/60 rounded-xl">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-foreground">Участники</span>
            <span className="text-xs text-muted-foreground">{rows.length}</span>
          </div>
          {canManage && (
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
                  <UserPlus className="h-3.5 w-3.5" /> Добавить
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-72 p-3 space-y-2" align="end">
                <div className="space-y-1.5">
                  <span className="text-[11px] uppercase tracking-wide text-muted-foreground">Роль</span>
                  <Select value={pickerRole} onValueChange={(v) => setPickerRole(v as Role)}>
                    <SelectTrigger className="h-8 text-sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="accomplice">Соисполнитель</SelectItem>
                      <SelectItem value="auditor">Наблюдатель</SelectItem>
                    </SelectContent>
                  </Select>
                  <p className="text-[11px] text-muted-foreground leading-snug">
                    {ROLE_META[pickerRole].hint}
                  </p>
                </div>
                <div className="relative">
                  <Search className="absolute left-2 top-2 h-3.5 w-3.5 text-muted-foreground" />
                  <Input
                    placeholder="Поиск..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="h-8 pl-7 text-sm"
                  />
                </div>
                <div className="max-h-56 overflow-y-auto space-y-0.5 -mx-1">
                  {filteredCandidates.length === 0 ? (
                    <div className="text-xs text-muted-foreground text-center py-3">
                      Никого не найдено
                    </div>
                  ) : (
                    filteredCandidates.map((m) => (
                      <button
                        key={m.id}
                        className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-muted/60 transition-colors text-left"
                        onClick={() => addMember.mutate({ teamMemberId: m.id, role: pickerRole })}
                        disabled={addMember.isPending}
                      >
                        <img src={getAvatarUrl(m.full_name)} alt="" className="h-6 w-6 rounded-full" />
                        <span className="text-sm truncate flex-1">{m.full_name}</span>
                      </button>
                    ))
                  )}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="text-xs text-muted-foreground italic px-2 py-1">
            Пока никого. {canManage ? "Добавьте соисполнителей и наблюдателей." : ""}
          </div>
        ) : (
          <div className="space-y-3">
            {accomplices.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2">
                  Соисполнители · {accomplices.length}
                </div>
                {accomplices.map(renderRow)}
              </div>
            )}
            {auditors.length > 0 && (
              <div className="space-y-0.5">
                <div className="text-[10px] uppercase tracking-wide text-muted-foreground px-2">
                  Наблюдатели · {auditors.length}
                </div>
                {auditors.map(renderRow)}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
