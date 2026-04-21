import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  ChevronLeft, ChevronRight, History, Lock, RotateCcw, Search,
} from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

const ENTITY_LABELS: Record<string, string> = {
  task: "Задача",
  project: "Проект",
  employee: "Сотрудник",
  client: "Клиент",
  invoice: "Счёт",
  expense: "Расход",
  payment: "Платёж",
  report: "Отчёт",
  knowledge_article: "Статья",
  chat_message: "Сообщение",
  onboarding: "Онбординг",
  link: "Ссылка",
  period: "Период",
  checklist_task: "Чек-лист",
};

const ACTION_LABELS: Record<string, { label: string; cls: string }> = {
  archive: { label: "Архивирование", cls: "bg-amber-500/10 text-amber-500 border-amber-500/20" },
  hard_delete: { label: "Удаление", cls: "bg-destructive/10 text-destructive border-destructive/20" },
  restore: { label: "Восстановление", cls: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20" },
};

const PAGE_SIZE = 25;

interface Row {
  id: string;
  created_at: string;
  actor_id: string;
  actor_email: string;
  actor_name: string;
  entity_type: string;
  entity_id: string | null;
  entity_name: string;
  action: string;
  context: Record<string, any>;
}

export default function DeletionLogPage() {
  const { isAdmin, role, loading: authLoading } = useAuth();
  const canView = isAdmin || role === "director";

  const [rows, setRows] = useState<Row[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(false);

  // filters
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [entityFilter, setEntityFilter] = useState<string>("all");
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearchDebounced(search.trim());
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [entityFilter, actionFilter, dateFrom, dateTo]);

  const load = async () => {
    if (!canView) return;
    setLoading(true);
    let q = supabase
      .from("deletion_log")
      .select("*", { count: "exact" })
      .order("created_at", { ascending: false });

    if (entityFilter !== "all") q = q.eq("entity_type", entityFilter);
    if (actionFilter !== "all") q = q.eq("action", actionFilter);
    if (dateFrom) q = q.gte("created_at", new Date(dateFrom).toISOString());
    if (dateTo) {
      const to = new Date(dateTo);
      to.setHours(23, 59, 59, 999);
      q = q.lte("created_at", to.toISOString());
    }
    if (searchDebounced) {
      const s = searchDebounced.replace(/[%,]/g, "");
      q = q.or(
        `entity_name.ilike.%${s}%,actor_name.ilike.%${s}%,actor_email.ilike.%${s}%`
      );
    }

    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;
    q = q.range(from, to);

    const { data, error, count } = await q;
    if (!error) {
      setRows((data as any) || []);
      setTotal(count || 0);
    } else {
      setRows([]);
      setTotal(0);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canView, page, searchDebounced, entityFilter, actionFilter, dateFrom, dateTo]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const reset = () => {
    setSearch("");
    setEntityFilter("all");
    setActionFilter("all");
    setDateFrom("");
    setDateTo("");
    setPage(0);
  };

  const stats = useMemo(() => {
    const byAction: Record<string, number> = {};
    rows.forEach((r) => { byAction[r.action] = (byAction[r.action] || 0) + 1; });
    return byAction;
  }, [rows]);

  if (authLoading) return null;

  if (!canView) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Доступ ограничен</h2>
        <p className="text-sm text-muted-foreground">
          Журнал удалений доступен только администратору и директору.
        </p>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <History className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold">Журнал удалений</h1>
            <p className="text-sm text-muted-foreground">
              История всех удалений и архивирований в системе
            </p>
          </div>
        </div>
        <div className="text-sm text-muted-foreground">
          Всего записей: <span className="font-semibold text-foreground">{total}</span>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-2">
          <div className="relative lg:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Поиск: название, кто удалил, email..."
              className="pl-9 h-9"
            />
          </div>

          <Select value={entityFilter} onValueChange={setEntityFilter}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Тип объекта" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все типы</SelectItem>
              {Object.entries(ENTITY_LABELS).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={actionFilter} onValueChange={setActionFilter}>
            <SelectTrigger className="h-9"><SelectValue placeholder="Действие" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все действия</SelectItem>
              <SelectItem value="archive">Архивирование</SelectItem>
              <SelectItem value="hard_delete">Удаление</SelectItem>
              <SelectItem value="restore">Восстановление</SelectItem>
            </SelectContent>
          </Select>

          <Button
            variant="outline"
            size="sm"
            onClick={reset}
            className="h-9 gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" /> Сбросить
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div>
            <label className="text-[11px] text-muted-foreground">Дата с</label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-9"
            />
          </div>
          <div>
            <label className="text-[11px] text-muted-foreground">Дата по</label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-9"
            />
          </div>
        </div>
      </Card>

      {/* Mini-stats for current page */}
      {rows.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {Object.entries(stats).map(([k, v]) => {
            const meta = ACTION_LABELS[k] || { label: k, cls: "" };
            return (
              <Badge key={k} variant="outline" className={`text-[11px] ${meta.cls}`}>
                {meta.label}: {v}
              </Badge>
            );
          })}
        </div>
      )}

      {/* Table */}
      <Card className="overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-sm text-muted-foreground">Загрузка…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-sm text-muted-foreground">
            Записей не найдено
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[150px]">Дата</TableHead>
                  <TableHead>Кто удалил</TableHead>
                  <TableHead>Действие</TableHead>
                  <TableHead>Тип</TableHead>
                  <TableHead>Объект</TableHead>
                  <TableHead className="hidden lg:table-cell">Контекст</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const action = ACTION_LABELS[r.action] || { label: r.action, cls: "" };
                  const entity = ENTITY_LABELS[r.entity_type] || r.entity_type;
                  const ctxStr = Object.entries(r.context || {})
                    .filter(([_, v]) => v !== null && v !== "" && v !== undefined)
                    .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                    .join(" · ");
                  return (
                    <TableRow key={r.id}>
                      <TableCell className="text-[12px] text-muted-foreground tabular-nums whitespace-nowrap">
                        {format(new Date(r.created_at), "dd.MM.yyyy HH:mm", { locale: ru })}
                      </TableCell>
                      <TableCell>
                        <div className="text-[13px] font-medium">{r.actor_name || "—"}</div>
                        <div className="text-[11px] text-muted-foreground">{r.actor_email}</div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={`text-[11px] ${action.cls}`}>
                          {action.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-[12px] text-muted-foreground">{entity}</TableCell>
                      <TableCell className="text-[13px] font-medium max-w-[260px] truncate" title={r.entity_name}>
                        «{r.entity_name || "—"}»
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-[11px] text-muted-foreground max-w-[280px] truncate" title={ctxStr}>
                        {ctxStr || "—"}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {total > PAGE_SIZE && (
        <div className="flex items-center justify-between gap-3">
          <div className="text-[12px] text-muted-foreground">
            Страница {page + 1} из {totalPages} · показано {rows.length} из {total}
          </div>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="sm"
              disabled={page === 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              className="h-8 gap-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" /> Назад
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={page >= totalPages - 1 || loading}
              onClick={() => setPage((p) => p + 1)}
              className="h-8 gap-1"
            >
              Вперёд <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
