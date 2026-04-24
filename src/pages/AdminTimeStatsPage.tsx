import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { CalendarIcon, Clock, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type Row = {
  user_id: string;
  active_seconds: number;
  name: string;
  email: string;
  last_active: string | null; // ISO date (yyyy-MM-dd) последнего дня активности
};

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, "0")} ч ${String(m).padStart(2, "0")} мин`;
}

function formatLastActive(date: string | null, today: string): string {
  if (!date) return "Никогда";
  if (date === today) return "Сегодня";
  const d = new Date(date);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  if (date === format(yesterday, "yyyy-MM-dd")) return "Вчера";
  return format(d, "d MMMM yyyy", { locale: ru });
}

export default function AdminTimeStatsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { isAdmin, role, loading: authLoading } = useAuth();
  const isDirector = role === "director";
  const allowed = isAdmin || isDirector;
  const navigate = useNavigate();
  const [date, setDate] = useState<Date>(new Date());
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !allowed && !embedded) navigate("/", { replace: true });
  }, [authLoading, allowed, embedded, navigate]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setLoading(true);
      const day = format(date, "yyyy-MM-dd");

      // 1. Все сотрудники (профили) — активные, не архивные
      const { data: profs } = await supabase
        .from("profiles")
        .select("user_id, first_name, last_name, full_name, email, archived_at")
        .is("archived_at", null);

      const profiles = profs ?? [];

      // 2. Логи за выбранный день
      const { data: dayLogs, error } = await supabase
        .from("user_time_logs")
        .select("user_id, active_seconds")
        .eq("log_date", day);
      if (error) {
        console.error(error);
        if (!cancelled) {
          setRows([]);
          setLoading(false);
        }
        return;
      }

      // 3. Последняя активность по каждому пользователю (последний log_date)
      const { data: allLogs } = await supabase
        .from("user_time_logs")
        .select("user_id, log_date")
        .order("log_date", { ascending: false });

      const lastActiveMap = new Map<string, string>();
      (allLogs ?? []).forEach((l) => {
        if (!lastActiveMap.has(l.user_id)) lastActiveMap.set(l.user_id, l.log_date);
      });

      const dayMap = new Map<string, number>();
      (dayLogs ?? []).forEach((l) => dayMap.set(l.user_id, l.active_seconds ?? 0));

      const merged: Row[] = profiles.map((p) => {
        const name =
          [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
          p?.full_name ||
          p?.email ||
          "—";
        return {
          user_id: p.user_id,
          active_seconds: dayMap.get(p.user_id) ?? 0,
          name,
          email: p?.email ?? "",
          last_active: lastActiveMap.get(p.user_id) ?? null,
        };
      });

      // Сортировка: сначала те, у кого есть время за день, по убыванию;
      // затем по последней активности (новее → старше); затем по имени.
      merged.sort((a, b) => {
        if (b.active_seconds !== a.active_seconds) return b.active_seconds - a.active_seconds;
        if (a.last_active && b.last_active && a.last_active !== b.last_active)
          return a.last_active < b.last_active ? 1 : -1;
        if (a.last_active && !b.last_active) return -1;
        if (!a.last_active && b.last_active) return 1;
        return a.name.localeCompare(b.name);
      });

      if (!cancelled) {
        setRows(merged);
        setLoading(false);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const todayStr = format(date, "yyyy-MM-dd");

  const totals = useMemo(() => {
    const sum = rows.reduce((a, r) => a + r.active_seconds, 0);
    const activeCount = rows.filter((r) => r.active_seconds > 0).length;
    return { sum, count: activeCount };
  }, [rows]);

  if (!embedded && (authLoading || !allowed)) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        {!embedded && (
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Учёт времени</h1>
            <p className="text-sm text-muted-foreground">
              Реальное активное время сотрудников за выбранный день
            </p>
          </div>
        )}
        <Popover>
          <PopoverTrigger asChild>
            <Button variant="outline" className={cn("w-[240px] justify-start text-left font-normal")}>
              <CalendarIcon className="mr-2 h-4 w-4" />
              {format(date, "d MMMM yyyy", { locale: ru })}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={(d) => d && setDate(d)}
              locale={ru}
              initialFocus
              className={cn("p-3 pointer-events-auto")}
            />
          </PopoverContent>
        </Popover>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Сотрудников активно</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{totals.count}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Суммарное время</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-semibold">{formatSeconds(totals.sum)}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Сотрудники</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10 w-full" />
              ))}
            </div>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-6 text-center">
              Нет сотрудников.
            </p>
          ) : (
            <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>Последняя активность</TableHead>
                  <TableHead className="text-right">Чистое время</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const inactive = r.active_seconds === 0;
                  return (
                    <TableRow key={r.user_id} className={inactive ? "opacity-60" : ""}>
                      <TableCell className="font-medium">{r.name}</TableCell>
                      <TableCell className="text-muted-foreground">{r.email}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {formatLastActive(r.last_active, todayStr)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{formatSeconds(r.active_seconds)}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
