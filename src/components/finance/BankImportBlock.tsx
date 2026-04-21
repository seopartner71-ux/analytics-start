import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X, UserPlus, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

type Direction = "income" | "expense";

type ParsedRow = {
  selected: boolean;
  date: string;
  direction: Direction;       // income = приход, expense = расход
  amount: number;             // всегда положительная
  counterparty: string;       // очищенное имя плательщика/получателя
  rawCounterparty: string;    // как в файле
  inn: string | null;
  purpose: string;
  matchedClient: { id: string; name: string } | null;  // только для приходов
  matchedInvoiceId: string | null;
  willCreateClient: boolean;  // создадим нового клиента при импорте
  duplicate: boolean;
};

type Account = { id: string; name: string };
type Client = { id: string; name: string; inn: string | null };
type Invoice = { id: string; invoice_number: string; client_name: string; amount: number; status: string; date_created: string };

export function BankImportBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: accounts = [] } = useQuery({
    queryKey: ["fin-import-accounts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("financial_accounts")
        .select("id, name")
        .eq("is_active", true).eq("kind", "bank")
        .order("sort_order");
      if (error) throw error;
      return (data || []) as Account[];
    },
  });

  const { data: clients = [] } = useQuery({
    queryKey: ["fin-import-clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("financial_clients").select("id, name, inn");
      if (error) throw error;
      return (data || []) as Client[];
    },
  });

  const { data: openInvoices = [] } = useQuery({
    queryKey: ["fin-import-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("id, invoice_number, client_name, amount, status, date_created")
        .in("status", ["sent", "draft"])
        .order("date_created", { ascending: false });
      if (error) throw error;
      return (data || []) as Invoice[];
    },
  });

  const handleFile = async (file: File) => {
    setParsing(true);
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array", cellDates: true });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

      const parsed = parseTochkaStatement(raw);
      const enriched: ParsedRow[] = parsed.map((r) => {
        const matchedClient = r.direction === "income" ? matchClient(r, clients) : null;
        const matchedInvoice = matchInvoice(r, openInvoices, matchedClient);
        return {
          ...r,
          selected: true,
          matchedClient,
          matchedInvoiceId: matchedInvoice?.id || null,
          willCreateClient: r.direction === "income" && !matchedClient && !!r.counterparty,
          duplicate: false,
        };
      });

      // Дубликаты по дате+сумме+направлению (последние 90 дней)
      if (enriched.length > 0) {
        const minDate = enriched.reduce((m, r) => r.date < m ? r.date : m, enriched[0].date);
        const { data: existing } = await supabase
          .from("transactions")
          .select("date, amount, type")
          .gte("date", minDate);
        const set = new Set((existing || []).map((t: any) =>
          `${t.date}|${t.type}|${Number(t.amount).toFixed(2)}`
        ));
        enriched.forEach((r) => {
          const key = `${r.date}|${r.direction}|${r.amount.toFixed(2)}`;
          if (set.has(key)) {
            r.duplicate = true;
            r.selected = false;
          }
        });
      }

      setRows(enriched);
      if (enriched.length === 0) {
        toast.warning("В файле не найдено операций");
      } else {
        const inc = enriched.filter((r) => r.direction === "income").length;
        const exp = enriched.filter((r) => r.direction === "expense").length;
        toast.success(`Распознано: ${inc} приходов, ${exp} расходов`);
      }
    } catch (e: any) {
      console.error(e);
      toast.error("Не удалось разобрать файл: " + (e.message || ""));
    } finally {
      setParsing(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const importMut = useMutation({
    mutationFn: async () => {
      if (!accountId) throw new Error("Выберите банковский счёт");
      const selected = rows.filter((r) => r.selected && !r.duplicate);
      if (selected.length === 0) throw new Error("Нет выбранных операций");

      const { data: userRes } = await supabase.auth.getUser();
      const ownerId = userRes.user?.id;
      if (!ownerId) throw new Error("Не авторизован");

      // 1) Создаём отсутствующих клиентов и обновляем матчинг
      const toCreate = selected.filter((r) => r.willCreateClient && !r.matchedClient);
      const uniqMap = new Map<string, { name: string; inn: string | null }>();
      for (const r of toCreate) {
        const key = r.inn || `name:${r.counterparty.toLowerCase()}`;
        if (!uniqMap.has(key)) uniqMap.set(key, { name: r.counterparty, inn: r.inn });
      }
      const newClientsMap = new Map<string, { id: string; name: string }>();
      if (uniqMap.size > 0) {
        const insertData = Array.from(uniqMap.values()).map((c) => ({ name: c.name, inn: c.inn }));
        const { data: created, error: cErr } = await supabase
          .from("financial_clients")
          .insert(insertData)
          .select("id, name, inn");
        if (cErr) throw cErr;
        (created || []).forEach((c: any) => {
          const key = c.inn || `name:${(c.name || "").toLowerCase()}`;
          newClientsMap.set(key, { id: c.id, name: c.name });
        });

        // Дублируем в CRM-таблицу companies (страница "Компании")
        const innList = insertData.map((c) => c.inn).filter((x): x is string => !!x);
        const { data: existingCompByInn } = innList.length > 0
          ? await supabase.from("companies").select("inn").in("inn", innList)
          : { data: [] as any[] };
        const { data: existingCompByName } = await supabase
          .from("companies")
          .select("name")
          .in("name", insertData.map((c) => c.name));
        const innSet = new Set((existingCompByInn || []).map((c: any) => c.inn));
        const nameSet = new Set((existingCompByName || []).map((c: any) => (c.name || "").toLowerCase()));
        const compRows = insertData
          .filter((c) => !(c.inn && innSet.has(c.inn)) && !nameSet.has(c.name.toLowerCase()))
          .map((c) => ({ name: c.name, inn: c.inn, type: "Клиент", owner_id: ownerId }));
        if (compRows.length > 0) {
          await supabase.from("companies").insert(compRows);
        }
      }

      // 2) Создаём транзакции
      const txInsert = selected.map((r) => {
        const category =
          r.direction === "income"
            ? "invoice"
            : isOwnerWithdrawal(r) ? "owner_withdrawal" : "bank_expense";
        return {
          account_id: accountId,
          type: r.direction,
          amount: r.amount,
          date: r.date,
          category,
          description: `${r.counterparty}${r.purpose ? " · " + r.purpose : ""}`.slice(0, 500),
        };
      });
      const { error: txErr } = await supabase.from("transactions").insert(txInsert);
      if (txErr) throw txErr;

      // 3) Закрываем счета
      const invoiceIds = selected.map((r) => r.matchedInvoiceId).filter((x): x is string => !!x);
      if (invoiceIds.length > 0) {
        await supabase
          .from("invoices")
          .update({ status: "paid", date_paid: format(new Date(), "yyyy-MM-dd"), paid_to_account_id: accountId })
          .in("id", invoiceIds);
      }
      return { count: selected.length, closed: invoiceIds.length, created: uniqMap.size };
    },
    onSuccess: ({ count, closed, created }) => {
      const parts = [`Импортировано: ${count}`];
      if (created > 0) parts.push(`новых клиентов: ${created}`);
      if (closed > 0) parts.push(`закрыто счетов: ${closed}`);
      toast.success(parts.join(" · "));
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-invoices"] });
      qc.invalidateQueries({ queryKey: ["fin-import-clients"] });
      qc.invalidateQueries({ queryKey: ["financial-clients"] });
      qc.invalidateQueries({ queryKey: ["companies"] });
      setOpen(false);
      setConfirmOpen(false);
      setRows([]);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка импорта"),
  });

  // Очистка финансов (транзакции + балансы + откат оплат счетов; клиенты — опционально)
  const [resetOpen, setResetOpen] = useState(false);
  const [alsoClients, setAlsoClients] = useState(false);
  const resetMut = useMutation({
    mutationFn: async () => {
      const { error: e1 } = await supabase.from("transactions").delete().not("id", "is", null);
      if (e1) throw e1;
      const { error: e2 } = await supabase
        .from("financial_accounts")
        .update({ balance: 0 })
        .not("id", "is", null);
      if (e2) throw e2;
      const { error: e3 } = await supabase
        .from("invoices")
        .update({ status: "sent", date_paid: null, paid_to_account_id: null })
        .eq("status", "paid");
      if (e3) throw e3;

      let removedClients = 0;
      if (alsoClients) {
        const { count } = await supabase
          .from("financial_clients")
          .select("id", { count: "exact", head: true });
        const { error: e4 } = await supabase.from("financial_clients").delete().not("id", "is", null);
        if (e4) throw e4;
        removedClients = count || 0;
      }
      return { removedClients };
    },
    onSuccess: ({ removedClients }) => {
      toast.success(
        removedClients > 0
          ? `Финансы очищены · клиентов удалено: ${removedClients}`
          : "Финансы очищены: транзакции, оплаты счетов и балансы сброшены",
      );
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-invoices"] });
      qc.invalidateQueries({ queryKey: ["fin-import-clients"] });
      qc.invalidateQueries({ queryKey: ["financial-clients"] });
      setResetOpen(false);
      setAlsoClients(false);
    },
    onError: (e: any) => toast.error(e.message || "Не удалось очистить финансы"),
  });

  const stats = useMemo(() => {
    const sel = rows.filter((r) => r.selected && !r.duplicate);
    return {
      total: rows.length,
      incomes: rows.filter((r) => r.direction === "income").length,
      expenses: rows.filter((r) => r.direction === "expense").length,
      duplicates: rows.filter((r) => r.duplicate).length,
      matched: rows.filter((r) => r.matchedClient).length,
      willCreate: rows.filter((r) => r.willCreateClient && r.selected && !r.duplicate).length,
      sumIn: sel.filter((r) => r.direction === "income").reduce((s, r) => s + r.amount, 0),
      sumOut: sel.filter((r) => r.direction === "expense").reduce((s, r) => s + r.amount, 0),
    };
  }, [rows]);

  // Уникальный список новых клиентов, которых нужно создать (для подтверждения)
  const newClientsPreview = useMemo(() => {
    const map = new Map<string, { name: string; inn: string | null; sum: number; count: number }>();
    for (const r of rows) {
      if (!r.willCreateClient || !r.selected || r.duplicate) continue;
      const key = r.inn || `name:${r.counterparty.toLowerCase()}`;
      const existing = map.get(key);
      if (existing) {
        existing.sum += r.amount;
        existing.count += 1;
      } else {
        map.set(key, { name: r.counterparty, inn: r.inn, sum: r.amount, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.sum - a.sum);
  }, [rows]);

  const handleImportClick = () => {
    if (!accountId) {
      toast.error("Выберите банковский счёт");
      return;
    }
    if (newClientsPreview.length > 0) {
      setConfirmOpen(true);
    } else {
      importMut.mutate();
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Импорт банковской выписки
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Точка-Банк · Excel · автораспознавание клиентов и автосоздание новых
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="outline" onClick={() => setResetOpen(true)}>
            <Trash2 className="h-4 w-4 mr-1" /> Очистить финансы
          </Button>
          <Button size="sm" onClick={() => setOpen(true)}>
            <Upload className="h-4 w-4 mr-1" /> Загрузить выписку
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Скачайте выписку из Точки в формате Excel (.xlsx) и загрузите сюда. Система найдёт приходы и расходы,
          сопоставит плательщиков с клиентами по ИНН, а новых клиентов создаст автоматически.
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setRows([]); }}>
        <DialogContent className="max-w-6xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Импорт выписки из Точка-Банка</DialogTitle>
            <DialogDescription>
              Дубликаты по дате+сумме+направлению отмечены автоматически. Новые клиенты создадутся при импорте.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 py-2">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Счёт зачисления / списания" />
              </SelectTrigger>
              <SelectContent>
                {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls,.csv"
              className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
            <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={parsing}>
              {parsing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Upload className="h-4 w-4 mr-1" />}
              Выбрать файл
            </Button>
            {rows.length > 0 && (
              <Button variant="ghost" size="sm" onClick={() => setRows([])}>
                <X className="h-4 w-4 mr-1" /> Очистить
              </Button>
            )}
          </div>

          {rows.length > 0 && (
            <>
              <div className="flex flex-wrap gap-2 text-xs">
                <Badge variant="outline">Всего: {stats.total}</Badge>
                <Badge variant="outline" className="border-emerald-500/40 text-emerald-500">
                  ↓ Приходов: {stats.incomes} ({RUB(stats.sumIn)})
                </Badge>
                <Badge variant="outline" className="border-red-500/40 text-red-500">
                  ↑ Расходов: {stats.expenses} ({RUB(stats.sumOut)})
                </Badge>
                <Badge variant="outline" className="border-primary/40">
                  Узнано клиентов: {stats.matched}
                </Badge>
                {stats.willCreate > 0 && (
                  <Badge variant="outline" className="border-blue-500/40 text-blue-500">
                    <UserPlus className="h-3 w-3 mr-1" /> Будет создано клиентов: {stats.willCreate}
                  </Badge>
                )}
                {stats.duplicates > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                    Дубликатов: {stats.duplicates}
                  </Badge>
                )}
              </div>

              <div className="overflow-auto flex-1 border rounded-md mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
                      <th className="text-left p-2 w-8"></th>
                      <th className="text-left p-2 w-8"></th>
                      <th className="text-left p-2">Дата</th>
                      <th className="text-left p-2">Контрагент</th>
                      <th className="text-left p-2">ИНН</th>
                      <th className="text-left p-2">Назначение</th>
                      <th className="text-left p-2">Клиент / Счёт</th>
                      <th className="text-right p-2">Сумма</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((r, idx) => {
                      const matchedInv = openInvoices.find((i) => i.id === r.matchedInvoiceId);
                      const isIncome = r.direction === "income";
                      return (
                        <tr key={idx} className={`border-t ${r.duplicate ? "opacity-50 bg-amber-500/5" : ""}`}>
                          <td className="p-2">
                            <Checkbox
                              checked={r.selected}
                              disabled={r.duplicate}
                              onCheckedChange={(v) => {
                                setRows((prev) => prev.map((x, i) => i === idx ? { ...x, selected: !!v } : x));
                              }}
                            />
                          </td>
                          <td className="p-2">
                            {isIncome
                              ? <ArrowDownLeft className="h-3.5 w-3.5 text-emerald-500" />
                              : <ArrowUpRight className="h-3.5 w-3.5 text-red-500" />}
                          </td>
                          <td className="p-2 whitespace-nowrap">{r.date}</td>
                          <td className="p-2 max-w-[220px] truncate" title={r.rawCounterparty}>{r.counterparty}</td>
                          <td className="p-2 font-mono">{r.inn || "—"}</td>
                          <td className="p-2 max-w-[260px] truncate text-muted-foreground" title={r.purpose}>{r.purpose}</td>
                          <td className="p-2">
                            {!isIncome ? (
                              <span className="text-muted-foreground">—</span>
                            ) : r.duplicate ? (
                              <span className="flex items-center gap-1 text-amber-500">
                                <AlertCircle className="h-3 w-3" /> Дубликат
                              </span>
                            ) : matchedInv ? (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <CheckCircle2 className="h-3 w-3" /> {matchedInv.invoice_number}
                              </span>
                            ) : r.matchedClient ? (
                              <span className="text-primary">{r.matchedClient.name}</span>
                            ) : r.willCreateClient ? (
                              <span className="flex items-center gap-1 text-blue-500">
                                <UserPlus className="h-3 w-3" /> Создать: {r.counterparty}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">Не сопоставлено</span>
                            )}
                          </td>
                          <td className={`p-2 text-right font-semibold whitespace-nowrap ${isIncome ? "text-emerald-500" : "text-red-500"}`}>
                            {isIncome ? "+" : "−"}{RUB(r.amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Закрыть</Button>
            <Button
              onClick={handleImportClick}
              disabled={importMut.isPending || rows.length === 0 || !accountId}
            >
              {importMut.isPending ? "Импорт..." : `Импортировать ${rows.filter((r) => r.selected && !r.duplicate).length} операций`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Подтверждение создания новых клиентов */}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent className="max-w-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserPlus className="h-5 w-5 text-blue-500" />
              Подтвердите создание новых клиентов
            </AlertDialogTitle>
            <AlertDialogDescription>
              При импорте будет создано <span className="font-semibold text-foreground">{newClientsPreview.length}</span>{" "}
              {newClientsPreview.length === 1 ? "новый клиент" : "новых клиентов"}. Проверьте список перед подтверждением.
              Привязку к проектам можно будет добавить позже вручную.
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="max-h-[50vh] overflow-auto border rounded-md">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  <th className="text-left p-2">Клиент</th>
                  <th className="text-left p-2">ИНН</th>
                  <th className="text-right p-2">Операций</th>
                  <th className="text-right p-2">Сумма</th>
                </tr>
              </thead>
              <tbody>
                {newClientsPreview.map((c, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-2 font-medium">{c.name}</td>
                    <td className="p-2 font-mono text-xs text-muted-foreground">{c.inn || "—"}</td>
                    <td className="p-2 text-right">{c.count}</td>
                    <td className="p-2 text-right font-semibold text-emerald-500">{RUB(c.sum)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <AlertDialogFooter>
            <AlertDialogCancel disabled={importMut.isPending}>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                importMut.mutate();
              }}
              disabled={importMut.isPending}
            >
              {importMut.isPending ? "Импорт..." : `Создать ${newClientsPreview.length} и импортировать`}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}

// ===== Парсер выписки Точка-Банка =====
// Заголовки на строке 2: [Номер документа | Дата документа | Дата операции | Счёт |
//   Контрагент | ИНН контрагента | БИК | Корр.счёт | Наим.банка | Счёт контрагента |
//   Списание | Зачисление | Назначение платежа]

function parseTochkaStatement(rows: any[][]): Omit<ParsedRow, "selected" | "matchedClient" | "matchedInvoiceId" | "willCreateClient" | "duplicate">[] {
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = (rows[i] || []).map((c) => String(c ?? "").trim().toLowerCase());
    const joined = r.join("|");
    if (joined.includes("зачислен") && joined.includes("списан")) {
      headerIdx = i; headers = r; break;
    }
  }
  if (headerIdx === -1) return [];

  const findCol = (...keys: string[]) =>
    headers.findIndex((h) => keys.some((k) => h.includes(k)));

  const colDateOp = headers.findIndex((h) => h.includes("дата операции"));
  const colDateDoc = headers.findIndex((h) => h.includes("дата документа"));
  const colDate = colDateOp >= 0 ? colDateOp : (colDateDoc >= 0 ? colDateDoc : findCol("дата"));

  const colCredit = findCol("зачислен");  // приход (L)
  const colDebit = findCol("списан");     // расход (K)

  const colInn = headers.findIndex((h) => h.includes("инн контрагент"));
  const colInnFallback = findCol("инн");
  const colCounterparty = findCol("контраген", "плательщик", "получатель");
  const colPurpose = findCol("назначен", "основание", "комментар");

  const result: Omit<ParsedRow, "selected" | "matchedClient" | "matchedInvoiceId" | "willCreateClient" | "duplicate">[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.every((c) => !String(c ?? "").trim())) continue;

    const date = parseDate(colDate >= 0 ? row[colDate] : null);
    if (!date) continue;

    const credit = colCredit >= 0 ? parseAmount(row[colCredit]) : 0;
    const debit = colDebit >= 0 ? parseAmount(row[colDebit]) : 0;

    let direction: Direction;
    let amount: number;
    if (credit > 0) { direction = "income"; amount = credit; }
    else if (debit > 0) { direction = "expense"; amount = debit; }
    else continue;

    const rawCounterparty = colCounterparty >= 0 ? String(row[colCounterparty] ?? "") : "";
    const counterparty = cleanCounterparty(rawCounterparty);
    const innRaw = colInn >= 0 ? row[colInn] : (colInnFallback >= 0 ? row[colInnFallback] : null);
    const inn = innRaw ? (String(innRaw).trim().replace(/\D/g, "") || null) : null;
    const purpose = colPurpose >= 0 ? String(row[colPurpose] ?? "").replace(/\s+/g, " ").trim() : "";

    result.push({ date, direction, amount, counterparty, rawCounterparty: rawCounterparty.trim(), inn, purpose });
  }

  return result;
}

// Очистка имени: убираем переносы строк, лишние кавычки и пробелы
function cleanCounterparty(s: string): string {
  return s
    .replace(/\s+/g, " ")
    .replace(/^["«»\s]+|["«»\s]+$/g, "")
    .trim();
}

function parseDate(v: any): string | null {
  if (v === null || v === undefined || v === "") return null;
  if (v instanceof Date && !isNaN(v.getTime())) return format(v, "yyyy-MM-dd");
  if (typeof v === "number" && isFinite(v)) {
    const d = new Date(Math.round((v - 25569) * 86400 * 1000));
    if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  }
  const s = String(v).trim();
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  return null;
}

function parseAmount(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Math.abs(v);
  const s = String(v).replace(/\s/g, "").replace(/[₽руб.]/gi, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

// Перевод на карту физлица / себе → вывод прибыли владельцу
function isOwnerWithdrawal(r: { counterparty: string; purpose: string; inn: string | null }): boolean {
  const text = `${r.counterparty} ${r.purpose}`.toLowerCase();
  const isPhysical = !!r.inn && r.inn.replace(/\D/g, "").length === 12;
  const keywords = [
    "перевод на карт", "перевод средств на карт", "на карту физ", "на карту физическ",
    "на счёт физ", "на счет физ", "перечисление на карт",
    "перевод собственных средств", "вывод средств", "снятие наличных",
    "выдача наличных", "пополнение счёта физ", "пополнение счета физ",
    "card2card", "c2c",
  ];
  if (keywords.some((k) => text.includes(k))) return true;
  const looksLikeFio = /[а-яё]+\s+[а-яё]\.\s*[а-яё]\.|[а-яё]{3,}\s+[а-яё]{3,}\s+[а-яё]{3,}/i.test(r.counterparty);
  if (isPhysical && looksLikeFio) return true;
  return false;
}

function matchClient(
  row: { counterparty: string; inn: string | null; purpose: string },
  clients: Client[],
): { id: string; name: string } | null {
  if (clients.length === 0) return null;

  // 1) Точное совпадение по ИНН — приоритет
  if (row.inn) {
    const byInn = clients.find((c) => c.inn && c.inn.replace(/\D/g, "") === row.inn);
    if (byInn) return { id: byInn.id, name: byInn.name };
  }

  // 2) По имени (нечёткое)
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[«»"'`]/g, "")
      .replace(/\b(ооо|оао|пао|зао|ип|индивидуальный предприниматель|общество с ограниченной ответственностью|гкфх|филиал)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

  const hay = normalize(`${row.counterparty} ${row.purpose}`);
  const STOP = new Set(["ооо", "оао", "пао", "зао", "ип", "общество", "ограниченной", "ответственностью", "индивидуальный", "предприниматель", "банк", "точка"]);

  for (const c of clients) {
    const nm = normalize(c.name);
    if (!nm) continue;
    if (hay.includes(nm) && nm.length >= 4) return { id: c.id, name: c.name };
    const words = nm.split(/[\s,.()]+/).filter((w) => w.length >= 4 && !STOP.has(w));
    if (words.length > 0 && words.every((w) => hay.includes(w))) return { id: c.id, name: c.name };
    if (words.some((w) => w.length >= 6 && hay.includes(w))) return { id: c.id, name: c.name };
  }
  return null;
}

function matchInvoice(
  row: { amount: number; date: string; direction: Direction },
  invoices: Invoice[],
  client: { id: string; name: string } | null,
): Invoice | null {
  if (!client || row.direction !== "income") return null;
  const candidates = invoices.filter(
    (i) => i.client_name.toLowerCase().trim() === client.name.toLowerCase().trim() &&
           Math.abs(Number(i.amount) - row.amount) < 1,
  );
  if (candidates.length === 0) return null;
  candidates.sort((a, b) =>
    Math.abs(new Date(a.date_created).getTime() - new Date(row.date).getTime()) -
    Math.abs(new Date(b.date_created).getTime() - new Date(row.date).getTime()),
  );
  return candidates[0];
}
