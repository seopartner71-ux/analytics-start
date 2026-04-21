import { useState, useMemo, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Upload, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";
import * as XLSX from "xlsx";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

type ParsedRow = {
  selected: boolean;
  date: string;          // yyyy-MM-dd
  amount: number;        // > 0 = приход
  counterparty: string;  // плательщик
  inn: string | null;
  purpose: string;       // назначение
  matchedClient: { id: string; name: string } | null;
  matchedInvoiceId: string | null;
  duplicate: boolean;
};

type Account = { id: string; name: string };
type Client = { id: string; name: string };
type Invoice = { id: string; invoice_number: string; client_name: string; amount: number; status: string; date_created: string };

export function BankImportBlock() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [accountId, setAccountId] = useState<string>("");
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [parsing, setParsing] = useState(false);
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
      const { data, error } = await supabase.from("financial_clients").select("id, name");
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
      // raw: true — сохраняем Date-объекты (иначе xlsx форматирует их в локальные строки и ломает порядок дд/мм/гг)
      const raw: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: "" });

      const parsed = parseTochkaStatement(raw);
      // Фильтруем только приходы и обогащаем матчингом
      const enriched: ParsedRow[] = parsed
        .filter((r) => r.amount > 0)
        .map((r) => {
          const matchedClient = matchClient(r, clients);
          const matchedInvoice = matchInvoice(r, openInvoices, matchedClient);
          return {
            ...r,
            selected: true,
            matchedClient,
            matchedInvoiceId: matchedInvoice?.id || null,
            duplicate: false,
          };
        });

      // Проверка дубликатов: по дате+сумме за последние 90 дней
      if (enriched.length > 0) {
        const minDate = enriched.reduce((m, r) => r.date < m ? r.date : m, enriched[0].date);
        const { data: existing } = await supabase
          .from("transactions")
          .select("date, amount")
          .eq("type", "income")
          .gte("date", minDate);
        const set = new Set((existing || []).map((t: any) => `${t.date}|${Number(t.amount).toFixed(2)}`));
        enriched.forEach((r) => {
          if (set.has(`${r.date}|${r.amount.toFixed(2)}`)) {
            r.duplicate = true;
            r.selected = false;
          }
        });
      }

      setRows(enriched);
      if (enriched.length === 0) {
        toast.warning("В файле не найдено приходных операций");
      } else {
        toast.success(`Распознано ${enriched.length} приходов`);
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

      // 1) Создаём транзакции (триггер обновит баланс)
      const txInsert = selected.map((r) => ({
        account_id: accountId,
        type: "income" as const,
        amount: r.amount,
        date: r.date,
        category: "invoice",
        description: `${r.counterparty}${r.purpose ? " · " + r.purpose : ""}`.slice(0, 500),
      }));
      const { error: txErr } = await supabase.from("transactions").insert(txInsert);
      if (txErr) throw txErr;

      // 2) Закрываем счета, которые удалось замэтчить
      const invoiceIds = selected.map((r) => r.matchedInvoiceId).filter((x): x is string => !!x);
      if (invoiceIds.length > 0) {
        await supabase
          .from("invoices")
          .update({ status: "paid", date_paid: format(new Date(), "yyyy-MM-dd"), paid_to_account_id: accountId })
          .in("id", invoiceIds);
      }
      return { count: selected.length, closed: invoiceIds.length };
    },
    onSuccess: ({ count, closed }) => {
      toast.success(`Импортировано приходов: ${count}. Закрыто счетов: ${closed}`);
      qc.invalidateQueries({ queryKey: ["fin-accounts"] });
      qc.invalidateQueries({ queryKey: ["fin-tx-year"] });
      qc.invalidateQueries({ queryKey: ["fin-invoices"] });
      setOpen(false);
      setRows([]);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка импорта"),
  });

  const stats = useMemo(() => {
    const sel = rows.filter((r) => r.selected && !r.duplicate);
    return {
      total: rows.length,
      duplicates: rows.filter((r) => r.duplicate).length,
      matched: rows.filter((r) => r.matchedClient).length,
      sum: sel.reduce((s, r) => s + r.amount, 0),
    };
  }, [rows]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 pb-3">
        <div>
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4" /> Импорт банковской выписки
          </CardTitle>
          <p className="text-xs text-muted-foreground mt-1">
            Точка-Банк · CSV или Excel · автораспознавание клиентов и закрытие счетов
          </p>
        </div>
        <Button size="sm" onClick={() => setOpen(true)}>
          <Upload className="h-4 w-4 mr-1" /> Загрузить выписку
        </Button>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          Скачайте выписку из Точки в формате Excel (.xlsx) и загрузите сюда — система найдёт приходы,
          сопоставит с клиентами по ИНН и названию, и автоматически закроет совпавшие счета.
        </p>
      </CardContent>

      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setRows([]); }}>
        <DialogContent className="max-w-5xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Импорт выписки из Точка-Банка</DialogTitle>
            <DialogDescription>
              Поддерживаются .xlsx и .csv. Дубликаты по дате и сумме отмечены автоматически.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center gap-3 py-2">
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger className="w-[280px]">
                <SelectValue placeholder="Счёт зачисления" />
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
                  Распознано клиентов: {stats.matched}
                </Badge>
                {stats.duplicates > 0 && (
                  <Badge variant="outline" className="border-amber-500/40 text-amber-500">
                    Дубликатов: {stats.duplicates}
                  </Badge>
                )}
                <Badge variant="outline" className="border-primary/40">
                  К импорту: {RUB(stats.sum)}
                </Badge>
              </div>

              <div className="overflow-auto flex-1 border rounded-md mt-2">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 sticky top-0">
                    <tr>
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
                          <td className="p-2 whitespace-nowrap">{r.date}</td>
                          <td className="p-2 max-w-[200px] truncate" title={r.counterparty}>{r.counterparty}</td>
                          <td className="p-2 font-mono">{r.inn || "—"}</td>
                          <td className="p-2 max-w-[260px] truncate text-muted-foreground" title={r.purpose}>{r.purpose}</td>
                          <td className="p-2">
                            {r.duplicate ? (
                              <span className="flex items-center gap-1 text-amber-500">
                                <AlertCircle className="h-3 w-3" /> Дубликат
                              </span>
                            ) : matchedInv ? (
                              <span className="flex items-center gap-1 text-emerald-500">
                                <CheckCircle2 className="h-3 w-3" /> {matchedInv.invoice_number}
                              </span>
                            ) : r.matchedClient ? (
                              <span className="text-primary">{r.matchedClient.name}</span>
                            ) : (
                              <span className="text-muted-foreground">Не сопоставлено</span>
                            )}
                          </td>
                          <td className="p-2 text-right font-semibold whitespace-nowrap">{RUB(r.amount)}</td>
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
              onClick={() => importMut.mutate()}
              disabled={importMut.isPending || rows.length === 0 || !accountId}
            >
              {importMut.isPending ? "Импорт..." : `Импортировать ${rows.filter((r) => r.selected && !r.duplicate).length} операций`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

// ===== Парсер выписки Точка-Банка =====
// Формат файла Точки (xlsx, экспорт из ЛК):
// Заголовки (обычно строка 2): [Номер документа | Дата документа | Дата операции | Счёт |
//   Контрагент | ИНН контрагента | БИК банка контрагента | Корр.счёт банка контрагента |
//   Наименование банка контрагента | Счёт контрагента | Списание | Зачисление | Назначение платежа]

function parseTochkaStatement(rows: any[][]): Omit<ParsedRow, "selected" | "matchedClient" | "matchedInvoiceId" | "duplicate">[] {
  // Ищем строку заголовка — она должна содержать "зачисление" и "списание" (Точка),
  // либо как fallback — "дата" и "сумма".
  let headerIdx = -1;
  let headers: string[] = [];
  for (let i = 0; i < Math.min(rows.length, 30); i++) {
    const r = (rows[i] || []).map((c) => String(c ?? "").trim().toLowerCase());
    const joined = r.join("|");
    if (joined.includes("зачислен") && joined.includes("списан")) {
      headerIdx = i;
      headers = r;
      break;
    }
    if (headerIdx === -1 && joined.includes("дата") && joined.includes("сумма")) {
      headerIdx = i;
      headers = r;
    }
  }
  if (headerIdx === -1) return [];

  const findCol = (...keys: string[]) =>
    headers.findIndex((h) => keys.some((k) => h.includes(k)));

  // Точка: "Дата операции" приоритетнее "Даты документа"
  const colDateOp = headers.findIndex((h) => h.includes("дата операции"));
  const colDateDoc = headers.findIndex((h) => h.includes("дата документа"));
  const colDate = colDateOp >= 0 ? colDateOp : (colDateDoc >= 0 ? colDateDoc : findCol("дата"));

  const colCredit = findCol("зачислен", "приход", "кредит"); // приход
  const colDebit = findCol("списан", "расход", "дебет");     // расход
  const colAmount = findCol("сумма");

  // ИНН контрагента (а не нашей компании)
  const colInn = headers.findIndex((h) => h.includes("инн контрагент"));
  const colInnFallback = findCol("инн");

  const colCounterparty = findCol("контраген", "плательщик", "получатель");
  const colPurpose = findCol("назначен", "основание", "комментар");

  const result: Omit<ParsedRow, "selected" | "matchedClient" | "matchedInvoiceId" | "duplicate">[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i] || [];
    if (row.every((c) => !String(c ?? "").trim())) continue;

    const date = parseDate(colDate >= 0 ? row[colDate] : null);
    if (!date) continue;

    let amount = 0;
    if (colCredit >= 0) {
      const credit = parseAmount(row[colCredit]);
      if (credit > 0) amount = credit;
    }
    if (amount === 0 && colDebit >= 0) {
      const debit = parseAmount(row[colDebit]);
      if (debit > 0) amount = -debit;
    }
    if (amount === 0 && colAmount >= 0) amount = parseAmount(row[colAmount]);
    if (amount === 0) continue;

    const counterparty = colCounterparty >= 0 ? String(row[colCounterparty] ?? "").replace(/\s+/g, " ").trim() : "";
    const innRaw = colInn >= 0 ? row[colInn] : (colInnFallback >= 0 ? row[colInnFallback] : null);
    const inn = innRaw ? String(innRaw).trim().replace(/\D/g, "") || null : null;
    const purpose = colPurpose >= 0 ? String(row[colPurpose] ?? "").replace(/\s+/g, " ").trim() : "";

    result.push({ date, amount, counterparty, inn, purpose });
  }

  return result;
}

