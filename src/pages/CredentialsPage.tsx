import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "@/hooks/use-toast";
import { Copy, Eye, EyeOff, KeyRound, Pencil, Plus, Search, Trash2, ExternalLink } from "lucide-react";

const CATEGORIES = [
  { value: "hosting", label: "Хостинг" },
  { value: "domain", label: "Домен / DNS" },
  { value: "cms", label: "CMS / Админка сайта" },
  { value: "ftp", label: "FTP / SSH" },
  { value: "database", label: "База данных" },
  { value: "crm", label: "CRM" },
  { value: "analytics", label: "Аналитика" },
  { value: "ads", label: "Рекламные кабинеты" },
  { value: "social", label: "Соцсети" },
  { value: "email", label: "Почта" },
  { value: "other", label: "Другое" },
];

const categoryLabel = (v: string) => CATEGORIES.find((c) => c.value === v)?.label ?? v;

interface Credential {
  id: string;
  project_id: string | null;
  category: string;
  title: string;
  url: string | null;
  login: string | null;
  password: string | null;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
}

interface FormState {
  id?: string;
  project_id: string;
  category: string;
  title: string;
  url: string;
  login: string;
  password: string;
  notes: string;
  tags: string;
}

const emptyForm: FormState = {
  project_id: "none",
  category: "hosting",
  title: "",
  url: "",
  login: "",
  password: "",
  notes: "",
  tags: "",
};

