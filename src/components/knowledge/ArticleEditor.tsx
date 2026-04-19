import { useEffect, useState } from "react";
import MDEditor from "@uiw/react-md-editor";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { KNOWLEDGE_CATEGORIES } from "@/lib/knowledge-categories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  articleId?: string | null;
  onSaved: () => void;
}

export function ArticleEditor({ open, onOpenChange, articleId, onSaved }: Props) {
  const { user } = useAuth();
  const { theme } = useTheme();
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState<string>("tech_seo");
  const [tagsInput, setTagsInput] = useState("");
  const [content, setContent] = useState<string>("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!articleId) {
      setTitle(""); setCategory("tech_seo"); setTagsInput("");
      setContent(`## Что это\n\n## Стандарт компании\n\n## Чеклист\n\n- [ ] \n\n## Частые ошибки\n\n## Полезные ссылки\n`);
      return;
    }
    (async () => {
      const { data } = await supabase.from("knowledge_articles").select("*").eq("id", articleId).maybeSingle();
      if (data) {
        setTitle(data.title); setCategory(data.category);
        setTagsInput((data.tags || []).join(", "));
        setContent(data.content || "");
      }
    })();
  }, [open, articleId]);

  const handleSave = async () => {
    if (!user || !title.trim()) { toast.error("Введите заголовок"); return; }
    setSaving(true);
    const tags = tagsInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (articleId) {
      const { error } = await supabase.from("knowledge_articles")
        .update({ title, category, tags, content, updated_by: user.id }).eq("id", articleId);
      if (error) { toast.error(error.message); setSaving(false); return; }
    } else {
      const { error } = await supabase.from("knowledge_articles")
        .insert({ title, category, tags, content, author_id: user.id });
      if (error) { toast.error(error.message); setSaving(false); return; }
    }
    setSaving(false);
    toast.success("Сохранено");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{articleId ? "Редактировать статью" : "Новая статья"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-[12px]">Заголовок *</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Как настроить Robots.txt" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-[12px]">Категория</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {KNOWLEDGE_CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-[12px]">Теги (через запятую)</Label>
              <Input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="robots.txt, индексация" />
            </div>
          </div>
          <div data-color-mode={theme === "dark" ? "dark" : "light"}>
            <Label className="text-[12px]">Содержимое</Label>
            <MDEditor value={content} onChange={(v) => setContent(v || "")} height={400} preview="edit" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}Сохранить
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
