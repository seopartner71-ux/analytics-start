import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, startOfMonth, endOfMonth, addDays, addMonths, isSameDay, isWithinInterval, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, ComposedChart,
  XAxis, YAxis, Tooltip as RTooltip, ResponsiveContainer, Legend, CartesianGrid,
} from "recharts";
import * as XLSX from "xlsx";
import {
  Wallet, TrendingDown, TrendingUp, Receipt, Plus, Pencil, Trash2,
  Download, FileText, ChevronLeft, ChevronRight, Calendar as CalIcon, AlertCircle,
  CheckCircle2, Copy, History, X,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import BanksTab from "@/components/finance/BanksTab";
import { generateInvoicePdf, type RequisitesData } from "@/lib/invoice-pdf";

/* ────────── Types ────────── */
type Client = { id: string; name: string; email: string | null; phone: string | null; notes: string | null; source?: "finance" | "crm" };
type Payment = {
  id: string; client_id: string | null; client_name: string; service: string;
  contract_amount: number; paid_amount: number; next_payment_date: string | null;
  status: string; recurrence: string; comment: string | null;
};
type Invoice = {
  id: string; invoice_number: string; client_id: string | null; client_name: string;
  amount: number; issued_at: string; due_at: string | null; status: string; services: any;
};
type Expense = {
  id: string; category: string; amount: number; expense_date: string; comment: string | null;
};
type Tax = { id: string; year: number; quarter: number; amount: number; status: string; paid_at: string | null };

/* ────────── Helpers ────────── */
const RUB = (n: number) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);
const STATUS_LABELS: Record<string, string> = {
  paid: "Оплачен", partial: "Частично", unpaid: "Не оплачен", overdue: "Просрочен",
  draft: "Черновик", sent: "Отправлен",
  pending: "К уплате", future: "Не наступил",
};
const STATUS_BADGE = (status: string) => {
  const map: Record<string, string> = {
    paid: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    partial: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    unpaid: "bg-red-500/15 text-red-400 border-red-500/30",
    overdue: "bg-red-500/15 text-red-400 border-red-500/30 animate-pulse",
    draft: "bg-zinc-500/15 text-foreground/90 border-zinc-500/30",
    sent: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    pending: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    future: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30",
  };
  return (
    <Badge variant="outline" className={cn("font-medium", map[status] || "bg-zinc-500/15 text-foreground/90")}>
      {STATUS_LABELS[status] || status}
    </Badge>
  );
};
const EXPENSE_CATS: Record<string, string> = {
  salary: "👥 Зарплата",
  ads: "📢 Реклама",
  tools: "🛠️ Инструменты и сервисы",
  rent: "🏢 Аренда офиса",
  taxes: "💰 Налоги",
  links: "🔗 Закупка ссылок",
  copywriting: "📝 Копирайтинг",
  transport: "🚗 Транспорт",
  other: "📦 Прочее",
};
const TAX_DEADLINES: Record<number, string> = { 1: "25 апреля", 2: "25 июля", 3: "25 октября", 4: "25 января" };

