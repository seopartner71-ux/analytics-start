import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Loader2 } from "lucide-react";
import { format } from "date-fns";
import { MarkdownView } from "./MarkdownView";
import { getCategoryMeta } from "@/lib/knowledge-categories";

interface Props {
  articleId: string | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function ArticleSheet({ articleId, open, onOpenChange }: Props) {
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !articleId) return;
    setLoading(true);
    (async () => {
      const { data } = await supabase
        .from("knowledge_articles").select("*").eq("id", articleId).maybeSingle();
      setArticle(data);
      setLoading(false);
      // increment views
      await supabase.rpc("increment_article_views", { p_article_id: articleId });
    })();
  }, [articleId, open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="text-base">{article?.title || "Загрузка…"}</SheetTitle>
        </SheetHeader>
        {loading || !article ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Badge variant="secondary" className="text-[10px]">
                {getCategoryMeta(article.category).icon} {getCategoryMeta(article.category).label}
              </Badge>
              {(article.tags || []).map((t: string) => (
                <Badge key={t} variant="outline" className="text-[10px]">{t}</Badge>
              ))}
            </div>
            <div className="text-[11px] text-muted-foreground">
              Обновлено: {format(new Date(article.updated_at), "dd.MM.yyyy HH:mm")} • Просмотров: {article.views_count}
            </div>
            <div className="border-t pt-3">
              <MarkdownView source={article.content} />
            </div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
