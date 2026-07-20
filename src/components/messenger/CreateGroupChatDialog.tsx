import { useMemo, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { UserAvatar } from "@/components/UserAvatar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { Loader2, Users, ImagePlus, X } from "lucide-react";
import { ChatFormatToolbar } from "./ChatFormatToolbar";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";

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
  employees: Profile[];
  onCreated: (conversationId: string) => void;
}

export function CreateGroupChatDialog({ open, onOpenChange, employees, onCreated }: Props) {
  const { user, profile } = useAuth();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  const filtered = useMemo(() => {
    if (!search) return employees;
    const s = search.toLowerCase();
    return employees.filter(
      (e) => (e.full_name || "").toLowerCase().includes(s) || e.email.toLowerCase().includes(s),
    );
  }, [employees, search]);

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const reset = () => {
    setTitle("");
    setDescription("");
    setSearch("");
    setSelected(new Set());
    setAvatarFile(null);
    setAvatarPreview(null);
  };

  const onPickAvatar = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 МБ");
      return;
    }
    setAvatarFile(f);
    const url = URL.createObjectURL(f);
    setAvatarPreview(url);
  };

  const uploadAvatar = async (): Promise<string | null> => {
    if (!avatarFile || !user) return null;
    const ext = avatarFile.name.split(".").pop() || "png";
    const path = `chat-avatars/${user.id}/${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from("messenger").upload(path, avatarFile, {
      contentType: avatarFile.type,
      upsert: false,
    });
    if (error) {
      toast.error("Не удалось загрузить аватар");
      return null;
    }
    const { data } = supabase.storage.from("messenger").getPublicUrl(path);
    return data.publicUrl;
  };

  const create = async () => {
    if (!user) return;
    if (!title.trim()) {
      toast.error("Укажите название чата");
      return;
    }
    if (selected.size === 0) {
      toast.error("Выберите хотя бы одного участника");
      return;
    }
    setCreating(true);
    try {
      const avatar_url = await uploadAvatar();
      const { data: conv, error } = await supabase
        .from("conversations")
        .insert({
          type: "group",
          title: title.trim(),
          description: description.trim() || null,
          avatar_url,
          created_by: user.id,
        } as never)
        .select("id")
        .single();
      if (error || !conv) {
        toast.error("Не удалось создать чат: " + (error?.message || ""));
        return;
      }
      const rows = [user.id, ...Array.from(selected)].map((uid) => ({
        conversation_id: conv.id,
        user_id: uid,
      }));
      const { error: pErr } = await supabase.from("conversation_participants").insert(rows);
      if (pErr) {
        toast.error("Не удалось добавить участников");
        return;
      }
      await supabase.from("dm_messages").insert({
        conversation_id: conv.id,
        user_id: user.id,
        user_name: profile?.full_name || profile?.email || "Система",
        body: `Чат «${title.trim()}» создан`,
        is_system: true,
      });
      toast.success("Чат создан");
      reset();
      onOpenChange(false);
      onCreated(conv.id);
    } finally {
      setCreating(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) reset(); onOpenChange(v); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> Новый чат
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {/* Avatar */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-16 w-16 rounded-full bg-muted border border-border/60 overflow-hidden flex items-center justify-center hover:bg-accent transition-colors shrink-0"
              title="Загрузить аватар"
            >
              {avatarPreview ? (
                <img src={avatarPreview} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImagePlus className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onPickAvatar(e.target.files?.[0] ?? null)}
            />
            <div className="flex-1 space-y-1">
              <p className="text-xs text-muted-foreground">Аватар чата (необязательно)</p>
              {avatarPreview && (
                <button
                  type="button"
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null); }}
                  className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1"
                >
                  <X className="h-3 w-3" /> Убрать
                </button>
              )}
            </div>
          </div>

          <Input
            placeholder="Название чата"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          {/* Description with format toolbar */}
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <ChatFormatToolbar textareaRef={descRef} value={description} onChange={setDescription} />
              <EmojiPickerButton size="sm" onSelect={(e) => setDescription((v) => v + e)} />
              <span className="ml-1 text-2xs text-muted-foreground">**жирный**, [текст](ссылка)</span>
            </div>
            <Textarea
              ref={descRef}
              placeholder="Описание чата (необязательно). Можно вставить ссылку: [текст](https://...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="resize-y min-h-[60px] text-sm"
            />
          </div>

          <Input
            placeholder="Поиск сотрудников..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {selected.size > 0 && (
            <p className="text-xs text-muted-foreground">Выбрано: {selected.size}</p>
          )}
          <ScrollArea className="h-48 border border-border/60 rounded">
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
                  Никого не найдено
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={creating}>
            Отмена
          </Button>
          <Button onClick={create} disabled={creating}>
            {creating && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Создать
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
