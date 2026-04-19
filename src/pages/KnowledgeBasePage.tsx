import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BookOpen, Plus, Search, Edit, Trash2, Eye } from "lucide-react";
import { KNOWLEDGE_CATEGORIES, getCategoryMeta } from "@/lib/knowledge-categories";
import { ArticleSheet } from "@/components/knowledge/ArticleSheet";
import { ArticleEditor } from "@/components/knowledge/ArticleEditor";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { toast } from "sonner";

export default function KnowledgeBasePage() {
  const { user, isAdmin, isManager } = useAuth();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeCat, setActiveCat] = useState<string>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const canCreate = isAdmin || isManager;

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("knowledge_articles").select("*").order("updated_at", { ascending: false });
    setArticles(data || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    return articles.filter((a) => {
      if (activeCat !== "all" && a.category !== activeCat) return false;
      if (!q) return true;
      return a.title.toLowerCase().includes(q)
        || (a.content || "").toLowerCase().includes(q)
        || (a.tags || []).some((t: string) => t.toLowerCase().includes(q));
    });
  }, [articles, search, activeCat]);

  const counts = useMemo(() => {
    const m: Record<string, number> = { all: articles.length };
    KNOWLEDGE_CATEGORIES.forEach((c) => { m[c.value] = articles.filter((a) => a.category === c.value).length; });
    return m;
  }, [articles]);

  const canEditArticle = (a: any) => isAdmin || (isManager && a.author_id === user?.id);

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить статью?")) return;
    const { error } = await supabase.from("knowledge_articles").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Удалено");
    load();
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">База знаний</h1>
            <p className="text-sm text-muted-foreground">Внутренняя вики компании</p>
          </div>
        </div>
        {canCreate && (
          <Button onClick={() => { setEditId(null); setEditorOpen(true); }} className="gap-1.5">
            <Plus className="h-4 w-4" /> Новая статья
          </Button>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Поиск по базе знаний..." className="pl-9" />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setActiveCat("all")}
          className={cn(
            "px-3 py-1.5 rounded-full text-[12px] border transition",
            activeCat === "all" ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
          )}
        >
          Все ({counts.all || 0})
        </button>
        {KNOWLEDGE_CATEGORIES.map((c) => (
          <button
            key={c.value}
            onClick={() => setActiveCat(c.value)}
            className={cn(
              "px-3 py-1.5 rounded-full text-[12px] border transition",
              activeCat === c.value ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted"
            )}
          >
            {c.icon} {c.label} ({counts[c.value] || 0})
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center text-muted-foreground py-10 text-sm">Загрузка…</div>
      ) : filtered.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">Статей не найдено</Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map((a) => {
            const meta = getCategoryMeta(a.category);
            return (
              <Card key={a.id} className="p-4 hover:border-primary/50 transition group">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <Badge variant="secondary" className="text-[10px]">{meta.icon} {meta.label}</Badge>
                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition">
                    {canEditArticle(a) && (
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { setEditId(a.id); setEditorOpen(true); }}>
                        <Edit className="h-3 w-3" />
                      </Button>
                    )}
                    {isAdmin && (
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => handleDelete(a.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </div>
                <button onClick={() => setOpenId(a.id)} className="text-left w-full">
                  <h3 className="text-[14px] font-medium mb-1 hover:text-primary transition line-clamp-2">{a.title}</h3>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {(a.tags || []).slice(0, 3).map((t: string) => (
                      <span key={t} className="text-[10px] text-muted-foreground">#{t}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{format(new Date(a.updated_at), "dd.MM.yyyy")}</span>
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{a.views_count}</span>
                  </div>
                </button>
              </Card>
            );
          })}
        </div>
      )}

      <ArticleSheet articleId={openId} open={!!openId} onOpenChange={(v) => !v && setOpenId(null)} />
      <ArticleEditor open={editorOpen} onOpenChange={setEditorOpen} articleId={editId} onSaved={load} />
    </div>
  );
}
