import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { CLIENT_STATUSES, CLIENT_TYPES } from "@/lib/clientReports";
import { useResponsibles, type FinClient } from "@/hooks/useClientReports";

const EMPTY: Partial<FinClient> = {
  name: "", client_type: "company", status: "active", report_enabled: false, report_day: null,
};

const ORG_STATUS_RU: Record<string, string> = {
  ACTIVE: "Действующая",
  LIQUIDATING: "В процессе ликвидации",
  LIQUIDATED: "Ликвидирована",
  BANKRUPT: "Банкротство",
  REORGANIZING: "В процессе реорганизации",
};

function normalizeSite(v: string) {
  const s = v.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export function ClientFormDialog({
  open, onOpenChange, client,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  client?: FinClient | null;
}) {
  const qc = useQueryClient();
  const { data: responsibles = [] } = useResponsibles();
  const [form, setForm] = useState<Partial<FinClient>>(EMPTY);

  useEffect(() => {
    if (open) setForm(client ? { ...client } : { ...EMPTY });
  }, [open, client]);

  const set = <K extends keyof FinClient>(k: K, v: FinClient[K] | null) =>
    setForm((f) => ({ ...f, [k]: v as never }));

  const [loadingInn, setLoadingInn] = useState(false);
  const [lastInn, setLastInn] = useState("");
  const [innError, setInnError] = useState<string | null>(null);

  const lookupInn = async (raw?: string, silent = false) => {
    const inn = (raw ?? form.inn ?? "").replace(/\D/g, "");
    if (inn.length !== 10 && inn.length !== 12) {
      if (!silent && inn.length > 0) setInnError("ИНН должен содержать 10 или 12 цифр");
      return;
    }
    if (inn === lastInn || loadingInn) return;
    setInnError(null);
    setLoadingInn(true);
    try {
      const { data, error } = await supabase.functions.invoke("dadata-party", { body: { inn } });
      if (error) {
        const details = "context" in error ? await (error as { context: Response }).context.text() : error.message;
        let msg = "Не удалось получить данные по ИНН";
        try { msg = JSON.parse(details)?.error || msg; } catch { /* ignore */ }
        throw new Error(msg);
      }
      setLastInn(inn);
      setForm((f) => ({
        ...f,
        inn: data.inn || f.inn,
        legal_name: data.legal_name || f.legal_name,
        short_name: data.short_name || f.short_name,
        kpp: data.kpp || f.kpp,
        ogrn: data.ogrn || f.ogrn,
        legal_address: data.legal_address || f.legal_address,
        actual_address: f.actual_address || data.legal_address || null,
        management_name: data.management || f.management_name,
        org_status: (data.status ? ORG_STATUS_RU[data.status] || data.status : null) || f.org_status,
        okved: data.okved || f.okved,
        okved_name: data.okved_name || f.okved_name,
        name: (f.name || "").trim() || data.short_name || data.legal_name || "",
      }));
      toast.success("Реквизиты подставлены по ИНН");
    } catch (e) {
      setInnError((e as Error).message);
      if (!silent) toast.error((e as Error).message);
    } finally {
      setLoadingInn(false);
    }
  };

  // Автопоиск по ИНН при вводе 10/12 цифр
  useEffect(() => {
    const inn = (form.inn || "").replace(/\D/g, "");
    if (inn.length !== 10 && inn.length !== 12) return;
    if (inn === lastInn) return;
    const t = setTimeout(() => { void lookupInn(inn, true); }, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.inn, lastInn]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        name: (form.name || "").trim(),
        client_type: form.client_type || null,
        phone: form.phone || null,
        email: form.email || null,
        telegram: form.telegram || null,
        website: normalizeSite(form.website || ""),
        responsible_id: form.responsible_id || null,
        status: form.status || "active",
        notes: form.notes || null,
        legal_name: form.legal_name || null,
        short_name: form.short_name || null,
        management_name: form.management_name || null,
        org_status: form.org_status || null,
        okved: form.okved || null,
        okved_name: form.okved_name || null,
        inn: form.inn || null,
        kpp: form.kpp || null,
        ogrn: form.ogrn || null,
        legal_address: form.legal_address || null,
        actual_address: form.actual_address || null,
        account_number: form.account_number || null,
        bank_name: form.bank_name || null,
        bik: form.bik || null,
        correspondent_account: form.correspondent_account || null,
        other_requisites: form.other_requisites || null,
        report_day: form.report_day ? Number(form.report_day) : null,
        report_enabled: !!form.report_enabled && !!form.report_day,
      };
      if (!payload.name) throw new Error("Укажите название клиента");
      if (!payload.website) throw new Error("Укажите сайт клиента");
      if (client?.id) {
        const { error } = await supabase.from("financial_clients").update(payload).eq("id", client.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("financial_clients").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fin-clients"] });
      toast.success(client ? "Клиент обновлён" : "Клиент добавлен");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const field = (label: string, key: keyof FinClient, placeholder?: string) => (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <Input
        className="h-9"
        value={(form[key] as string) || ""}
        placeholder={placeholder}
        onChange={(e) => set(key, e.target.value as never)}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{client ? "Клиент" : "Новый клиент"}</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="main">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="main">Основное</TabsTrigger>
            <TabsTrigger value="req">Реквизиты</TabsTrigger>
            <TabsTrigger value="report">Отчётность</TabsTrigger>
          </TabsList>

          <TabsContent value="main" className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">{field("Название / ФИО клиента", "name", "Иванов")}</div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Тип клиента</Label>
              <Select value={form.client_type || "company"} onValueChange={(v) => set("client_type", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Статус</Label>
              <Select value={form.status || "active"} onValueChange={(v) => set("status", v)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLIENT_STATUSES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            {field("Телефон", "phone", "+7 …")}
            {field("Email", "email", "client@mail.ru")}
            {field("Telegram", "telegram", "@username")}
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Сайт клиента *</Label>
              <Input
                className="h-9"
                value={form.website || ""}
                placeholder="example.ru"
                onChange={(e) => set("website", e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Ответственный</Label>
              <Select
                value={form.responsible_id || "none"}
                onValueChange={(v) => set("responsible_id", v === "none" ? null : v)}
              >
                <SelectTrigger className="h-9"><SelectValue placeholder="Не назначен" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не назначен</SelectItem>
                  {responsibles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.full_name || r.email}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Заметки</Label>
              <Textarea
                className="min-h-[70px]"
                value={form.notes || ""}
                onChange={(e) => set("notes", e.target.value)}
              />
            </div>
          </TabsContent>

          <TabsContent value="req" className="mt-4 grid max-h-[55vh] gap-3 overflow-y-auto sm:grid-cols-2">
            <div className="sm:col-span-2">{field("Юридическое название", "legal_name")}</div>
            <div className="sm:col-span-2">{field("Краткое наименование", "short_name")}</div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">ИНН</Label>
              <div className="flex gap-2">
                <Input
                  className="h-9"
                  value={form.inn || ""}
                  placeholder="7707083893"
                  onChange={(e) => set("inn", e.target.value)}
                  onBlur={() => lookupInn()}
                />
                <Button
                  type="button"
                  variant="outline"
                  className="h-9 shrink-0"
                  disabled={loadingInn}
                  onClick={() => lookupInn()}
                >
                  {loadingInn ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Найти"}
                </Button>
              </div>
              {loadingInn && <p className="text-2xs text-muted-foreground">Запрашиваем данные…</p>}
              {innError && !loadingInn && <p className="text-2xs text-destructive">{innError}</p>}
            </div>
            {field("КПП", "kpp")}
            {field("ОГРН / ОГРНИП", "ogrn")}
            {field("БИК", "bik")}
            <div className="sm:col-span-2">{field("Юридический адрес", "legal_address")}</div>
            <div className="sm:col-span-2">{field("Фактический адрес", "actual_address")}</div>
            {field("Руководитель (ФИО)", "management_name")}
            {field("Статус организации", "org_status")}
            {field("Основной ОКВЭД", "okved")}
            {field("Расшифровка ОКВЭД", "okved_name")}
            {field("Расчётный счёт", "account_number")}
            {field("Банк", "bank_name")}
            <div className="sm:col-span-2">{field("Корреспондентский счёт", "correspondent_account")}</div>
            <div className="space-y-1.5 sm:col-span-2">
              <Label className="text-xs text-muted-foreground">Прочие реквизиты</Label>
              <Textarea
                className="min-h-[70px]"
                value={form.other_requisites || ""}
                onChange={(e) => set("other_requisites", e.target.value)}
              />
            </div>
            <p className="text-2xs text-muted-foreground sm:col-span-2">
              Все поля необязательны — заполняйте только нужные.
            </p>
          </TabsContent>

          <TabsContent value="report" className="mt-4 space-y-4">
            <div className="flex items-center justify-between rounded-lg border border-border p-3">
              <div>
                <p className="text-sm font-medium">Контроль отчётности</p>
                <p className="text-xs text-muted-foreground">Напоминания и расчёт следующей даты</p>
              </div>
              <Switch
                checked={!!form.report_enabled}
                onCheckedChange={(v) => set("report_enabled", v as never)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Дата отчётности (день месяца)</Label>
              <Select
                value={form.report_day ? String(form.report_day) : "none"}
                onValueChange={(v) => set("report_day", (v === "none" ? null : Number(v)) as never)}
              >
                <SelectTrigger className="h-9 w-40"><SelectValue placeholder="Не задана" /></SelectTrigger>
                <SelectContent className="max-h-64">
                  <SelectItem value="none">Не задана</SelectItem>
                  {Array.from({ length: 31 }, (_, i) => i + 1).map((d) => (
                    <SelectItem key={d} value={String(d)}>{d} число</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-2xs text-muted-foreground">
                Если в месяце нет выбранного числа, используется последний день месяца.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Отмена</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>Сохранить</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
