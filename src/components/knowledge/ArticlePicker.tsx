import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { supabase } from "@/integrations/supabase/client";
import { getCategoryMeta } from "@/lib/knowledge-categories";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  selected: string[];
  onConfirm: (ids: string[]) => void;
}

export function ArticlePicker({ open, onOpenChange, selected, onConfirm }: Props) {
  const [articles, setArticles] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!open) return;
    setPicked(new Set(selected));
    (async () => {
      const { data } = await supabase
        .from("knowledge_articles").select("id,title,category").order("title");
      setArticles(data || []);
    })();
  }, [open, selected]);

  const toggle = (id: string) => {
    const next = new Set(picked);
    next.has(id) ? next.delete(id) : next.add(id);
    setPicked(next);
  };

  const filtered = articles.filter((a) =>
    a.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Прикрепить инструкцию</DialogTitle>
        </DialogHeader>
        <Input placeholder="Поиск..." value={search} onChange={(e) => setSearch(e.target.value)} />
        <ScrollArea className="h-[400px]">
          <div className="space-y-1">
            {filtered.map((a) => {
              const meta = getCategoryMeta(a.category);
              return (
                <label key={a.id} className="flex items-center gap-2 p-2 rounded hover:bg-muted cursor-pointer">
                  <Checkbox checked={picked.has(a.id)} onCheckedChange={() => toggle(a.id)} />
                  <span className="text-[12px]">{meta.icon}</span>
                  <span className="text-[13px] flex-1">{a.title}</span>
                </label>
              );
            })}
            {filtered.length === 0 && (
              <div className="text-center text-muted-foreground text-[12px] py-6">Ничего не найдено</div>
            )}
          </div>
        </ScrollArea>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => { onConfirm([...picked]); onOpenChange(false); }}>Прикрепить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
