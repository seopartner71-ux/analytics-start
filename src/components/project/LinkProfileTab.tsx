import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Plus, RefreshCw, Trash2, Upload, ExternalLink, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type Link = {
  id: string;
  project_id: string;
  donor_url: string;
  anchor: string;
  acceptor_url: string;
  type: "outreach" | "crowd" | "exchange";
  cost: number;
  placed_at: string | null;
  last_checked_at: string | null;
  status: "active" | "lost" | "pending";
  last_status_code: number | null;
  last_error: string | null;
  created_at: string;
};

const TYPE_LABELS = { outreach: "Outreach", crowd: "Crowd", exchange: "Биржа" } as const;

function StatusBadge({ status }: { status: Link["status"] }) {
  if (status === "active") return <Badge className="bg-emerald-500/10 text-emerald-500 border-0 gap-1"><CheckCircle2 className="h-3 w-3" />Активна</Badge>;
  if (status === "lost") return <Badge className="bg-red-500/10 text-red-500 border-0 gap-1"><AlertTriangle className="h-3 w-3" />Потеряна</Badge>;
  return <Badge className="bg-amber-500/10 text-amber-500 border-0 gap-1"><Clock className="h-3 w-3" />Ожидает</Badge>;
}

interface Props {
  projectId: string;
}

