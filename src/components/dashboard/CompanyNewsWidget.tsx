import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Megaphone, Pin, AlertCircle, MessageSquare, Plus, Pencil, Trash2 } from "lucide-react";
import { format, parseISO } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type NewsType = "important" | "pinned" | "normal";

interface NewsRow {
  id: string;
  title: string;
  body: string;
  type: NewsType;
  pinned: boolean;
  created_by: string;
  created_at: string;
}

const TYPE_META: Record<NewsType, { label: string; icon: typeof Megaphone; cls: string }> = {
  important: { label: "Важно", icon: AlertCircle, cls: "bg-destructive/15 text-destructive border-destructive/30" },
  pinned: { label: "Закреплено", icon: Pin, cls: "bg-warning/15 text-warning border-warning/30" },
  normal: { label: "Новость", icon: MessageSquare, cls: "bg-muted text-muted-foreground border-border" },
};

export default function CompanyNewsWidget() {
  const { user, isAdmin } = useAuth();
  const qc = useQueryClient();
  const [showAll, setShowAll] = useState(false);
  const [editing, setEditing] = useState<NewsRow | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<{ title: string; body: string; type: NewsType; pinned: boolean }>({
    title: "", body: "", type: "normal", pinned: false,
  });

  const { data: news = [] } = useQuery({
    queryKey: ["company-news"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_news")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as NewsRow[];
    },
  });

  const { data: reads = [] } = useQuery({
    queryKey: ["company-news-reads", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_news_reads")
        .select("news_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map(r => r.news_id);
    },
  });

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel("company-news-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "company_news" }, () => {
        qc.invalidateQueries({ queryKey: ["company-news"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "company_news_reads" }, () => {
        qc.invalidateQueries({ queryKey: ["company-news-reads"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  const sorted = useMemo(() => {
    const list = [...news];
    list.sort((a, b) => {
      const aPin = a.pinned || a.type === "pinned" ? 1 : 0;
      const bPin = b.pinned || b.type === "pinned" ? 1 : 0;
      if (aPin !== bPin) return bPin - aPin;
      const aImp = a.type === "important" ? 1 : 0;
      const bImp = b.type === "important" ? 1 : 0;
      if (aImp !== bImp) return bImp - aImp;
      return parseISO(b.created_at).getTime() - parseISO(a.created_at).getTime();
    });
    return list;
  }, [news]);

  const visible = showAll ? sorted : sorted.slice(0, 3);
  const unreadCount = useMemo(() => {
    const set = new Set(reads);
    return news.filter(n => !set.has(n.id)).length;
  }, [news, reads]);

  // Auto-mark visible as read
  useEffect(() => {
    if (!user || visible.length === 0) return;
    const set = new Set(reads);
    const unread = visible.filter(n => !set.has(n.id));
    if (unread.length === 0) return;
    supabase.from("company_news_reads").upsert(
      unread.map(n => ({ news_id: n.id, user_id: user.id })),
      { onConflict: "news_id,user_id" }
    ).then(() => qc.invalidateQueries({ queryKey: ["company-news-reads", user.id] }));
  }, [visible, reads, user, qc]);

  const upsertMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Вы не авторизованы");
      if (editing) {
        const { error } = await supabase.from("company_news").update({
          title: form.title, body: form.body, type: form.type, pinned: form.pinned,
        }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("company_news").insert({
          title: form.title, body: form.body, type: form.type, pinned: form.pinned, created_by: user.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-news"] });
      setOpen(false); setEditing(null);
      setForm({ title: "", body: "", type: "normal", pinned: false });
      toast.success(editing ? "Новость обновлена" : "Новость опубликована");
    },
    onError: (e: any) => toast.error(ruError(e, "Не удалось сохранить новость")),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("company_news").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["company-news"] });
      toast.success("Новость удалена");
    },
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ title: "", body: "", type: "normal", pinned: false });
    setOpen(true);
  };
  const openEdit = (n: NewsRow) => {
    setEditing(n);
    setForm({ title: n.title, body: n.body, type: n.type, pinned: n.pinned });
    setOpen(true);
  };

  return (
    <Card className="p-5 bg-card rounded-lg shadow-sm border border-border">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Новости компании</h3>
          {unreadCount > 0 && (
            <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">{unreadCount}</Badge>
          )}
        </div>
        {isAdmin && (
          <Button size="sm" variant="outline" className="h-7 gap-1 text-[12px]" onClick={openCreate}>
            <Plus className="h-3.5 w-3.5" /> Написать
          </Button>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="text-center py-8 text-[12px] text-muted-foreground">
          Новостей пока нет
        </div>
      ) : (
        <div className="space-y-3">
          {visible.map(n => {
            const meta = TYPE_META[n.type];
            const Icon = meta.icon;
            const isUnread = !reads.includes(n.id);
            return (
              <div
                key={n.id}
                className={cn(
                  "rounded-lg border p-3 transition-colors",
                  isUnread ? "border-accent/40 bg-accent/5" : "border-border bg-background/50"
                )}
              >
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className={cn("h-5 px-1.5 gap-1 text-[10px]", meta.cls)}>
                      <Icon className="h-3 w-3" /> {meta.label}
                    </Badge>
                    {n.pinned && n.type !== "pinned" && (
                      <Badge variant="outline" className="h-5 px-1.5 gap-1 text-[10px] bg-warning/10 text-warning border-warning/20">
                        <Pin className="h-3 w-3" />
                      </Badge>
                    )}
                    <span className="text-[11px] text-muted-foreground">
                      {format(parseISO(n.created_at), "d MMM", { locale: ruLocale })}
                    </span>
                  </div>
                  {isAdmin && (
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openEdit(n)}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive">
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить новость?</AlertDialogTitle>
                            <AlertDialogDescription>Действие нельзя отменить.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(n.id)}>Удалить</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
                <h4 className="text-[13px] font-semibold text-foreground mb-1">{n.title}</h4>
                {n.body && <p className="text-[12px] text-muted-foreground whitespace-pre-wrap">{n.body}</p>}
              </div>
            );
          })}
        </div>
      )}

      {sorted.length > 3 && (
        <Button
          variant="ghost"
          size="sm"
          className="w-full mt-3 text-[12px] text-accent"
          onClick={() => setShowAll(s => !s)}
        >
          {showAll ? "Свернуть" : `Показать все (${sorted.length}) →`}
        </Button>
      )}

      {/* Create / Edit dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Редактировать новость" : "Новая новость"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-[12px]">Заголовок</Label>
              <Input
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Например: Завтра созвон в 10:00"
              />
            </div>
            <div>
              <Label className="text-[12px]">Текст</Label>
              <Textarea
                rows={4}
                value={form.body}
                onChange={e => setForm(f => ({ ...f, body: e.target.value }))}
                placeholder="Подробности..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">Тип</Label>
                <Select value={form.type} onValueChange={(v: NewsType) => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">💬 Обычная</SelectItem>
                    <SelectItem value="pinned">📌 Закреплённая</SelectItem>
                    <SelectItem value="important">🔴 Важная</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <label className="flex items-center gap-2 text-[12px] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={e => setForm(f => ({ ...f, pinned: e.target.checked }))}
                  />
                  Закрепить вверху
                </label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
            <Button
              onClick={() => upsertMutation.mutate()}
              disabled={!form.title.trim() || upsertMutation.isPending}
            >
              {editing ? "Сохранить" : "Опубликовать"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