/* ────────── Main ────────── */
export default function Finance() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const ownerId = user?.id;

  // Period for KPIs - current month
  const today = new Date();
  const monthStart = startOfMonth(today);
  const monthEnd = endOfMonth(today);

  const { data: financeClients = [] } = useQuery({
    queryKey: ["finance_clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase.from("financial_clients").select("*").order("name");
      if (error) throw error;
      return (data as any[]).map(c => ({ ...c, source: "finance" as const }));
    },
    enabled: !!ownerId,
  });

  const { data: crmClients = [] } = useQuery({
    queryKey: ["finance_crm_clients"],
    queryFn: async (): Promise<Client[]> => {
      const { data, error } = await supabase
        .from("companies")
        .select("id, name, email, phone, description")
        .eq("type", "client")
        .order("name");
      if (error) throw error;
      return (data as any[]).map(c => ({
        id: `crm:${c.id}`,
        name: c.name,
        email: c.email,
        phone: c.phone,
        notes: c.description,
        source: "crm" as const,
      }));
    },
    enabled: !!ownerId,
  });

  const clients = useMemo<Client[]>(() => {
    const seen = new Set<string>();
    const merged: Client[] = [];
    for (const c of [...financeClients, ...crmClients]) {
      const key = c.name.trim().toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(c);
    }
    return merged.sort((a, b) => a.name.localeCompare(b.name, "ru"));
  }, [financeClients, crmClients]);

  const { data: payments = [] } = useQuery({
    queryKey: ["finance_payments"],
    queryFn: async (): Promise<Payment[]> => {
      const { data, error } = await supabase.from("financial_payments").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data as Payment[];
    },
    enabled: !!ownerId,
  });

  const { data: invoices = [] } = useQuery({
    queryKey: ["finance_invoices"],
    queryFn: async (): Promise<Invoice[]> => {
      const { data, error } = await supabase.from("financial_invoices").select("*").order("issued_at", { ascending: false });
      if (error) throw error;
      return data as Invoice[];
    },
    enabled: !!ownerId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ["finance_expenses"],
    queryFn: async (): Promise<Expense[]> => {
      const { data, error } = await supabase.from("financial_expenses").select("*").order("expense_date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
    enabled: !!ownerId,
  });

  const { data: taxes = [] } = useQuery({
    queryKey: ["finance_taxes"],
    queryFn: async (): Promise<Tax[]> => {
      const { data, error } = await supabase.from("financial_taxes").select("*").order("year").order("quarter");
      if (error) throw error;
      return data as Tax[];
    },
    enabled: !!ownerId,
  });

  /* KPIs current month */
  const kpis = useMemo(() => {
    const inMonth = (d: string) => {
      const dt = parseISO(d);
      return isWithinInterval(dt, { start: monthStart, end: monthEnd });
    };
    const income = payments
      .filter(p => p.next_payment_date && inMonth(p.next_payment_date))
      .reduce((s, p) => s + Number(p.paid_amount || 0), 0)
      + invoices.filter(i => i.status === "paid" && inMonth(i.issued_at)).reduce((s, i) => s + Number(i.amount), 0);
    const totalIncomeYear = invoices.filter(i => i.status === "paid").reduce((s, i) => s + Number(i.amount), 0);
    const expenseTotal = expenses.filter(e => inMonth(e.expense_date)).reduce((s, e) => s + Number(e.amount), 0);
    const profit = income - expenseTotal;
    const taxDue = taxes.filter(t => t.status === "pending").reduce((s, t) => s + Number(t.amount), 0)
      || Math.round(totalIncomeYear * 0.06);
    return { income, expenseTotal, profit, taxDue };
  }, [payments, invoices, expenses, taxes, monthStart, monthEnd]);

  /* Charts data */
  const months12 = useMemo(() => Array.from({ length: 12 }, (_, i) => addMonths(startOfMonth(today), -11 + i)), [today]);
  const monthlyChart = useMemo(() => months12.map(m => {
    const ms = startOfMonth(m), me = endOfMonth(m);
    const inc = invoices
      .filter(i => i.status === "paid" && isWithinInterval(parseISO(i.issued_at), { start: ms, end: me }))
      .reduce((s, i) => s + Number(i.amount), 0);
    const exp = expenses
      .filter(e => isWithinInterval(parseISO(e.expense_date), { start: ms, end: me }))
      .reduce((s, e) => s + Number(e.amount), 0);
    return { month: format(m, "LLL", { locale: ru }), Доход: inc, Расход: exp };
  }), [months12, invoices, expenses]);

  const cumulativeProfit = useMemo(() => {
    let acc = 0;
    return monthlyChart.map(r => { acc += r.Доход - r.Расход; return { month: r.month, Прибыль: acc }; });
  }, [monthlyChart]);

  /* Динамика выручки и прибыли — последние 6 месяцев */
  const revenueProfit6m = useMemo(() => {
    const months6 = Array.from({ length: 6 }, (_, i) => addMonths(startOfMonth(today), -5 + i));
    return months6.map(m => {
      const ms = startOfMonth(m), me = endOfMonth(m);
      const revenue = invoices
        .filter(i => i.status === "paid" && isWithinInterval(parseISO(i.issued_at), { start: ms, end: me }))
        .reduce((s, i) => s + Number(i.amount), 0)
        + payments
          .filter(p => p.next_payment_date && isWithinInterval(parseISO(p.next_payment_date), { start: ms, end: me }))
          .reduce((s, p) => s + Number(p.paid_amount || 0), 0);
      const exp = expenses
        .filter(e => isWithinInterval(parseISO(e.expense_date), { start: ms, end: me }))
        .reduce((s, e) => s + Number(e.amount), 0);
      return {
        month: format(m, "LLL yy", { locale: ru }),
        Выручка: revenue,
        Прибыль: revenue - exp,
      };
    });
  }, [today, invoices, payments, expenses]);

  const expenseByCat = useMemo(() => {
    const map: Record<string, number> = {};
    expenses.forEach(e => { map[e.category] = (map[e.category] || 0) + Number(e.amount); });
    return Object.entries(map).map(([k, v]) => ({ name: EXPENSE_CATS[k] || k, value: v }));
  }, [expenses]);

  const paymentsByClient = useMemo(() => {
    const map: Record<string, number> = {};
    payments.forEach(p => { map[p.client_name || "—"] = (map[p.client_name || "—"] || 0) + Number(p.paid_amount); });
    return Object.entries(map).map(([k, v]) => ({ client: k, Сумма: v })).slice(0, 8);
  }, [payments]);

  const PIE_COLORS = ["#10b981", "#f59e0b", "#3b82f6", "#ef4444", "#8b5cf6", "#ec4899"];

  /* Excel Export */
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const headerStyle = { fill: { fgColor: { rgb: "FF8800" } }, font: { color: { rgb: "FFFFFF" }, bold: true } };
    const sheets = [
      { name: "Доходы", rows: invoices.map(i => ({ "№": i.invoice_number, Клиент: i.client_name, Сумма: Number(i.amount), Выставлен: i.issued_at, Срок: i.due_at, Статус: STATUS_LABELS[i.status] })) },
      { name: "Платежи", rows: payments.map(p => ({ Клиент: p.client_name, Услуга: p.service, Договор: Number(p.contract_amount), Оплачено: Number(p.paid_amount), Долг: Number(p.contract_amount) - Number(p.paid_amount), Следующий: p.next_payment_date, Статус: STATUS_LABELS[p.status] })) },
      { name: "Расходы", rows: expenses.map(e => ({ Категория: EXPENSE_CATS[e.category], Сумма: Number(e.amount), Дата: e.expense_date, Комментарий: e.comment })) },
      { name: "Налоги", rows: taxes.map(t => ({ Год: t.year, Квартал: `Q${t.quarter}`, Сумма: Number(t.amount), Статус: STATUS_LABELS[t.status], Уплачено: t.paid_at })) },
    ];
    sheets.forEach(s => {
      const ws = XLSX.utils.json_to_sheet(s.rows);
      // apply orange header
      const range = XLSX.utils.decode_range(ws["!ref"] || "A1");
      for (let c = range.s.c; c <= range.e.c; c++) {
        const addr = XLSX.utils.encode_cell({ r: 0, c });
        if (ws[addr]) ws[addr].s = headerStyle;
      }
      XLSX.utils.book_append_sheet(wb, ws, s.name);
    });
    XLSX.writeFile(wb, `finance_${format(today, "yyyy-MM-dd")}.xlsx`);
    toast({ title: "Экспорт готов" });
  };

  /* Mutations */
  const refreshAll = () => {
    qc.invalidateQueries({ queryKey: ["finance_clients"] });
    qc.invalidateQueries({ queryKey: ["finance_payments"] });
    qc.invalidateQueries({ queryKey: ["finance_invoices"] });
    qc.invalidateQueries({ queryKey: ["finance_expenses"] });
    qc.invalidateQueries({ queryKey: ["finance_taxes"] });
  };

  if (!ownerId) return null;

  return (
    <div className="min-h-screen bg-muted/40 text-foreground p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Wallet className="h-6 w-6 text-amber-400" /> Финансы</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление доходами, расходами, налогами и платежами агентства</p>
        </div>
        <Button onClick={exportExcel} className="bg-amber-500 hover:bg-amber-600 text-foreground">
          <Download className="h-4 w-4 mr-2" /> Экспорт Excel
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiTile label="Доход за месяц" value={RUB(kpis.income)} color="emerald" icon={<TrendingUp />} />
        <KpiTile label="Расходы" value={RUB(kpis.expenseTotal)} color="red" icon={<TrendingDown />} />
        <KpiTile label="Чистая прибыль" value={RUB(kpis.profit)} color="blue" icon={<Wallet />} />
        <KpiTile label="Налоги к уплате" value={RUB(kpis.taxDue)} color="amber" icon={<Receipt />} />
      </div>

      {/* Tabs */}
      <Tabs defaultValue="payments" className="w-full">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="payments">Клиенты и платежи</TabsTrigger>
          <TabsTrigger value="invoices">Счета</TabsTrigger>
          <TabsTrigger value="expenses">Расходы</TabsTrigger>
          <TabsTrigger value="calendar">Платёжный календарь</TabsTrigger>
          <TabsTrigger value="taxes">Налоги</TabsTrigger>
          <TabsTrigger value="banks">Банки</TabsTrigger>
        </TabsList>

        <TabsContent value="payments" className="mt-4">
          <PaymentsTab payments={payments} clients={clients} ownerId={ownerId} onChange={refreshAll} />
        </TabsContent>
        <TabsContent value="invoices" className="mt-4">
          <InvoicesTab invoices={invoices} clients={clients} ownerId={ownerId} onChange={refreshAll} />
        </TabsContent>
        <TabsContent value="expenses" className="mt-4">
          <ExpensesTab expenses={expenses} ownerId={ownerId} onChange={refreshAll} />
        </TabsContent>
        <TabsContent value="calendar" className="mt-4">
          <PaymentCalendar payments={payments} invoices={invoices} ownerId={ownerId} onChange={refreshAll} clients={clients} />
        </TabsContent>
        <TabsContent value="taxes" className="mt-4">
          <TaxesTab taxes={taxes} invoices={invoices} ownerId={ownerId} onChange={refreshAll} />
        </TabsContent>
        <TabsContent value="banks" className="mt-4">
          <BanksTab ownerId={ownerId} />
        </TabsContent>
      </Tabs>

      {/* Динамика выручки и прибыли за 6 месяцев */}
      <ChartCard title="Динамика выручки и прибыли · последние 6 месяцев">
        <ResponsiveContainer width="100%" height={300}>
          <ComposedChart data={revenueProfit6m}>
            <defs>
              <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.85} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0.35} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="month" stroke="hsl(var(--muted-foreground))" />
            <YAxis stroke="hsl(var(--muted-foreground))" tickFormatter={(v) => `${(v / 1000).toFixed(0)}к`} />
            <RTooltip
              contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }}
              formatter={(v) => new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(Number(v))}
            />
            <Legend />
            <Bar dataKey="Выручка" fill="url(#revGrad)" radius={[6, 6, 0, 0]} barSize={38} />
            <Line type="monotone" dataKey="Прибыль" stroke="#FFB800" strokeWidth={3} dot={{ r: 4, fill: "#FFB800" }} activeDot={{ r: 6 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </ChartCard>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <ChartCard title="Доходы vs Расходы по месяцам">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={monthlyChart}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <RTooltip contentStyle={{ background: "#252525", border: "1px solid #333" }} />
              <Legend />
              <Line type="monotone" dataKey="Доход" stroke="#10b981" strokeWidth={2} />
              <Line type="monotone" dataKey="Расход" stroke="#ef4444" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Платежи по клиентам">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={paymentsByClient}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="client" stroke="#888" />
              <YAxis stroke="#888" />
              <RTooltip contentStyle={{ background: "#252525", border: "1px solid #333" }} />
              <Bar dataKey="Сумма" fill="#3b82f6" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Структура расходов">
          <ResponsiveContainer width="100%" height={260}>
            <PieChart>
              <Pie data={expenseByCat} dataKey="value" nameKey="name" outerRadius={90} label>
                {expenseByCat.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <RTooltip contentStyle={{ background: "#252525", border: "1px solid #333" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Прибыль нарастающим итогом">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={cumulativeProfit}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" />
              <XAxis dataKey="month" stroke="#888" />
              <YAxis stroke="#888" />
              <RTooltip contentStyle={{ background: "#252525", border: "1px solid #333" }} />
              <Line type="monotone" dataKey="Прибыль" stroke="#8b5cf6" strokeWidth={2} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>
    </div>
  );
}

/* ────────── KPI Tile ────────── */
function KpiTile({ label, value, color, icon }: { label: string; value: string; color: "emerald" | "red" | "blue" | "amber"; icon: React.ReactNode }) {
  const colorMap = {
    emerald: "from-emerald-500/20 to-emerald-500/5 border-emerald-500/30 text-emerald-400",
    red: "from-red-500/20 to-red-500/5 border-red-500/30 text-red-400",
    blue: "from-blue-500/20 to-blue-500/5 border-blue-500/30 text-blue-400",
    amber: "from-amber-500/20 to-amber-500/5 border-amber-500/30 text-amber-400",
  } as const;
  return (
    <Card className={cn("bg-gradient-to-br border", colorMap[color])}>
      <CardContent className="p-5">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs text-foreground/90 uppercase tracking-wide">{label}</span>
          <span className="opacity-70">{icon}</span>
        </div>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="bg-card border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

/* ────────── Payments Tab ────────── */
function PaymentsTab({ payments, clients, ownerId, onChange }: { payments: Payment[]; clients: Client[]; ownerId: string; onChange: () => void }) {
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterClient, setFilterClient] = useState<string>("all");
  const [editing, setEditing] = useState<Partial<Payment> | null>(null);
  const [open, setOpen] = useState(false);
  const [historyClient, setHistoryClient] = useState<string | null>(null);

  const today = new Date();
  const enriched = payments.map(p => {
    let status = p.status;
    if (status !== "paid" && p.next_payment_date) {
      const due = parseISO(p.next_payment_date);
      if (due < today && Number(p.paid_amount) < Number(p.contract_amount)) status = "overdue";
    }
    return { ...p, status };
  });

  const filtered = enriched.filter(p =>
    (filterStatus === "all" || p.status === filterStatus) &&
    (filterClient === "all" || p.client_name === filterClient)
  );

  const save = async () => {
    if (!editing) return;
    const payload = {
      client_id: editing.client_id && !String(editing.client_id).startsWith("crm:") ? editing.client_id : null,
      client_name: editing.client_name || "",
      service: editing.service || "",
      contract_amount: Number(editing.contract_amount || 0),
      paid_amount: Number(editing.paid_amount || 0),
      next_payment_date: editing.next_payment_date || null,
      status: editing.status || "pending",
      recurrence: editing.recurrence || "monthly",
      comment: editing.comment || null,
    };
    const { error } = editing.id
      ? await supabase.from("financial_payments").update(payload).eq("id", editing.id)
      : await supabase.from("financial_payments").insert(payload);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else { toast({ title: "Сохранено" }); setOpen(false); setEditing(null); onChange(); }
  };

  const markPaid = async (p: Payment) => {
    const { error } = await supabase.from("financial_payments").update({
      paid_amount: Number(p.contract_amount),
      status: "paid",
    }).eq("id", p.id);
    if (error) { toast({ title: "Ошибка", description: error.message, variant: "destructive" }); return; }
    toast({ title: "Оплата отмечена", description: `${p.client_name} — ${RUB(Number(p.contract_amount))}` });
    onChange();
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить платёж?")) return;
    await supabase.from("financial_payments").delete().eq("id", id);
    onChange();
  };

  const clientHistory = historyClient ? enriched.filter(p => p.client_name === historyClient) : [];

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex-row items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-40 bg-muted/40 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все статусы</SelectItem>
              {["paid", "partial", "pending", "overdue"].map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={filterClient} onValueChange={setFilterClient}>
            <SelectTrigger className="w-48 bg-muted/40 border-border"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все клиенты</SelectItem>
              {Array.from(new Set(payments.map(p => p.client_name).filter(Boolean))).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ status: "pending", recurrence: "monthly" })} className="bg-amber-500 text-foreground hover:bg-amber-600">
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground max-w-lg">
            <DialogHeader><DialogTitle>{editing?.id ? "Редактировать" : "Новый"} платёж</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Клиент">
                <Select value={editing?.client_id || ""} onValueChange={v => {
                  const c = clients.find(x => x.id === v);
                  setEditing(p => ({ ...p, client_id: v, client_name: c?.name || "" }));
                }}>
                  <SelectTrigger className="bg-muted/40 border-border"><SelectValue placeholder="Выбрать клиента" /></SelectTrigger>
                  <SelectContent>
                    {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.source === "crm" ? " · CRM" : ""}</SelectItem>)}
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Или имя клиента вручную">
                <Input className="bg-muted/40 border-border" value={editing?.client_name || ""} onChange={e => setEditing(p => ({ ...p, client_name: e.target.value }))} />
              </Field>
              <Field label="Услуга"><Input className="bg-muted/40 border-border" value={editing?.service || ""} onChange={e => setEditing(p => ({ ...p, service: e.target.value }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Сумма договора"><Input type="number" className="bg-muted/40 border-border" value={editing?.contract_amount || ""} onChange={e => setEditing(p => ({ ...p, contract_amount: Number(e.target.value) }))} /></Field>
                <Field label="Оплачено"><Input type="number" className="bg-muted/40 border-border" value={editing?.paid_amount || ""} onChange={e => setEditing(p => ({ ...p, paid_amount: Number(e.target.value) }))} /></Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Следующий платёж"><Input type="date" className="bg-muted/40 border-border" value={editing?.next_payment_date || ""} onChange={e => setEditing(p => ({ ...p, next_payment_date: e.target.value }))} /></Field>
                <Field label="Статус">
                  <Select value={editing?.status || "pending"} onValueChange={v => setEditing(p => ({ ...p, status: v }))}>
                    <SelectTrigger className="bg-muted/40 border-border"><SelectValue /></SelectTrigger>
                    <SelectContent>{["paid", "partial", "pending", "overdue"].map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s] || s}</SelectItem>)}</SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Повторение">
                <Select value={editing?.recurrence || "monthly"} onValueChange={v => setEditing(p => ({ ...p, recurrence: v }))}>
                  <SelectTrigger className="bg-muted/40 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="once">Разово</SelectItem>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="quarterly">Ежеквартально</SelectItem>
                    <SelectItem value="yearly">Ежегодно</SelectItem>
                  </SelectContent>
                </Select>
              </Field>
              <Field label="Комментарий"><Textarea className="bg-muted/40 border-border" value={editing?.comment || ""} onChange={e => setEditing(p => ({ ...p, comment: e.target.value }))} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={save} className="bg-amber-500 text-foreground hover:bg-amber-600">Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border hover:bg-transparent">
              <TableHead className="text-muted-foreground">Клиент</TableHead>
              <TableHead className="text-muted-foreground">Услуга</TableHead>
              <TableHead className="text-muted-foreground">Договор</TableHead>
              <TableHead className="text-muted-foreground">Оплачено</TableHead>
              <TableHead className="text-muted-foreground">Долг</TableHead>
              <TableHead className="text-muted-foreground">Следующий</TableHead>
              <TableHead className="text-muted-foreground">Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.length === 0 && <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground py-8">Нет платежей</TableCell></TableRow>}
            {filtered.map(p => (
              <TableRow key={p.id} className="border-border">
                <TableCell>
                  <button className="font-medium text-left hover:text-amber-400 underline-offset-2 hover:underline" onClick={() => setHistoryClient(p.client_name)}>
                    {p.client_name}
                  </button>
                </TableCell>
                <TableCell>{p.service}</TableCell>
                <TableCell>{RUB(Number(p.contract_amount))}</TableCell>
                <TableCell className="text-emerald-400">{RUB(Number(p.paid_amount))}</TableCell>
                <TableCell className="text-red-400">{RUB(Number(p.contract_amount) - Number(p.paid_amount))}</TableCell>
                <TableCell>{p.next_payment_date ? format(parseISO(p.next_payment_date), "dd.MM.yyyy") : "—"}</TableCell>
                <TableCell>{STATUS_BADGE(p.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    {p.status !== "paid" && (
                      <Button size="icon" variant="ghost" title="Отметить оплаченным" onClick={() => markPaid(p)}>
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
                      </Button>
                    )}
                    <Button size="icon" variant="ghost" title="История" onClick={() => setHistoryClient(p.client_name)}><History className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(p); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(p.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>

      <Sheet open={!!historyClient} onOpenChange={(o) => !o && setHistoryClient(null)}>
        <SheetContent className="bg-card border-border w-full sm:max-w-lg">
          <SheetHeader><SheetTitle>История · {historyClient}</SheetTitle></SheetHeader>
          <div className="mt-4 space-y-3">
            {clientHistory.length === 0 && <div className="text-sm text-muted-foreground">Нет платежей</div>}
            {clientHistory.map(p => (
              <Card key={p.id} className="bg-muted/40 border-border">
                <CardContent className="p-3 space-y-1 text-sm">
                  <div className="flex justify-between items-start">
                    <span className="font-medium">{p.service || "—"}</span>
                    {STATUS_BADGE(p.status)}
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Договор: {RUB(Number(p.contract_amount))}</span>
                    <span className="text-emerald-400">Оплачено: {RUB(Number(p.paid_amount))}</span>
                  </div>
                  {p.next_payment_date && <div className="text-xs text-muted-foreground">След. платёж: {format(parseISO(p.next_payment_date), "dd.MM.yyyy")}</div>}
                  {p.comment && <div className="text-xs italic text-muted-foreground">{p.comment}</div>}
                </CardContent>
              </Card>
            ))}
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  );
}

/* ────────── Invoices Tab ────────── */
function InvoicesTab({ invoices, clients, ownerId, onChange }: { invoices: Invoice[]; clients: Client[]; ownerId: string; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<Invoice> | null>(null);
  const [open, setOpen] = useState(false);

  const nextNumber = useMemo(() => {
    const year = new Date().getFullYear();
    const count = invoices.filter(i => i.invoice_number?.startsWith(`СЧ-${year}-`)).length + 1;
    return `СЧ-${year}-${String(count).padStart(3, "0")}`;
  }, [invoices]);

  const save = async () => {
    if (!editing) return;
    const payload = {
      
      invoice_number: editing.invoice_number || nextNumber,
      client_id: editing.client_id && !String(editing.client_id).startsWith("crm:") ? editing.client_id : null,
      client_name: editing.client_name || "",
      services: editing.services || [],
      amount: Number(editing.amount || 0),
      issued_at: editing.issued_at || format(new Date(), "yyyy-MM-dd"),
      due_at: editing.due_at || null,
      status: editing.status || "draft",
    };
    const { error } = editing.id
      ? await supabase.from("financial_invoices").update(payload).eq("id", editing.id)
      : await supabase.from("financial_invoices").insert(payload);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else { toast({ title: "Сохранено" }); setOpen(false); setEditing(null); onChange(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить счёт?")) return;
    await supabase.from("financial_invoices").delete().eq("id", id);
    onChange();
  };

  const downloadPdf = (inv: Invoice) => {
    // Заглушка — простой текстовый PDF через window.print или blob
    const html = `<html><head><title>${inv.invoice_number}</title></head><body style="font-family:sans-serif;padding:40px"><h1>Счёт ${inv.invoice_number}</h1><p><b>Клиент:</b> ${inv.client_name}</p><p><b>Дата:</b> ${inv.issued_at}</p><p><b>Срок:</b> ${inv.due_at || "—"}</p><h2>Сумма: ${RUB(Number(inv.amount))}</h2></body></html>`;
    const w = window.open("", "_blank");
    if (w) { w.document.write(html); w.document.close(); setTimeout(() => w.print(), 200); }
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Счета</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ status: "draft", invoice_number: nextNumber, issued_at: format(new Date(), "yyyy-MM-dd") })} className="bg-amber-500 text-foreground hover:bg-amber-600">
              <Plus className="h-4 w-4 mr-1" /> Создать счёт
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader><DialogTitle>{editing?.id ? "Редактировать" : "Новый"} счёт</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Номер"><Input className="bg-muted/40 border-border" value={editing?.invoice_number || ""} onChange={e => setEditing(p => ({ ...p, invoice_number: e.target.value }))} /></Field>
              <Field label="Клиент">
                <Select value={editing?.client_id || ""} onValueChange={v => {
                  const c = clients.find(x => x.id === v);
                  setEditing(p => ({ ...p, client_id: v, client_name: c?.name || "" }));
                }}>
                  <SelectTrigger className="bg-muted/40 border-border"><SelectValue placeholder="Клиент" /></SelectTrigger>
                  <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}{c.source === "crm" ? " · CRM" : ""}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Имя клиента"><Input className="bg-muted/40 border-border" value={editing?.client_name || ""} onChange={e => setEditing(p => ({ ...p, client_name: e.target.value }))} /></Field>
              <Field label="Сумма"><Input type="number" className="bg-muted/40 border-border" value={editing?.amount || ""} onChange={e => setEditing(p => ({ ...p, amount: Number(e.target.value) }))} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Выставлен"><Input type="date" className="bg-muted/40 border-border" value={editing?.issued_at || ""} onChange={e => setEditing(p => ({ ...p, issued_at: e.target.value }))} /></Field>
                <Field label="Срок оплаты"><Input type="date" className="bg-muted/40 border-border" value={editing?.due_at || ""} onChange={e => setEditing(p => ({ ...p, due_at: e.target.value }))} /></Field>
              </div>
              <Field label="Статус">
                <Select value={editing?.status || "draft"} onValueChange={v => setEditing(p => ({ ...p, status: v }))}>
                  <SelectTrigger className="bg-muted/40 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{["draft", "sent", "paid", "overdue"].map(s => <SelectItem key={s} value={s}>{STATUS_LABELS[s]}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={save} className="bg-amber-500 text-foreground hover:bg-amber-600">Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow className="border-border">
              <TableHead className="text-muted-foreground">№ счёта</TableHead>
              <TableHead className="text-muted-foreground">Клиент</TableHead>
              <TableHead className="text-muted-foreground">Сумма</TableHead>
              <TableHead className="text-muted-foreground">Выставлен</TableHead>
              <TableHead className="text-muted-foreground">Срок</TableHead>
              <TableHead className="text-muted-foreground">Статус</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {invoices.length === 0 && <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Нет счетов</TableCell></TableRow>}
            {invoices.map(i => (
              <TableRow key={i.id} className="border-border">
                <TableCell className="font-mono text-amber-400">{i.invoice_number}</TableCell>
                <TableCell>{i.client_name}</TableCell>
                <TableCell>{RUB(Number(i.amount))}</TableCell>
                <TableCell>{format(parseISO(i.issued_at), "dd.MM.yyyy")}</TableCell>
                <TableCell>{i.due_at ? format(parseISO(i.due_at), "dd.MM.yyyy") : "—"}</TableCell>
                <TableCell>{STATUS_BADGE(i.status)}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => downloadPdf(i)} title="Скачать PDF"><FileText className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(i); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(i.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ────────── Expenses Tab ────────── */
function ExpensesTab({ expenses, ownerId, onChange }: { expenses: Expense[]; ownerId: string; onChange: () => void }) {
  const [editing, setEditing] = useState<Partial<Expense> | null>(null);
  const [open, setOpen] = useState(false);

  const save = async () => {
    if (!editing) return;
    const payload = {
      
      category: editing.category || "other",
      amount: Number(editing.amount || 0),
      expense_date: editing.expense_date || format(new Date(), "yyyy-MM-dd"),
      comment: editing.comment || null,
    };
    const { error } = editing.id
      ? await supabase.from("financial_expenses").update(payload).eq("id", editing.id)
      : await supabase.from("financial_expenses").insert(payload);
    if (error) toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    else { toast({ title: "Сохранено" }); setOpen(false); setEditing(null); onChange(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Удалить расход?")) return;
    await supabase.from("financial_expenses").delete().eq("id", id);
    onChange();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="text-base">Расходы</CardTitle>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditing({ category: "other", expense_date: format(new Date(), "yyyy-MM-dd") })} className="bg-amber-500 text-foreground hover:bg-amber-600">
              <Plus className="h-4 w-4 mr-1" /> Добавить
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border text-foreground">
            <DialogHeader><DialogTitle>{editing?.id ? "Редактировать" : "Новый"} расход</DialogTitle></DialogHeader>
            <div className="grid gap-3">
              <Field label="Категория">
                <Select value={editing?.category || "other"} onValueChange={v => setEditing(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="bg-muted/40 border-border"><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(EXPENSE_CATS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
              </Field>
              <Field label="Сумма"><Input type="number" className="bg-muted/40 border-border" value={editing?.amount || ""} onChange={e => setEditing(p => ({ ...p, amount: Number(e.target.value) }))} /></Field>
              <Field label="Дата"><Input type="date" className="bg-muted/40 border-border" value={editing?.expense_date || ""} onChange={e => setEditing(p => ({ ...p, expense_date: e.target.value }))} /></Field>
              <Field label="Комментарий"><Textarea className="bg-muted/40 border-border" value={editing?.comment || ""} onChange={e => setEditing(p => ({ ...p, comment: e.target.value }))} /></Field>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Отмена</Button>
              <Button onClick={save} className="bg-amber-500 text-foreground hover:bg-amber-600">Сохранить</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader><TableRow className="border-border"><TableHead className="text-muted-foreground">Категория</TableHead><TableHead className="text-muted-foreground">Сумма</TableHead><TableHead className="text-muted-foreground">Дата</TableHead><TableHead className="text-muted-foreground">Комментарий</TableHead><TableHead></TableHead></TableRow></TableHeader>
          <TableBody>
            {expenses.length === 0 && <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Нет расходов</TableCell></TableRow>}
            {expenses.map(e => (
              <TableRow key={e.id} className="border-border">
                <TableCell><Badge variant="outline" className="border-zinc-600">{EXPENSE_CATS[e.category]}</Badge></TableCell>
                <TableCell className="text-red-400 font-medium">{RUB(Number(e.amount))}</TableCell>
                <TableCell>{format(parseISO(e.expense_date), "dd.MM.yyyy")}</TableCell>
                <TableCell className="text-muted-foreground">{e.comment || "—"}</TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button size="icon" variant="ghost" onClick={() => { setEditing(e); setOpen(true); }}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button size="icon" variant="ghost" onClick={() => remove(e.id)}><Trash2 className="h-3.5 w-3.5 text-red-400" /></Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

/* ────────── Payment Calendar ────────── */
function PaymentCalendar({ payments, invoices, clients, ownerId, onChange }: { payments: Payment[]; invoices: Invoice[]; clients: Client[]; ownerId: string; onChange: () => void }) {
  const [cursor, setCursor] = useState(startOfMonth(new Date()));
  const today = new Date();

  const events = useMemo(() => {
    const list: { date: Date; title: string; amount: number; status: string; type: "payment" | "invoice" }[] = [];
    payments.forEach(p => {
      if (p.next_payment_date) list.push({ date: parseISO(p.next_payment_date), title: `${p.client_name} — ${p.service}`, amount: Number(p.contract_amount) - Number(p.paid_amount), status: p.status, type: "payment" });
    });
    invoices.forEach(i => {
      if (i.due_at) list.push({ date: parseISO(i.due_at), title: `${i.invoice_number} — ${i.client_name}`, amount: Number(i.amount), status: i.status, type: "invoice" });
    });
    return list;
  }, [payments, invoices]);

  const eventColor = (status: string, date: Date) => {
    if (status === "paid") return "bg-emerald-500/20 text-emerald-300 border-l-2 border-emerald-500";
    if (status === "overdue" || date < today) return "bg-red-500/20 text-red-300 border-l-2 border-red-500";
    if (isSameDay(date, today) || isSameDay(date, addDays(today, 1))) return "bg-amber-500/20 text-amber-300 border-l-2 border-amber-500";
    return "bg-blue-500/20 text-blue-300 border-l-2 border-blue-500";
  };

  // Build month grid (Mon-first)
  const monthStart = startOfMonth(cursor);
  const monthEnd = endOfMonth(cursor);
  const startWeekday = (monthStart.getDay() + 6) % 7; // Mon=0
  const days: (Date | null)[] = [];
  for (let i = 0; i < startWeekday; i++) days.push(null);
  for (let d = 1; d <= monthEnd.getDate(); d++) days.push(new Date(cursor.getFullYear(), cursor.getMonth(), d));

  const next7Days = useMemo(() => {
    const end = addDays(today, 7);
    return events.filter(e => e.date >= today && e.date <= end).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [events, today]);

  const monthEvents = events.filter(e => isWithinInterval(e.date, { start: monthStart, end: monthEnd }));
  const expected = monthEvents.reduce((s, e) => s + e.amount, 0);
  const received = monthEvents.filter(e => e.status === "paid").reduce((s, e) => s + e.amount, 0);
  const remaining = expected - received;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-4">
      <Card className="bg-card border-border">
        <CardHeader className="flex-row items-center justify-between">
          <div className="flex items-center gap-2">
            <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, -1))}><ChevronLeft className="h-4 w-4" /></Button>
            <CardTitle className="text-base capitalize">{format(cursor, "LLLL yyyy", { locale: ru })}</CardTitle>
            <Button size="icon" variant="ghost" onClick={() => setCursor(addMonths(cursor, 1))}><ChevronRight className="h-4 w-4" /></Button>
          </div>
          <Button size="sm" variant="outline" onClick={() => setCursor(startOfMonth(new Date()))}>Сегодня</Button>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 mb-2">
            {["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"].map(d => (
              <div key={d} className="text-xs text-muted-foreground text-center font-medium py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1">
            {days.map((d, i) => {
              if (!d) return <div key={i} className="min-h-[80px]" />;
              const dayEvents = events.filter(e => isSameDay(e.date, d));
              const isToday = isSameDay(d, today);
              return (
                <div key={i} className={cn(
                  "min-h-[80px] border border-border rounded p-1 text-xs",
                  isToday ? "bg-amber-500/5 border-amber-500/30" : "bg-muted/40"
                )}>
                  <div className={cn("text-right mb-1 font-medium", isToday && "text-amber-400")}>{d.getDate()}</div>
                  <div className="space-y-0.5">
                    {dayEvents.slice(0, 2).map((e, idx) => (
                      <div key={idx} className={cn("truncate px-1 py-0.5 rounded text-[10px]", eventColor(e.status, e.date))} title={`${e.title} • ${RUB(e.amount)}`}>
                        {RUB(e.amount)}
                      </div>
                    ))}
                    {dayEvents.length > 2 && <div className="text-[10px] text-muted-foreground">+{dayEvents.length - 2}</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm">Итого по месяцу</CardTitle></CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Ожидается</span><span className="font-bold">{RUB(expected)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Получено</span><span className="font-bold text-emerald-400">{RUB(received)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">Осталось</span><span className="font-bold text-amber-400">{RUB(remaining)}</span></div>
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader><CardTitle className="text-sm flex items-center gap-2"><CalIcon className="h-4 w-4" /> Ближайшие 7 дней</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            {next7Days.length === 0 && <div className="text-xs text-muted-foreground">Нет платежей</div>}
            {next7Days.map((e, i) => (
              <div key={i} className={cn("text-xs p-2 rounded", eventColor(e.status, e.date))}>
                <div className="flex justify-between items-center">
                  <span className="font-medium">{format(e.date, "dd.MM")}</span>
                  <span className="font-bold">{RUB(e.amount)}</span>
                </div>
                <div className="truncate text-[11px] opacity-90">{e.title}</div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

/* ────────── Taxes Tab ────────── */
function TaxesTab({ taxes, invoices, ownerId, onChange }: { taxes: Tax[]; invoices: Invoice[]; ownerId: string; onChange: () => void }) {
  const year = new Date().getFullYear();
  const today = new Date();

  // Compute USN 6% per quarter from paid invoices
  const quarters = useMemo(() => [1, 2, 3, 4].map(q => {
    const qStart = new Date(year, (q - 1) * 3, 1);
    const qEnd = endOfMonth(new Date(year, q * 3 - 1, 1));
    const income = invoices
      .filter(i => i.status === "paid" && isWithinInterval(parseISO(i.issued_at), { start: qStart, end: qEnd }))
      .reduce((s, i) => s + Number(i.amount), 0);
    const tax = Math.round(income * 0.06);
    const existing = taxes.find(t => t.year === year && t.quarter === q);
    const deadline = TAX_DEADLINES[q];
    const deadlineDate = q === 4 ? new Date(year + 1, 0, 25) : new Date(year, q * 3, 25);
    const status = existing?.status || (qEnd < today ? "pending" : "future");
    const daysUntil = Math.ceil((deadlineDate.getTime() - today.getTime()) / 86400000);
    return { q, income, tax, deadline, deadlineDate, status, existing, daysUntil };
  }), [year, invoices, taxes, today]);

  const markPaid = async (q: number, amount: number, existingId?: string) => {
    const payload = { year, quarter: q, amount, status: "paid", paid_at: format(new Date(), "yyyy-MM-dd") };
    if (existingId) await supabase.from("financial_taxes").update(payload).eq("id", existingId);
    else await supabase.from("financial_taxes").insert(payload);
    toast({ title: "Отмечено как уплачено" });
    onChange();
  };

  return (
    <Card className="bg-card border-border">
      <CardHeader>
        <CardTitle className="text-base">УСН 6% • {year}</CardTitle>
        <p className="text-xs text-muted-foreground">Автоматический расчёт от дохода (оплаченные счета)</p>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {quarters.map(({ q, income, tax, deadline, status, existing, daysUntil }) => (
            <Card key={q} className={cn(
              "bg-muted/40 border-border",
              status === "paid" && "border-emerald-500/40",
              status === "pending" && daysUntil <= 7 && daysUntil > 0 && "border-amber-500/60",
              daysUntil < 0 && status !== "paid" && "border-red-500/60"
            )}>
              <CardContent className="p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-lg font-bold">Q{q}</span>
                  {STATUS_BADGE(status)}
                </div>
                <div className="text-xs text-muted-foreground">Доход: {RUB(income)}</div>
                <div className="text-xl font-bold text-amber-400">{RUB(tax)}</div>
                <div className="text-xs text-muted-foreground">Срок: {deadline}</div>
                {status === "pending" && daysUntil <= 7 && daysUntil > 0 && (
                  <div className="text-xs text-amber-400 flex items-center gap-1"><AlertCircle className="h-3 w-3" /> Осталось {daysUntil} дн.</div>
                )}
                {status !== "paid" && (
                  <Button size="sm" className="w-full bg-emerald-500 hover:bg-emerald-600 text-foreground" onClick={() => markPaid(q, tax, existing?.id)}>
                    Отметить уплаченным
                  </Button>
                )}
                {status === "paid" && existing?.paid_at && (
                  <div className="text-xs text-emerald-400">Уплачено {format(parseISO(existing.paid_at), "dd.MM.yyyy")}</div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ────────── Field helper ────────── */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
