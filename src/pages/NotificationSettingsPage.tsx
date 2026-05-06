import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Bell, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { DEFAULT_NOTIFICATION_SETTINGS } from "@/lib/notification-preferences";

type Settings = Record<string, boolean>;

const GROUPS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: "Задачи",
    items: [
      { key: "task_assigned", label: "Назначена задача на меня" },
      { key: "task_status_changed", label: "Изменён статус моей задачи" },
      { key: "task_deadline_soon", label: "Приближается дедлайн (за 24ч)" },
      { key: "task_overdue", label: "Задача просрочена" },
      { key: "task_any_change", label: "Любое изменение в задачах проекта" },
      { key: "task_comment", label: "Новый комментарий в моей задаче" },
      { key: "task_mention", label: "Меня упомянули @" },
    ],
  },
  {
    title: "Проекты",
    items: [
      { key: "project_new_task", label: "Новая задача в моём проекте" },
      { key: "project_any_event", label: "Любое событие в проекте" },
    ],
  },
  {
    title: "Система",
    items: [
      { key: "audit_complete", label: "Технический аудит завершён" },
      { key: "weekly_report", label: "Еженедельный отчёт готов" },
      { key: "new_employee", label: "Новый сотрудник добавлен" },
    ],
  },
  {
    title: "Способ доставки",
    items: [
      { key: "email_notifications", label: "Email уведомления" },
    ],
  },
];

export default function NotificationSettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [local, setLocal] = useState<Settings>(DEFAULT_NOTIFICATION_SETTINGS);

  const { data, isLoading } = useQuery({
    queryKey: ["notification_settings", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notification_settings" as any)
        .select("settings")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return ((data as any)?.settings as Settings) ?? null;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (data) setLocal({ ...DEFAULT_NOTIFICATION_SETTINGS, ...data });
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notification_settings" as any)
        .upsert({ user_id: user!.id, settings: local }, { onConflict: "user_id" });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Настройки сохранены" });
      queryClient.invalidateQueries({ queryKey: ["notification_settings", user?.id] });
    },
    onError: (e: any) => toast({ title: "Ошибка", description: e.message, variant: "destructive" }),
  });

  if (isLoading) {
    return (
      <div className="flex h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-6">
      <div className="flex items-center gap-3">
        <Bell className="h-6 w-6 text-primary" />
        <h1 className="text-2xl font-bold">Настройки уведомлений</h1>
      </div>

      <Card>
        <CardContent className="p-6 space-y-6">
          {GROUPS.map((group, gi) => (
            <div key={group.title} className="space-y-3">
              {gi > 0 && <Separator />}
              <CardHeader className="p-0 pt-2">
                <CardTitle className="text-base">{group.title}</CardTitle>
              </CardHeader>
              <div className="space-y-3">
                {group.items.map((item) => (
                  <div key={item.key} className="flex items-center justify-between">
                    <span className="text-sm">{item.label}</span>
                    <Switch
                      checked={local[item.key] ?? false}
                      onCheckedChange={(v) => setLocal((s) => ({ ...s, [item.key]: v }))}
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}

          <div className="flex justify-end pt-2">
            <Button onClick={() => save.mutate()} disabled={save.isPending}>
              {save.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Сохранить настройки
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
