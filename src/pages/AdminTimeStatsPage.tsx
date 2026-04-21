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
};

function formatSeconds(total: number): string {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  return `${String(h).padStart(2, "0")} ч ${String(m).padStart(2, "0")} мин`;
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
      const { data: logs, error } = await supabase
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
      const ids = (logs ?? []).map((l) => l.user_id);
      let profiles: Array<{ user_id: string; first_name: string | null; last_name: string | null; full_name: string | null; email: string }> = [];
      if (ids.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, first_name, last_name, full_name, email")
          .in("user_id", ids);
        profiles = profs ?? [];
      }
      const merged: Row[] = (logs ?? []).map((l) => {
        const p = profiles.find((pr) => pr.user_id === l.user_id);
        const name =
          [p?.first_name, p?.last_name].filter(Boolean).join(" ") ||
          p?.full_name ||
          p?.email ||
          "—";
        return {
          user_id: l.user_id,
          active_seconds: l.active_seconds ?? 0,
          name,
          email: p?.email ?? "",
        };
      });
      merged.sort((a, b) => b.active_seconds - a.active_seconds);
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

  const totals = useMemo(() => {
    const sum = rows.reduce((a, r) => a + r.active_seconds, 0);
    return { sum, count: rows.length };
  }, [rows]);

  if (authLoading || !isAdmin) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Учёт времени</h1>
          <p className="text-sm text-muted-foreground">
            Реальное активное время сотрудников за выбранный день
          </p>
        </div>
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
              За этот день нет данных об активности.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-right">Чистое время</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.user_id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell className="text-muted-foreground">{r.email}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatSeconds(r.active_seconds)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