function parseDate(v: any): string | null {
  if (!v) return null;
  if (v instanceof Date) return format(v, "yyyy-MM-dd");
  const s = String(v).trim();
  // dd.MM.yyyy или dd/MM/yyyy
  const m = s.match(/^(\d{1,2})[.\/-](\d{1,2})[.\/-](\d{2,4})$/);
  if (m) {
    const [, d, mo, y] = m;
    const year = y.length === 2 ? `20${y}` : y;
    return `${year}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}`;
  }
  // ISO
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s);
  if (!isNaN(d.getTime())) return format(d, "yyyy-MM-dd");
  return null;
}

function parseAmount(v: any): number {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return Math.abs(v);
  const s = String(v).replace(/\s/g, "").replace(/[₽руб.]/gi, "").replace(",", ".");
  const n = parseFloat(s);
  return isNaN(n) ? 0 : Math.abs(n);
}

function matchClient(
  row: { counterparty: string; inn: string | null; purpose: string },
  clients: Client[],
): { id: string; name: string } | null {
  if (clients.length === 0) return null;
  const normalize = (s: string) =>
    s.toLowerCase()
      .replace(/[«»"'`]/g, "")
      .replace(/\b(ооо|оао|пао|зао|ип|индивидуальный предприниматель|общество с ограниченной ответственностью|гкфх)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

  const hay = normalize(`${row.counterparty} ${row.purpose}`);
  const STOP = new Set(["ооо", "оао", "пао", "зао", "иип", "общество", "ограниченной", "ответственностью", "индивидуальный", "предприниматель"]);

  for (const c of clients) {
    const nm = normalize(c.name);
    if (!nm) continue;
    if (hay.includes(nm)) return c;
    const words = nm.split(/[\s,.()]+/).filter((w) => w.length >= 4 && !STOP.has(w));
    if (words.length > 0 && words.every((w) => hay.includes(w))) return c;
    if (words.some((w) => w.length >= 6 && hay.includes(w))) return c;
  }
  return null;
}

function matchInvoice(
  row: { amount: number; date: string },
  invoices: Invoice[],
  client: { id: string; name: string } | null,
): Invoice | null {
  if (!client) return null;
  // Совпадение по клиенту + сумме (±1₽)
  const candidates = invoices.filter(
    (i) => i.client_name.toLowerCase().trim() === client.name.toLowerCase().trim() &&
           Math.abs(Number(i.amount) - row.amount) < 1,
  );
  if (candidates.length === 0) return null;
  // Ближайший по дате
  candidates.sort((a, b) =>
    Math.abs(new Date(a.date_created).getTime() - new Date(row.date).getTime()) -
    Math.abs(new Date(b.date_created).getTime() - new Date(row.date).getTime()),
  );
  return candidates[0];
}
