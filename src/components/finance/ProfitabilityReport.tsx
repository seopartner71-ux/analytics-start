import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { TrendingUp, Info } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Invoice = { client_name: string; amount: number; status: string };
type Payment = { client_name: string; paid_amount: number };

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

export default function ProfitabilityReport({
  invoices,
  payments,
}: {
  invoices: Invoice[];
  payments: Payment[];
}) {
  // дефолтная себестоимость = 40% от дохода клиента (можно менять)
  const [costPct, setCostPct] = useState<number>(40);

  // достаём app_settings.cost_overrides — JSON {client_name: pct}
  const { data: overrides = {} } = useQuery({
    queryKey: ["finance_cost_overrides"],
    queryFn: async (): Promise<Record<string, number>> => {
      const { data } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "finance_cost_overrides")
        .maybeSingle();
      try {
        return data?.value ? JSON.parse(data.value) : {};
      } catch {
        return {};
      }
    },
  });

  const rows = useMemo(() => {
    const map: Record<string, number> = {};
    invoices.forEach((i) => {
      if (i.status !== "paid") return;
      map[i.client_name] = (map[i.client_name] || 0) + Number(i.amount);
    });
    payments.forEach((p) => {
      map[p.client_name] = (map[p.client_name] || 0) + Number(p.paid_amount || 0);
    });
    return Object.entries(map)
      .map(([client, income]) => {
        const pct = overrides[client] ?? costPct;
        const cost = Math.round((income * pct) / 100);
        const profit = income - cost;
        const margin = income > 0 ? Math.round((profit / income) * 100) : 0;
        return { client, income, cost, profit, margin, pct };
      })
      .sort((a, b) => b.profit - a.profit);
  }, [invoices, payments, costPct, overrides]);

  const totals = useMemo(() => {
    const income = rows.reduce((s, r) => s + r.income, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const profit = income - cost;
    const margin = income > 0 ? Math.round((profit / income) * 100) : 0;
    return { income, cost, profit, margin };
  }, [rows]);

  const marginColor = (m: number) => {
    if (m >= 50) return "bg-emerald-500/15 text-emerald-400 border-emerald-500/30";
    if (m >= 25) return "bg-amber-500/15 text-amber-400 border-amber-500/30";
    return "bg-red-500/15 text-red-400 border-red-500/30";
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="flex-row items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <TrendingUp className="h-4 w-4" /> Прибыльность клиентов
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="cost-pct" className="text-xs text-muted-foreground whitespace-nowrap">
              Себестоимость по умолчанию
            </Label>
            <div className="relative">
              <Input
                id="cost-pct"
                type="number"
                min={0}
                max={100}
                value={costPct}
                onChange={(e) => setCostPct(Math.max(0, Math.min(100, Number(e.target.value))))}
                className="w-20 h-8 pr-7"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {rows.length === 0 ? (
            <div className="text-center text-muted-foreground py-8 text-sm">
              <Info className="h-6 w-6 mx-auto mb-2 opacity-50" />
              Нет данных по клиентам
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead className="text-right">Доход</TableHead>
                  <TableHead className="text-right">Себестоимость</TableHead>
                  <TableHead className="text-right">Прибыль</TableHead>
                  <TableHead className="text-right">Маржа</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => (
                  <TableRow key={r.client}>
                    <TableCell className="font-medium">{r.client}</TableCell>
                    <TableCell className="text-right">{RUB(r.income)}</TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {RUB(r.cost)} <span className="text-xs">({r.pct}%)</span>
                    </TableCell>
                    <TableCell className={cn("text-right font-medium", r.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                      {RUB(r.profit)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="outline" className={cn("font-medium", marginColor(r.margin))}>
                        {r.margin}%
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
                <TableRow className="border-t-2 font-semibold bg-muted/30">
                  <TableCell>Итого</TableCell>
                  <TableCell className="text-right">{RUB(totals.income)}</TableCell>
                  <TableCell className="text-right">{RUB(totals.cost)}</TableCell>
                  <TableCell className={cn("text-right", totals.profit >= 0 ? "text-emerald-400" : "text-red-400")}>
                    {RUB(totals.profit)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Badge variant="outline" className={cn("font-medium", marginColor(totals.margin))}>
                      {totals.margin}%
                    </Badge>
                  </TableCell>
                </TableRow>
              </TableBody>
            </Table>
          )}
          <p className="text-xs text-muted-foreground mt-3">
            Себестоимость рассчитывается как % от дохода клиента. Формула: Прибыль = Доход − Себестоимость, Маржа = Прибыль / Доход.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
