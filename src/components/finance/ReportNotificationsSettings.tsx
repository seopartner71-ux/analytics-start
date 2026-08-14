import { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Panel } from "@/components/finance/primitives";
import { supabase } from "@/integrations/supabase/client";
import { useReportSettings, type ReportSettings } from "@/hooks/useClientReports";

const WARN_OPTIONS = [1, 3, 5, 7];

export function ReportNotificationsSettings() {
  const qc = useQueryClient();
  const { data } = useReportSettings();
  const [form, setForm] = useState<Partial<ReportSettings>>({});

  useEffect(() => { if (data) setForm(data); }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const payload = {
        telegram_enabled: !!form.telegram_enabled,
        telegram_chat_id: form.telegram_chat_id || null,
        email_enabled: !!form.email_enabled,
        email_to: form.email_to || null,
        email_from: form.email_from || null,
        warn_days: Number(form.warn_days) || 3,
      };
      if (data?.id) {
        const { error } = await supabase.from("client_report_settings").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("client_report_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["client-report-settings"] });
      toast.success("Настройки сохранены");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const test = useMutation({
    mutationFn: async (channel: "telegram" | "email") => {
      const { data: res, error } = await supabase.functions.invoke("client-report-reminders", {
        body: { action: "test", channel },
      });
      if (error) throw error;
      if (res && (res as { error?: string }).error) throw new Error((res as { error: string }).error);
      return res;
    },
    onSuccess: () => toast.success("Тестовое сообщение отправлено"),
    onError: (e: Error) => toast.error(`Не удалось отправить: ${e.message}`),
  });

  return (
    <Panel title="Уведомления · Отчётность клиентов" subtitle="Автоматические напоминания о сдаче отчётности">
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground">Предупреждать за</Label>
          <Select
            value={String(form.warn_days ?? 3)}
            onValueChange={(v) => setForm((f) => ({ ...f, warn_days: Number(v) }))}
          >
            <SelectTrigger className="h-8 w-28 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {WARN_OPTIONS.map((d) => <SelectItem key={d} value={String(d)}>{d} дн.</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Telegram</p>
              <p className="text-xs text-muted-foreground">Токен бота хранится в защищённых секретах сервера</p>
            </div>
            <Switch
              checked={!!form.telegram_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, telegram_enabled: v }))}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-end gap-2">
            <div className="min-w-[200px] flex-1 space-y-1.5">
              <Label className="text-xs text-muted-foreground">Chat ID получателя</Label>
              <Input
                className="h-8 text-xs"
                value={form.telegram_chat_id || ""}
                placeholder="123456789"
                onChange={(e) => setForm((f) => ({ ...f, telegram_chat_id: e.target.value }))}
              />
            </div>
            <Button size="sm" variant="outline" className="h-8" onClick={() => test.mutate("telegram")} disabled={test.isPending}>
              <Send className="mr-1.5 h-3.5 w-3.5" /> Проверить Telegram
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium">Email</p>
              <p className="text-xs text-muted-foreground">Отправка выполняется на сервере</p>
            </div>
            <Switch
              checked={!!form.email_enabled}
              onCheckedChange={(v) => setForm((f) => ({ ...f, email_enabled: v }))}
            />
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Email получателя</Label>
              <Input
                className="h-8 text-xs"
                value={form.email_to || ""}
                placeholder="me@company.ru"
                onChange={(e) => setForm((f) => ({ ...f, email_to: e.target.value }))}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">Отправитель</Label>
              <Input
                className="h-8 text-xs"
                value={form.email_from || ""}
                placeholder="SEO-CRM <onboarding@resend.dev>"
                onChange={(e) => setForm((f) => ({ ...f, email_from: e.target.value }))}
              />
            </div>
          </div>
          <Button size="sm" variant="outline" className="mt-3 h-8" onClick={() => test.mutate("email")} disabled={test.isPending}>
            <Send className="mr-1.5 h-3.5 w-3.5" /> Отправить тестовое письмо
          </Button>
        </div>

        <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending}>Сохранить настройки</Button>
      </div>
    </Panel>
  );
}
