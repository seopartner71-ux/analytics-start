import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2, Settings, ImagePlus, X } from "lucide-react";
import { ChatFormatToolbar } from "./ChatFormatToolbar";
import { EmojiPickerButton } from "@/components/EmojiPickerButton";
import { useAuth } from "@/contexts/AuthContext";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  conversationId: string;
  initialTitle: string;
  initialDescription: string;
  initialAvatarUrl: string | null;
  onSaved?: () => void;
}

export function ChatSettingsDialog({
  open,
  onOpenChange,
  conversationId,
  initialTitle,
  initialDescription,
  initialAvatarUrl,
  onSaved,
}: Props) {
  const { user } = useAuth();
  const [title, setTitle] = useState(initialTitle);
  const [description, setDescription] = useState(initialDescription);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const descRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (open) {
      setTitle(initialTitle);
      setDescription(initialDescription);
      setAvatarUrl(initialAvatarUrl);
      setAvatarFile(null);
      setAvatarPreview(null);
    }
  }, [open, initialTitle, initialDescription, initialAvatarUrl]);

  const onPickAvatar = (f: File | null) => {
    if (!f) return;
    if (f.size > 5 * 1024 * 1024) {
      toast.error("Файл больше 5 МБ");
      return;
    }
    setAvatarFile(f);
    setAvatarPreview(URL.createObjectURL(f));
  };

  const save = async () => {
    if (!title.trim()) {
      toast.error("Укажите название чата");
      return;
    }
    setSaving(true);
    try {
      let newAvatar = avatarUrl;
      if (avatarFile && user) {
        const ext = avatarFile.name.split(".").pop() || "png";
        const path = `chat-avatars/${user.id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("messenger")
          .upload(path, avatarFile, { contentType: avatarFile.type, upsert: false });
        if (upErr) {
          toast.error("Не удалось загрузить аватар");
          return;
        }
        const { data } = supabase.storage.from("messenger").getPublicUrl(path);
        newAvatar = data.publicUrl;
      }
      const { error } = await supabase
        .from("conversations")
        .update({
          title: title.trim(),
          description: description.trim() || null,
          avatar_url: newAvatar,
        } as never)
        .eq("id", conversationId);
      if (error) {
        toast.error("Не удалось сохранить: " + error.message);
        return;
      }
      toast.success("Изменения сохранены");
      onSaved?.();
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const preview = avatarPreview || avatarUrl;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings className="h-4 w-4" /> Настройки чата
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="relative h-16 w-16 rounded-full bg-muted border border-border/60 overflow-hidden flex items-center justify-center hover:bg-accent shrink-0"
            >
              {preview ? (
                <img src={preview} alt="" className="h-full w-full object-cover" />
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
              <p className="text-xs text-muted-foreground">Аватар чата</p>
              {(avatarPreview || avatarUrl) && (
                <button
                  type="button"
                  onClick={() => { setAvatarFile(null); setAvatarPreview(null); setAvatarUrl(null); }}
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

          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <ChatFormatToolbar textareaRef={descRef} value={description} onChange={setDescription} />
              <EmojiPickerButton size="sm" onSelect={(e) => setDescription((v) => v + e)} />
              <span className="ml-1 text-2xs text-muted-foreground">**жирный**, [текст](ссылка)</span>
            </div>
            <Textarea
              ref={descRef}
              placeholder="Описание чата. Можно вставить ссылку: [текст](https://...)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="resize-y min-h-[80px] text-sm"
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={save} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
