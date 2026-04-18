import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import { ru } from "date-fns/locale";
import { Building2, Plus, RefreshCw, Unplug, ArrowDownCircle, ArrowUpCircle, AlertCircle, CheckCircle2 } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

const RUB = (n: number) =>
  new Intl.NumberFormat("ru-RU", { style: "currency", currency: "RUB", maximumFractionDigits: 0 }).format(n || 0);

const PROVIDERS: { value: string; label: string; available: boolean }[] = [
  { value: "tochka", label: "Точка Банк", available: true },
  { value: "tinkoff", label: "Тинькофф (Этап 2)", available: false },
  { value: "sber", label: "Сбер (Этап 3)", available: false },
  { value: "modulbank", label: "Модульбанк (скоро)", available: false },
];

type Integration = {
  id: string;
  provider: string;
  display_name: string;
  status: string;
  last_sync_at: string | null;
  error_message: string | null;
};

type Account = {
  id: string;
  integration_id: string;
  account_number: string;
  bank_name: string;
  currency: string;
  balance: number;
  last_sync_at: string | null;
};

type Transaction = {
  id: string;
  account_id: string;
  operation_date: string;
  amount: number;
  direction: "in" | "out";
  counterparty: string;
  purpose: string;
  category: string;
};

export default function BanksTab({ ownerId }: { ownerId: string | null }) {
  const qc = useQueryClient();
  const [connectOpen, setConnectOpen] = useState(false);
  const [provider, setProvider] = useState("tochka");
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const integrationsQ = useQuery({
    queryKey: ["bank_integrations", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_integrations")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Integration[];
    },
  });

  const accountsQ = useQuery({
    queryKey: ["bank_accounts", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_accounts")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Account[];
    },
  });

  const transactionsQ = useQuery({
    queryKey: ["bank_transactions", ownerId],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bank_transactions")
        .select("*")
        .order("operation_date", { ascending: false })
        .limit(100);
      if (error) throw error;
      return (data ?? []) as Transaction[];
    },
  });

  // Обработка возврата OAuth (?bank_code=...&bank_state=...)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("bank_code") ?? params.get("code");
    const state = params.get("bank_state") ?? params.get("state");
    const provFromQs = params.get("bank_provider") ?? "tochka";
    if (!code || !ownerId) return;
    if (state && state !== ownerId) return;

    (async () => {
      const redirectUri = `${window.location.origin}/finance`;
      const fnName = provFromQs === "tochka" ? "bank-tochka" : "bank-tochka";
      const { data, error } = await supabase.functions.invoke(fnName, {
        body: { action: "exchange_code", code, redirect_uri: redirectUri },
      });
      if (error || data?.error) {
        toast({ title: "Ошибка подключения", description: data?.error ?? error?.message, variant: "destructive" });
      } else {
        toast({ title: "Банк подключён", description: "Запускаю первую синхронизацию…" });
        await supabase.functions.invoke(fnName, {
          body: { action: "sync", integration_id: data.integration_id },
        });
        qc.invalidateQueries({ queryKey: ["bank_integrations"] });
        qc.invalidateQueries({ queryKey: ["bank_accounts"] });
        qc.invalidateQueries({ queryKey: ["bank_transactions"] });
      }
      // очищаем query string
      window.history.replaceState({}, "", "/finance");
    })();
  }, [ownerId, qc]);

  const handleConnect = async () => {
    if (provider !== "tochka") {
      toast({ title: "Скоро", description: "Этот банк будет подключён на следующих этапах." });
      return;
    }
    const redirectUri = `${window.location.origin}/finance`;
    const { data, error } = await supabase.functions.invoke("bank-tochka", {
      body: { action: "get_auth_url", redirect_uri: redirectUri, state: ownerId },
    });
    if (error || data?.error) {
      toast({
        title: "Не удалось получить ссылку",
        description: data?.error ?? error?.message ?? "Проверьте, что добавлены TOCHKA_CLIENT_ID и TOCHKA_CLIENT_SECRET",
        variant: "destructive",
      });
      return;
    }
    window.location.href = data.auth_url;
  };

  const handleSync = async (integrationId: string) => {
    setSyncingId(integrationId);
    const { data, error } = await supabase.functions.invoke("bank-tochka", {
      body: { action: "sync", integration_id: integrationId },
    });
    setSyncingId(null);
    if (error || data?.error) {
      toast({ title: "Ошибка синхронизации", description: data?.error ?? error?.message, variant: "destructive" });
    } else {
      toast({ title: "Синхронизировано", description: `Счетов: ${data.accounts}, операций: ${data.transactions}` });
      qc.invalidateQueries({ queryKey: ["bank_integrations"] });
      qc.invalidateQueries({ queryKey: ["bank_accounts"] });
      qc.invalidateQueries({ queryKey: ["bank_transactions"] });
    }
  };

  const handleDisconnect = async (integrationId: string) => {
    if (!confirm("Отключить банк? Данные счетов и операций сохранятся.")) return;
    const { error } = await supabase.functions.invoke("bank-tochka", {
      body: { action: "disconnect", integration_id: integrationId },
    });
    if (error) {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Банк отключён" });
      qc.invalidateQueries({ queryKey: ["bank_integrations"] });
    }
  };

  const totalBalance = useMemo(
    () => (accountsQ.data ?? []).reduce((s, a) => s + Number(a.balance || 0), 0),
    [accountsQ.data],
  );

  const integrations = integrationsQ.data ?? [];
  const accounts = accountsQ.data ?? [];
  const transactions = transactionsQ.data ?? [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Building2 className="h-5 w-5" /> Банковские счета
          </h3>
          <p className="text-sm text-muted-foreground">
            Общий остаток: <span className="text-foreground font-medium">{RUB(totalBalance)}</span>
          </p>
        </div>
        <Button onClick={() => setConnectOpen(true)}>
          <Plus className="h-4 w-4 mr-1" /> Подключить банк
        </Button>
      </div>

      {/* Карточки интеграций */}
      {integrations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            <Building2 className="h-12 w-12 mx-auto mb-3 opacity-30" />
            <p>Ни одного банка не подключено.</p>
            <p className="text-xs mt-1">Подключите Точку, чтобы видеть остатки и операции в реальном времени.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {integrations.map((it) => {
            const itAccounts = accounts.filter((a) => a.integration_id === it.id);
            const sum = itAccounts.reduce((s, a) => s + Number(a.balance || 0), 0);
            return (
              <Card key={it.id} className="overflow-hidden">
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Building2 className="h-4 w-4" /> {it.display_name}
                    </CardTitle>
                    <StatusBadge status={it.status} />
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div>
                    <div className="text-xs text-muted-foreground">Остаток</div>
                    <div className="text-2xl font-bold">{RUB(sum)}</div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Счетов: {itAccounts.length} ·{" "}
                    {it.last_sync_at
                      ? `обновлено ${format(parseISO(it.last_sync_at), "dd.MM HH:mm", { locale: ru })}`
                      : "ещё не синхронизировано"}
                  </div>
                  {it.error_message && (
                    <div className="text-xs text-destructive flex items-start gap-1">
                      <AlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                      {it.error_message}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      className="flex-1"
                      disabled={it.status === "disconnected" || syncingId === it.id}
                      onClick={() => handleSync(it.id)}
                    >
                      <RefreshCw className={cn("h-3 w-3 mr-1", syncingId === it.id && "animate-spin")} />
                      Синхр.
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDisconnect(it.id)}>
                      <Unplug className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Лента операций */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Последние операции</CardTitle>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Операций пока нет.</p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Дата</TableHead>
                    <TableHead>Контрагент</TableHead>
                    <TableHead>Назначение</TableHead>
                    <TableHead>Категория</TableHead>
                    <TableHead className="text-right">Сумма</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="whitespace-nowrap">
                        {format(parseISO(t.operation_date), "dd.MM.yyyy", { locale: ru })}
                      </TableCell>
                      <TableCell className="max-w-[220px] truncate">{t.counterparty || "—"}</TableCell>
                      <TableCell className="max-w-[320px] truncate text-muted-foreground text-sm">
                        {t.purpose || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {CATEGORY_LABELS[t.category] ?? t.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right whitespace-nowrap">
                        <span
                          className={cn(
                            "inline-flex items-center gap-1 font-medium",
                            t.direction === "in" ? "text-emerald-400" : "text-red-400",
                          )}
                        >
                          {t.direction === "in" ? (
                            <ArrowDownCircle className="h-3 w-3" />
                          ) : (
                            <ArrowUpCircle className="h-3 w-3" />
                          )}
                          {t.direction === "in" ? "+" : "−"}
                          {RUB(t.amount)}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Диалог подключения */}
      <Dialog open={connectOpen} onOpenChange={setConnectOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Подключение банка</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Выберите банк. После подтверждения вы будете перенаправлены в личный кабинет банка для авторизации.
            </p>
            <Select value={provider} onValueChange={setProvider}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDERS.map((p) => (
                  <SelectItem key={p.value} value={p.value} disabled={!p.available}>
                    {p.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              Для Точки нужны <code>TOCHKA_CLIENT_ID</code> и <code>TOCHKA_CLIENT_SECRET</code> из кабинета разработчика
              Точки. Если ещё не настроены — сначала добавьте секреты.
            </p>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConnectOpen(false)}>
              Отмена
            </Button>
            <Button
              onClick={() => {
                setConnectOpen(false);
                handleConnect();
              }}
            >
              Перейти к авторизации
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const CATEGORY_LABELS: Record<string, string> = {
  income: "Поступление",
  expense: "Расход",
  taxes: "Налоги",
  salary: "Зарплата",
  ads: "Реклама",
  other: "Прочее",
};

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string; icon: any }> = {
    active: { label: "Активна", cls: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30", icon: CheckCircle2 },
    pending: { label: "Ожидание", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertCircle },
    expired: { label: "Истёк токен", cls: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: AlertCircle },
    error: { label: "Ошибка", cls: "bg-red-500/15 text-red-400 border-red-500/30", icon: AlertCircle },
    disconnected: { label: "Отключена", cls: "bg-zinc-500/15 text-muted-foreground border-zinc-500/30", icon: Unplug },
  };
  const v = map[status] ?? map.pending;
  const Icon = v.icon;
  return (
    <Badge variant="outline" className={cn("text-xs flex items-center gap-1", v.cls)}>
      <Icon className="h-3 w-3" />
      {v.label}
    </Badge>
  );
}