export default function CredentialsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterProject, setFilterProject] = useState<string>("all");
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});
  const [showFormPassword, setShowFormPassword] = useState(false);

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-for-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name").order("name");
      if (error) throw error;
      return data;
    },
  });

  const { data: credentials = [], isLoading } = useQuery({
    queryKey: ["project-credentials"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_credentials")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Credential[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (f: FormState) => {
      const payload = {
        project_id: f.project_id === "none" ? null : f.project_id,
        category: f.category,
        title: f.title.trim(),
        url: f.url.trim() || null,
        login: f.login.trim() || null,
        password: f.password || null,
        notes: f.notes.trim() || null,
        tags: f.tags.split(",").map((t) => t.trim()).filter(Boolean),
      };
      if (f.id) {
        const { error } = await supabase.from("project_credentials").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("project_credentials")
          .insert({ ...payload, owner_id: user!.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-credentials"] });
      setDialogOpen(false);
      setForm(emptyForm);
      toast({ title: "Сохранено" });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_credentials").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["project-credentials"] });
      toast({ title: "Удалено" });
    },
  });

  const openEdit = (c: Credential) => {
    setForm({
      id: c.id,
      project_id: c.project_id ?? "none",
      category: c.category,
      title: c.title,
      url: c.url ?? "",
      login: c.login ?? "",
      password: c.password ?? "",
      notes: c.notes ?? "",
      tags: c.tags.join(", "),
    });
    setShowFormPassword(false);
    setDialogOpen(true);
  };

  const openCreate = () => {
    setForm(emptyForm);
    setShowFormPassword(false);
    setDialogOpen(true);
  };

  const projectName = (id: string | null) =>
    id ? projects.find((p) => p.id === id)?.name ?? "—" : "Общий";

  const filtered = credentials.filter((c) => {
    if (filterProject !== "all" && (c.project_id ?? "none") !== filterProject) return false;
    if (filterCategory !== "all" && c.category !== filterCategory) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (
        !c.title.toLowerCase().includes(q) &&
        !(c.url ?? "").toLowerCase().includes(q) &&
        !(c.login ?? "").toLowerCase().includes(q) &&
        !(c.notes ?? "").toLowerCase().includes(q) &&
        !c.tags.some((t) => t.toLowerCase().includes(q))
      ) return false;
    }
    return true;
  });

  const copy = (txt: string, label: string) => {
    navigator.clipboard.writeText(txt);
    toast({ title: `${label} скопирован` });
  };

  return (
    <div className="space-y-4 p-2 sm:p-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-semibold">Доступы</h1>
          <p className="text-xs sm:text-sm text-muted-foreground">Хостинг, CMS, FTP, CRM и другие учётные данные по проектам</p>
        </div>
        <Button onClick={openCreate} size="sm" className="w-full sm:w-auto">
          <Plus className="h-4 w-4 mr-2" />
          Добавить доступ
        </Button>
      </div>

      <Card>
        <CardContent className="p-3 sm:p-4 flex flex-col sm:flex-row sm:flex-wrap gap-2 sm:gap-3 sm:items-center">
          <div className="relative flex-1 min-w-0 sm:min-w-[220px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск по названию, логину, URL, тегам..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterProject} onValueChange={setFilterProject}>
            <SelectTrigger className="w-full sm:w-[200px]">
              <SelectValue placeholder="Проект" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все проекты</SelectItem>
              <SelectItem value="none">Общие (без проекта)</SelectItem>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Категория" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все категории</SelectItem>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Загрузка...</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-12 text-center text-muted-foreground">
            <KeyRound className="h-10 w-10 mx-auto mb-3 opacity-40" />
            <p>Нет сохранённых доступов</p>
            <Button variant="link" onClick={openCreate}>Добавить первый</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {filtered.map((c) => {
            const isRevealed = revealed[c.id];
            return (
              <Card key={c.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium truncate">{c.title}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <Badge variant="secondary" className="text-[10px]">{categoryLabel(c.category)}</Badge>
                        <Badge variant="outline" className="text-[10px]">{projectName(c.project_id)}</Badge>
                        {c.tags.map((t) => (
                          <Badge key={t} variant="outline" className="text-[10px]">#{t}</Badge>
                        ))}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(c)}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive">
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Удалить доступ?</AlertDialogTitle>
                            <AlertDialogDescription>
                              «{c.title}» будет удалён без возможности восстановления.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Отмена</AlertDialogCancel>
                            <AlertDialogAction onClick={() => deleteMutation.mutate(c.id)}>
                              Удалить
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </div>

                  {c.url && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-14">URL:</span>
                      <a
                        href={c.url.startsWith("http") ? c.url : `https://${c.url}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline truncate flex-1 inline-flex items-center gap-1"
                      >
                        {c.url}
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(c.url!, "URL")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {c.login && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-14">Логин:</span>
                      <span className="font-mono truncate flex-1">{c.login}</span>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(c.login!, "Логин")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {c.password && (
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-muted-foreground shrink-0 w-14">Пароль:</span>
                      <span className="font-mono truncate flex-1">
                        {isRevealed ? c.password : "•".repeat(Math.min(c.password.length, 14))}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-6 w-6"
                        onClick={() => setRevealed((r) => ({ ...r, [c.id]: !r[c.id] }))}
                      >
                        {isRevealed ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => copy(c.password!, "Пароль")}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {c.notes && (
                    <div className="text-xs text-muted-foreground border-t pt-2 whitespace-pre-wrap break-words">
                      {c.notes}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? "Редактировать доступ" : "Новый доступ"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Проект</Label>
                <Select value={form.project_id} onValueChange={(v) => setForm({ ...form, project_id: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Общий (без проекта)</SelectItem>
                    {projects.map((p) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Категория</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Название *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Например: cPanel хостинга"
              />
            </div>
            <div>
              <Label>URL</Label>
              <Input
                value={form.url}
                onChange={(e) => setForm({ ...form, url: e.target.value })}
                placeholder="https://..."
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Логин</Label>
                <Input value={form.login} onChange={(e) => setForm({ ...form, login: e.target.value })} />
              </div>
              <div>
                <Label>Пароль</Label>
                <div className="relative">
                  <Input
                    type={showFormPassword ? "text" : "password"}
                    value={form.password}
                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                    className="pr-9 font-mono"
                    autoComplete="new-password"
                  />
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7"
                    onClick={() => setShowFormPassword((v) => !v)}
                  >
                    {showFormPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </Button>
                </div>
              </div>
            </div>
            <div>
              <Label>Теги (через запятую)</Label>
              <Input
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                placeholder="prod, важно"
              />
            </div>
            <div>
              <Label>Заметки</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Дополнительная информация, секретные вопросы и т.п."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Отмена</Button>
            <Button
              onClick={() => saveMutation.mutate(form)}
              disabled={!form.title.trim() || saveMutation.isPending}
            >
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
