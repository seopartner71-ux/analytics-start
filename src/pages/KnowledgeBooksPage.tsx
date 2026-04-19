import { useEffect, useRef, useState } from "react";
import { Upload, FileText, Loader2, Trash2, CheckCircle2, AlertCircle, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Book = {
  id: string;
  title: string;
  file_name: string;
  pages_count: number;
  chunks_count: number;
  status: "processing" | "ready" | "failed";
  error_message: string | null;
  created_at: string;
};

export default function KnowledgeBooksPage() {
  const [books, setBooks] = useState<Book[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [title, setTitle] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("knowledge_books").select("*").order("created_at", { ascending: false });
    setBooks((data as Book[]) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleUpload = async (file: File) => {
    if (file.type !== "application/pdf") {
      toast.error("Поддерживается только PDF");
      return;
    }
    setUploading(true);
    try {
      const { data: sess } = await supabase.auth.getSession();
      const token = sess.session?.access_token;
      const fd = new FormData();
      fd.append("file", file);
      if (title.trim()) fd.append("title", title.trim());

      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ingest-pdf`;
      const r = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: fd,
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Ошибка загрузки");
      toast.success("PDF принят. Обработка идёт в фоне (1–3 мин). Список обновится автоматически.");
      setTitle("");
      if (fileRef.current) fileRef.current.value = "";
      await load();
    } catch (e: any) {
      toast.error(e.message || "Ошибка");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (book: Book) => {
    if (!confirm(`Удалить книгу «${book.title}» и все её фрагменты?`)) return;
    const { error } = await supabase.from("knowledge_books").delete().eq("id", book.id);
    if (error) return toast.error(error.message);
    toast.success("Книга удалена");
    load();
  };

  const totalChunks = books.reduce((s, b) => s + (b.chunks_count || 0), 0);
  const totalPages = books.reduce((s, b) => s + (b.pages_count || 0), 0);

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold mb-1">📚 Книги для AI-ассистента</h1>
        <p className="text-sm text-muted-foreground">
          Загружайте PDF-книги — AI-ассистент будет искать в них ответы и указывать страницу источника.
        </p>
      </div>

      <Card className="p-6">
        <div className="space-y-4">
          <div>
            <Label htmlFor="book-title">Название книги (опционально)</Label>
            <Input
              id="book-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: SEO книга Владимира"
              disabled={uploading}
              className="mt-1"
            />
          </div>

          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center hover:border-primary/50 transition-colors cursor-pointer"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); }}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files?.[0];
              if (f) handleUpload(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept="application/pdf"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
              }}
              disabled={uploading}
            />
            {uploading ? (
              <div className="flex flex-col items-center gap-2 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm font-medium">Обрабатываем PDF и создаём векторные представления…</p>
                <p className="text-xs">Это может занять 1–3 минуты для больших книг</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2">
                <Upload className="h-10 w-10 text-muted-foreground" />
                <p className="font-medium">Перетащите PDF сюда или кликните для выбора</p>
                <p className="text-xs text-muted-foreground">Только .pdf, до ~50 МБ</p>
              </div>
            )}
          </div>
        </div>
      </Card>

      <div className="flex items-center gap-4 text-sm text-muted-foreground">
        <span>Загружено книг: <b className="text-foreground">{books.length}</b></span>
        <span>Страниц: <b className="text-foreground">{totalPages.toLocaleString("ru-RU")}</b></span>
        <span>Фрагментов: <b className="text-foreground">{totalChunks.toLocaleString("ru-RU")}</b></span>
      </div>

      <div className="space-y-2">
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : books.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">Пока ни одной книги не загружено</Card>
        ) : (
          books.map((book) => (
            <Card key={book.id} className="p-4 flex items-center gap-4">
              <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-semibold truncate">{book.title}</h3>
                  {book.status === "ready" && (
                    <Badge variant="secondary" className="gap-1"><CheckCircle2 className="h-3 w-3" />готова</Badge>
                  )}
                  {book.status === "processing" && (
                    <Badge variant="secondary" className="gap-1"><Clock className="h-3 w-3" />обработка</Badge>
                  )}
                  {book.status === "failed" && (
                    <Badge variant="destructive" className="gap-1"><AlertCircle className="h-3 w-3" />ошибка</Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {book.file_name} • {book.pages_count} стр. • {book.chunks_count} фрагментов
                </p>
                {book.error_message && (
                  <p className="text-xs text-destructive mt-1">{book.error_message}</p>
                )}
              </div>
              <Button variant="ghost" size="icon" onClick={() => handleDelete(book)} title="Удалить">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
