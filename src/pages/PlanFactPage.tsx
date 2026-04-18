import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TrendingDown, TrendingUp, AlertTriangle, Wallet, Clock, Target, DollarSign, BellRing, Loader2 } from "lucide-react";
import { startOfMonth, endOfMonth, format, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { toast } from "sonner";

interface ProjectRow {
  id: string;
  name: string;
  planned_hours: number;
  hourly_rate: number;
  monthly_budget: number;
}

interface TimeEntry {
  project_id: string | null;
  duration_minutes: number;
}

export default function PlanFactPage() {
  const [monthOffset, setMonthOffset] = useState(0);
  const [checking, setChecking] = useState(false);

  const targetMonth = useMemo(() => subMonths(new Date(), monthOffset), [monthOffset]);
  const monthStart = useMemo(() => startOfMonth(targetMonth), [targetMonth]);
  const monthEnd = useMemo(() => endOfMonth(targetMonth), [targetMonth]);

  const runOverrunCheck = async () => {
    setChecking(true);
    try {
      const { data, error } = await supabase.functions.invoke("check-plan-overruns");
      if (error) throw error;
      const created = (data as { created?: number })?.created ?? 0;
      toast.success(
        created > 0
          ? `Создано уведомлений: ${created}`
          : "Превышений не найдено — все проекты в норме"
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Не удалось проверить");
    } finally {
      setChecking(false);
    }
  };

  const { data: projects = [] } = useQuery<ProjectRow[]>({
    queryKey: ["plan-fact-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("id, name, planned_hours, hourly_rate, monthly_budget")
        .order("name");
      if (error) throw error;
      return (data || []) as ProjectRow[];
    },
  });

  const { data: entries = [] } = useQuery<TimeEntry[]>({
    queryKey: ["plan-fact-entries", format(monthStart, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_time_entries")
        .select("project_id, duration_minutes")
        .gte("entry_date", format(monthStart, "yyyy-MM-dd"))
        .lte("entry_date", format(monthEnd, "yyyy-MM-dd"));
      if (error) throw error;
      return (data || []) as TimeEntry[];
    },
  });

  const rows = useMemo(() => {
    const totals = new Map<string, number>();
    for (const e of entries) {
      if (!e.project_id) continue;
      totals.set(e.project_id, (totals.get(e.project_id) || 0) + (e.duration_minutes || 0));
    }
    return projects.map((p) => {
      const actualHours = (totals.get(p.id) || 0) / 60;
      const planned = Number(p.planned_hours) || 0;
      const rate = Number(p.hourly_rate) || 0;
      const budget = Number(p.monthly_budget) || 0;
      const cost = actualHours * rate;
      const profit = budget - cost;
      const margin = budget > 0 ? (profit / budget) * 100 : 0;
      const usagePct = planned > 0 ? Math.min(999, (actualHours / planned) * 100) : 0;
      let status: "ok" | "warn" | "over" | "loss" | "no-plan" = "no-plan";
      if (planned === 0 && budget === 0) status = "no-plan";
      else if (profit < 0) status = "loss";
      else if (usagePct > 110) status = "over";
      else if (usagePct > 90) status = "warn";
      else status = "ok";
      return { ...p, actualHours, planned, rate, budget, cost, profit, margin, usagePct, status };
    });
  }, [projects, entries]);

  const summary = useMemo(() => {
    const totalPlanned = rows.reduce((s, r) => s + r.planned, 0);
    const totalActual = rows.reduce((s, r) => s + r.actualHours, 0);
    const totalBudget = rows.reduce((s, r) => s + r.budget, 0);
    const totalCost = rows.reduce((s, r) => s + r.cost, 0);
    const totalProfit = totalBudget - totalCost;
    const lossCount = rows.filter((r) => r.status === "loss").length;
    const overCount = rows.filter((r) => r.status === "over").length;
    return { totalPlanned, totalActual, totalBudget, totalCost, totalProfit, lossCount, overCount };
  }, [rows]);

  const statusBadge = (s: typeof rows[number]["status"]) => {
    switch (s) {
      case "loss":
        return <Badge variant="destructive" className="text-[10px]"><TrendingDown className="h-3 w-3 mr-1" />Убыток</Badge>;
      case "over":
        return <Badge className="bg-orange-500/15 text-orange-500 border-0 text-[10px]"><AlertTriangle className="h-3 w-3 mr-1" />Превышение</Badge>;
      case "warn":
        return <Badge className="bg-yellow-500/15 text-yellow-500 border-0 text-[10px]">Близко к лимиту</Badge>;
      case "ok":
        return <Badge className="bg-emerald-500/15 text-emerald-500 border-0 text-[10px]"><TrendingUp className="h-3 w-3 mr-1" />В норме</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">Не задано</Badge>;
    }
  };

  const fmtMoney = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(n)) + " ₽";
  const fmtHours = (n: number) => n.toFixed(1) + " ч";

  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-semibold">План-факт по проектам</h1>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            Сравнение запланированных и фактических часов, выявление убыточных клиентов
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-9 gap-1.5 text-[12px]"
            onClick={runOverrunCheck}
            disabled={checking}
          >
            {checking ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <BellRing className="h-3.5 w-3.5" />}
            Проверить превышения
          </Button>
          <Select value={String(monthOffset)} onValueChange={(v) => setMonthOffset(Number(v))}>
            <SelectTrigger className="w-56 h-9 text-[13px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Array.from({ length: 6 }).map((_, i) => {
                const d = subMonths(new Date(), i);
                return (
                  <SelectItem key={i} value={String(i)}>
                    {format(d, "LLLL yyyy", { locale: ru })}
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-[11px] text-muted-foreground flex items-start gap-2">
        <BellRing className="h-3.5 w-3.5 mt-0.5 shrink-0 text-primary" />
        <span>
          Автоматическая проверка выполняется ежедневно в 12:00 МСК. При использовании более 90% — предупреждение,
          более 110% — критический алерт. Уведомления отправляются владельцу проекта.
        </span>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5" /> План часов
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{fmtHours(summary.totalPlanned)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Факт: {fmtHours(summary.totalActual)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <Wallet className="h-3.5 w-3.5" /> Доход (бюджет)
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{fmtMoney(summary.totalBudget)}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Себестоимость: {fmtMoney(summary.totalCost)}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <DollarSign className="h-3.5 w-3.5" /> Прибыль
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className={`text-2xl font-semibold ${summary.totalProfit < 0 ? "text-destructive" : "text-emerald-500"}`}>
              {fmtMoney(summary.totalProfit)}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1">
              Маржа: {summary.totalBudget > 0 ? Math.round((summary.totalProfit / summary.totalBudget) * 100) : 0}%
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-[11px] font-medium text-muted-foreground flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Проблемные
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold text-destructive">{summary.lossCount}</div>
            <div className="text-[11px] text-muted-foreground mt-1">Превышение часов: {summary.overCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card>
        <CardHeader className="p-4 pb-3">
          <CardTitle className="text-[14px] flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            Детализация по проектам
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Проект</TableHead>
                <TableHead className="text-right">План, ч</TableHead>
                <TableHead className="text-right">Факт, ч</TableHead>
                <TableHead className="w-[180px]">Использование</TableHead>
                <TableHead className="text-right">Бюджет</TableHead>
                <TableHead className="text-right">Себестоимость</TableHead>
                <TableHead className="text-right">Прибыль</TableHead>
                <TableHead>Статус</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center text-muted-foreground text-[13px] py-8">
                    Нет проектов
                  </TableCell>
                </TableRow>
              )}
              {rows.map((r) => (
                <TableRow key={r.id} className={r.status === "loss" ? "bg-destructive/5" : ""}>
                  <TableCell className="font-medium text-[13px]">{r.name}</TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">
                    {r.planned > 0 ? fmtHours(r.planned) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">{fmtHours(r.actualHours)}</TableCell>
                  <TableCell>
                    {r.planned > 0 ? (
                      <div className="space-y-1">
                        <Progress
                          value={Math.min(100, r.usagePct)}
                          className={`h-1.5 ${r.usagePct > 110 ? "[&>div]:bg-destructive" : r.usagePct > 90 ? "[&>div]:bg-orange-500" : "[&>div]:bg-emerald-500"}`}
                        />
                        <div className="text-[10px] text-muted-foreground tabular-nums">{Math.round(r.usagePct)}%</div>
                      </div>
                    ) : (
                      <span className="text-muted-foreground text-[11px]">не задан</span>
                    )}
                  </TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums">
                    {r.budget > 0 ? fmtMoney(r.budget) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell className="text-right text-[13px] tabular-nums text-muted-foreground">
                    {r.rate > 0 ? fmtMoney(r.cost) : <span>—</span>}
                  </TableCell>
                  <TableCell className={`text-right text-[13px] tabular-nums font-medium ${r.profit < 0 ? "text-destructive" : r.budget > 0 ? "text-emerald-500" : ""}`}>
                    {r.budget > 0 || r.cost > 0 ? fmtMoney(r.profit) : <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>{statusBadge(r.status)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <p className="text-[11px] text-muted-foreground">
        💡 Для расчёта прибыли укажите план часов, ставку специалиста и бюджет договора в настройках проекта (Редактирование → Основное).
      </p>
    </div>
  );
}