export function LinkProfileTab({ projectId }: Props) {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "active" | "lost" | "pending">("all");
  const [addOpen, setAddOpen] = useState(false);
  const [csvOpen, setCsvOpen] = useState(false);
  const [checking, setChecking] = useState(false);
  const [csvText, setCsvText] = useState("");

  const [form, setForm] = useState({
    donor_url: "", anchor: "", acceptor_url: "",
    type: "outreach" as Link["type"], cost: "", placed_at: "",
  });

  const { data: links = [], isLoading } = useQuery({
    queryKey: ["link-profile", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("link_profile")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Link[];
    },
  });

  const stats = useMemo(() => ({
    total: links.length,
    active: links.filter((l) => l.status === "active").length,
    lost: links.filter((l) => l.status === "lost").length,
    pending: links.filter((l) => l.status === "pending").length,
    cost: links.reduce((s, l) => s + Number(l.cost || 0), 0),
  }), [links]);

  const filtered = useMemo(() => filter === "all" ? links : links.filter((l) => l.status === filter), [links, filter]);

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!form.donor_url || !form.acceptor_url) throw new Error("Заполните URL донора и акцептора");
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("link_profile").insert({
        project_id: projectId,
        donor_url: form.donor_url.trim(),
        anchor: form.anchor.trim(),
        acceptor_url: form.acceptor_url.trim(),
        type: form.type,
        cost: Number(form.cost) || 0,
        placed_at: form.placed_at || null,
        status: "pending",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Ссылка добавлена");
      setForm({ donor_url: "", anchor: "", acceptor_url: "", type: "outreach", cost: "", placed_at: "" });
      setAddOpen(false);
      qc.invalidateQueries({ queryKey: ["link-profile", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("link_profile").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Удалено");
      qc.invalidateQueries({ queryKey: ["link-profile", projectId] });
    },
  });

  const importCsv = useMutation({
    mutationFn: async () => {
      const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
      if (lines.length === 0) throw new Error("Пустой CSV");
      // Поддержка заголовка
      const header = lines[0].toLowerCase();
      const startIdx = header.includes("donor") ? 1 : 0;
      const rows = lines.slice(startIdx).map((line) => {
        const parts = line.split(/[;,\t]/).map((p) => p.trim());
        return {
          project_id: projectId,
          donor_url: parts[0] || "",
          anchor: parts[1] || "",
          acceptor_url: parts[2] || "",
          type: (["outreach", "crowd", "exchange"].includes(parts[3]) ? parts[3] : "outreach") as Link["type"],
          cost: Number(parts[4]) || 0,
          status: "pending" as const,
        };
      }).filter((r) => r.donor_url && r.acceptor_url);
      if (rows.length === 0) throw new Error("Нет валидных строк");
      const { error } = await supabase.from("link_profile").insert(rows);
      if (error) throw error;
      return rows.length;
    },
    onSuccess: (count) => {
      toast.success(`Импортировано: ${count}`);
      setCsvText("");
      setCsvOpen(false);
      qc.invalidateQueries({ queryKey: ["link-profile", projectId] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const checkAll = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("trigger-link-check", {
        body: { project_id: projectId },
      });
      if (error) throw error;
      if (!(data as any)?.ok) throw new Error((data as any)?.error || "Краулер вернул ошибку");
      const checked = (data as any)?.data?.checked;
      toast.success(`Проверка запущена${checked != null ? `: ${checked}` : ""}`);
      qc.invalidateQueries({ queryKey: ["link-profile", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Ошибка проверки");
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Всего</div><div className="text-xl font-bold tabular-nums">{stats.total}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Активных</div><div className="text-xl font-bold text-emerald-500 tabular-nums">{stats.active}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Потеряно</div><div className="text-xl font-bold text-red-500 tabular-nums">{stats.lost}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Ожидают</div><div className="text-xl font-bold text-amber-500 tabular-nums">{stats.pending}</div></CardContent></Card>
        <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">Бюджет</div><div className="text-xl font-bold tabular-nums">{stats.cost.toLocaleString("ru-RU")} ₽</div></CardContent></Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2">
        <Tabs value={filter} onValueChange={(v) => setFilter(v as any)}>
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-xs h-7">Все</TabsTrigger>
            <TabsTrigger value="active" className="text-xs h-7">Активные</TabsTrigger>
            <TabsTrigger value="lost" className="text-xs h-7">Потеряны</TabsTrigger>
            <TabsTrigger value="pending" className="text-xs h-7">Ожидают</TabsTrigger>
          </TabsList>
        </Tabs>
        <div className="ml-auto flex gap-2">
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => checkAll()} disabled={checking || links.length === 0}>
            <RefreshCw className={`h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} /> Проверить все
          </Button>
          <Button size="sm" variant="outline" className="h-8 gap-1.5" onClick={() => setCsvOpen(true)}>
            <Upload className="h-3.5 w-3.5" /> CSV
          </Button>
          <Button size="sm" className="h-8 gap-1.5" onClick={() => setAddOpen(true)}>
            <Plus className="h-3.5 w-3.5" /> Добавить
          </Button>
        </div>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Нет ссылок</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Донор</TableHead>
                  <TableHead>Анкор</TableHead>
                  <TableHead>Акцептор</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead>Размещена</TableHead>
                  <TableHead>Проверено</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-10"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((l) => (
                  <TableRow key={l.id}>
                    <TableCell className="max-w-[260px]">
                      <a href={l.donor_url} target="_blank" rel="noreferrer" className="text-[12px] text-primary hover:underline truncate flex items-center gap-1">
                        <span className="truncate">{l.donor_url}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                      {l.last_error && <div className="text-[10px] text-red-500 mt-0.5 truncate" title={l.last_error}>{l.last_error}</div>}
                    </TableCell>
                    <TableCell className="text-[12px] max-w-[160px] truncate">{l.anchor || "—"}</TableCell>
                    <TableCell className="max-w-[220px]">
                      <a href={l.acceptor_url} target="_blank" rel="noreferrer" className="text-[12px] text-muted-foreground hover:text-foreground truncate block">
                        {l.acceptor_url}
                      </a>
                    </TableCell>
                    <TableCell><Badge variant="secondary" className="text-[10px]">{TYPE_LABELS[l.type]}</Badge></TableCell>
                    <TableCell className="text-[12px] text-right tabular-nums">{Number(l.cost).toLocaleString("ru-RU")} ₽</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{l.placed_at ? format(new Date(l.placed_at), "dd.MM.yy", { locale: ru }) : "—"}</TableCell>
                    <TableCell className="text-[11px] text-muted-foreground">{l.last_checked_at ? format(new Date(l.last_checked_at), "dd.MM HH:mm", { locale: ru }) : "—"}</TableCell>
                    <TableCell><StatusBadge status={l.status} /></TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-red-500" onClick={() => deleteMutation.mutate(l.id)}>
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Новая ссылка</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><Label className="text-xs">URL донора *</Label><Input value={form.donor_url} onChange={(e) => setForm({ ...form, donor_url: e.target.value })} placeholder="https://example.com/page" /></div>
            <div><Label className="text-xs">Анкор</Label><Input value={form.anchor} onChange={(e) => setForm({ ...form, anchor: e.target.value })} placeholder="купить ..." /></div>
            <div><Label className="text-xs">URL акцептора *</Label><Input value={form.acceptor_url} onChange={(e) => setForm({ ...form, acceptor_url: e.target.value })} placeholder="https://mysite.ru/page" /></div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Тип</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as Link["type"] })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="outreach">Outreach</SelectItem>
                    <SelectItem value="crowd">Crowd</SelectItem>
                    <SelectItem value="exchange">Биржа</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-xs">Цена ₽</Label><Input type="number" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} placeholder="0" /></div>
            </div>
            <div><Label className="text-xs">Дата размещения</Label><Input type="date" value={form.placed_at} onChange={(e) => setForm({ ...form, placed_at: e.target.value })} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Отмена</Button>
            <Button onClick={() => addMutation.mutate()} disabled={addMutation.isPending}>Добавить</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CSV dialog */}
      <Dialog open={csvOpen} onOpenChange={setCsvOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Импорт CSV</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label className="text-xs">Формат: <code className="text-[11px]">donor_url, anchor, acceptor_url, type, cost</code></Label>
            <Textarea rows={10} value={csvText} onChange={(e) => setCsvText(e.target.value)} placeholder="https://donor.ru, анкор, https://mysite.ru, outreach, 5000" className="font-mono text-xs" />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCsvOpen(false)}>Отмена</Button>
            <Button onClick={() => importCsv.mutate()} disabled={importCsv.isPending}>Импортировать</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
