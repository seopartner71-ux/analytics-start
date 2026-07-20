import { useMemo, useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, UserPlus } from "lucide-react";

interface Profile {
  user_id: string;
  full_name: string | null;
  email: string;
  avatar_url: string | null;
  position: string | null;
}

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  employees: Profile[];
  existingUserIds: string[];
  onAdded?: () => void;
}

/** Диалог добавления участников в существующий чат (для админа/создателя). */
export function AddParticipantsDialog({
  open,
  onOpenChange,
  conversationId,
  employees,
  existingUserIds,
  onAdded,
}: Props) {
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(new Set());
    }
  }, [open]);

  const existingSet = useMemo(() => new Set(existingUserIds), [existingUserIds]);
  const available = useMemo(() => employees.filter((e) => !existingSet.has(e.user_id)), [employees, existingSet]);

  const filtered = useMemo(() => {
    if (!search) return available;
    const s = search.toLowerCase();
    return available.filter(
      (e) => (e.full_name || "").toLowerCase().includes(s) || e.email.toLowerCase().includes(s),
    );
  }, [available, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const save = async () => {
    if (selected.size === 0) {
      toast.error("Выберите участников");
      return;
    }
    setSaving(true);
    try {
      const rows = Array.from(selected).map((uid) => ({
        conversation_id: conversationId,
        user_id: uid,
      }));
      const { error } = await supabase.from("conversation_participants").insert(rows);
      if (error) {
        toast.error("Не удалось добавить: " + error.message);
        return;
      }
      toast.success("Участники добавлены");
      onAdded?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4" /> Добавить участников
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <Input
            placeholder="Поиск..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoFocus
          />
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground">Выбрано: {selected.size}</p>
          )}
          <ScrollArea className="h-64 border border-border/60 rounded">
            <div className="py-1">
              {filtered.map((e) => {
                const checked = selected.has(e.user_id);
                return (
                  <label
                    key={e.user_id}
                    className="flex items-center gap-2 px-3 py-2 hover:bg-accent cursor-pointer"
                  >
                    <Checkbox checked={checked} onCheckedChange={() => toggle(e.user_id)} />
                    <UserAvatar
                      avatarUrl={e.avatar_url}
                      name={e.full_name || e.email}
                      seed={e.user_id}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{e.full_name || e.email}</p>
                      {e.position && (
                        <p className="text-xs text-muted-foreground truncate">{e.position}</p>
                      )}
                    </div>
                  </label>
                );
              })}
              {filtered.length === 0 && (
                <p className="px-4 py-6 text-center text-xs text-muted-foreground">
                  Нет доступных сотрудников
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Добавить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
