import { ruError } from "@/lib/error-messages";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Plus, FileText, X, ChevronRight } from "lucide-react";
import { ArticleSheet } from "./ArticleSheet";
import { ArticlePicker } from "./ArticlePicker";
import { toast } from "sonner";

interface Props {
  taskId: string;
  /** "onboarding_task" (per-project) | "onboarding_template" (global) */
  scope: "onboarding_task" | "onboarding_template";
  canEdit?: boolean;
}

export function RelatedArticles({ taskId, scope, canEdit }: Props) {
  const { isAdmin } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const table = scope === "onboarding_task" ? "onboarding_task_articles" : "onboarding_template_articles";
  const fk = scope === "onboarding_task" ? "task_id" : "template_id";

  const load = async () => {
    const { data } = await supabase
      .from(table as any)
      .select("article_id, knowledge_articles(id,title)")
      .eq(fk, taskId);
    setItems((data || []).map((r: any) => r.knowledge_articles).filter(Boolean));
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [taskId, scope]);

  const handleConfirm = async (ids: string[]) => {
    const current = new Set(items.map((i) => i.id));
    const next = new Set(ids);
    const toAdd = ids.filter((id) => !current.has(id));
    const toRemove = [...current].filter((id) => !next.has(id));
    if (toAdd.length) {
      const { error } = await supabase.from(table as any)
        .insert(toAdd.map((id) => ({ [fk]: taskId, article_id: id })));
      if (error) toast.error(ruError(error, "Не удалось привязать статью"));
    }
    if (toRemove.length) {
      const { error } = await supabase.from(table as any).delete()
        .eq(fk, taskId).in("article_id", toRemove);
      if (error) toast.error(ruError(error, "Не удалось отвязать статью"));
    }
    load();
  };

  const editable = canEdit ?? isAdmin;

  return (
    <div className="rounded-md border bg-muted/30 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[12px] font-medium flex items-center gap-1.5">
          📚 Связанные инструкции
        </div>
        {editable && (
          <Button size="sm" variant="ghost" className="h-6 text-[11px] gap-1" onClick={() => setPickerOpen(true)}>
            <Plus className="h-3 w-3" /> Прикрепить
          </Button>
        )}
      </div>
      {items.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Нет прикреплённых статей</div>
      ) : (
        <div className="space-y-1">
          {items.map((a) => (
            <button
              key={a.id}
              onClick={() => setOpenId(a.id)}
              className="flex items-center justify-between w-full text-left text-[12px] px-2 py-1.5 rounded hover:bg-background transition"
            >
              <span className="flex items-center gap-2 min-w-0">
                <FileText className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span className="truncate">{a.title}</span>
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          ))}
        </div>
      )}
      <ArticleSheet articleId={openId} open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} />
      <ArticlePicker open={pickerOpen} onOpenChange={setPickerOpen} selected={items.map((i) => i.id)} onConfirm={handleConfirm} />
    </div>
  );
}
