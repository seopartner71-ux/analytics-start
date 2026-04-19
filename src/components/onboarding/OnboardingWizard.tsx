import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Card } from "@/components/ui/card";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { addDays, format } from "date-fns";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onCreated: () => void;
}

interface Tariff { id: string; code: string; name: string; description: string | null; price_max: number; is_custom: boolean }
interface TeamMember { id: string; full_name: string; role: string }
interface ChecklistTpl { section: string; title: string; assignee_role: "seo" | "manager"; due_day: number; sort_order: number }
interface TaskTpl { id: string; month: number; week: number; title: string; assignee_role: "seo" | "manager" | "director"; sort_order: number }

export function OnboardingWizard({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);

  const [tariffs, setTariffs] = useState<Tariff[]>([]);
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [checklistTpl, setChecklistTpl] = useState<ChecklistTpl[]>([]);
  const [taskTpl, setTaskTpl] = useState<TaskTpl[]>([]);

  // Step 1
  const [name, setName] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [startDate, setStartDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [seoId, setSeoId] = useState<string>("");
  const [managerId, setManagerId] = useState<string>("");
  // Step 2
  const [tariffId, setTariffId] = useState<string>("");
  const [budget, setBudget] = useState<string>("");
  const [firstPayment, setFirstPayment] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [recurrence, setRecurrence] = useState<"monthly" | "quarterly">("monthly");
  // Step 3
  const [contactName, setContactName] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactTg, setContactTg] = useState("");
  const [contactPref, setContactPref] = useState<string>("phone");

  useEffect(() => {
    if (!open) return;
    (async () => {
      const [{ data: t }, { data: tm }, { data: tpl }, { data: tt }] = await Promise.all([
        supabase.from("tariffs").select("*").eq("is_active", true).order("sort_order"),
        supabase.from("team_members").select("id,full_name,role").order("full_name"),
        supabase.from("app_settings").select("value").eq("key", "onboarding_checklist_template").maybeSingle(),
        supabase.from("onboarding_task_templates").select("*").eq("is_active", true).order("sort_order"),
      ]);
      setTariffs((t || []) as any);
      setTeam((tm || []) as any);
      setTaskTpl((tt || []) as any);
      try { setChecklistTpl(tpl?.value ? JSON.parse(tpl.value) : []); } catch { setChecklistTpl([]); }
    })();
  }, [open]);

  const reset = () => {
    setStep(1); setName(""); setSiteUrl(""); setSeoId(""); setManagerId("");
    setTariffId(""); setBudget(""); setRecurrence("monthly");
    setContactName(""); setContactPhone(""); setContactEmail(""); setContactTg(""); setContactPref("phone");
  };

  const selectedTariff = useMemo(() => tariffs.find(t => t.id === tariffId), [tariffs, tariffId]);

  const canNext1 = name.trim() && seoId && managerId;
  const canNext2 = tariffId && (selectedTariff?.is_custom ? Number(budget) > 0 : true);

  const handleSubmit = async () => {
    if (!user) return;
    setSubmitting(true);
    try {
      const finalBudget = selectedTariff?.is_custom ? Number(budget) : (selectedTariff?.price_max || 0);

      // 1. Создаём проект
      const { data: project, error: projErr } = await supabase
        .from("projects")
        .insert({
          owner_id: user.id,
          name: name.trim(),
          url: siteUrl.trim() || null,
          monthly_budget: finalBudget,
          seo_specialist_id: seoId,
          account_manager_id: managerId,
          client_email: contactEmail || null,
          privacy: "Закрытый",
        })
        .select()
        .single();
      if (projErr) throw projErr;

      // 2. Создаём онбординг
      const { data: onb, error: onbErr } = await supabase
        .from("onboarding_projects")
        .insert({
          project_id: project.id,
          owner_id: user.id,
          tariff_id: tariffId,
          tariff_code: selectedTariff!.code,
          contract_budget: finalBudget,
          start_date: startDate,
          first_payment_date: firstPayment || null,
          payment_recurrence: recurrence,
          contact_name: contactName || null,
          contact_phone: contactPhone || null,
          contact_email: contactEmail || null,
          contact_telegram: contactTg || null,
          contact_preferred: contactPref,
          status: "in_progress",
          progress: 0,
        })
        .select()
        .single();
      if (onbErr) throw onbErr;

      // 3. Чеклист (20 пунктов)
      const start = new Date(startDate);
      const items = checklistTpl.map((tpl) => ({
        onboarding_id: onb.id,
        section: tpl.section,
        title: tpl.title,
        assignee_role: tpl.assignee_role,
        assignee_id: tpl.assignee_role === "seo" ? seoId : managerId,
        due_day: tpl.due_day,
        due_date: format(addDays(start, tpl.due_day - 1), "yyyy-MM-dd"),
        sort_order: tpl.sort_order,
      }));
      if (items.length) {
        const { error } = await supabase.from("onboarding_checklist_items").insert(items);
        if (error) throw error;
      }

      // 4. Задачи онбординга по 3 периодам (37 шт) — в отдельную таблицу onboarding_tasks
      const onbTasks = taskTpl.map((t) => {
        const deadline = addDays(start, (t.week - 1) * 7 + 6);
        const assignee = t.assignee_role === "seo" ? seoId : t.assignee_role === "manager" ? managerId : null;
        return {
          onboarding_id: onb.id,
          project_id: project.id,
          template_id: t.id,
          period: t.month,
          week: t.week,
          sort_order: t.sort_order,
          title: t.title,
          assignee_role: t.assignee_role,
          assignee_id: assignee,
          due_date: format(deadline, "yyyy-MM-dd"),
        };
      });
      if (onbTasks.length) {
        const { error } = await supabase.from("onboarding_tasks").insert(onbTasks);
        if (error) throw error;
      }

      // 5. Системное сообщение в чат проекта
      await supabase.from("project_messages").insert({
        project_id: project.id,
        user_id: null,
        user_name: "Система",
        body: `🚀 Проект создан. Онбординг запущен. Тариф: ${selectedTariff?.name}. Старт: ${format(start, "dd.MM.yyyy")}.`,
        is_system: true,
      } as any);

      // 6. Уведомления — назначение исполнителей сработает через триггер notify_task_assigned
      // Дополнительно общее уведомление owner-менеджеру
      const seoMember = team.find(t => t.id === seoId);
      const mgrMember = team.find(t => t.id === managerId);
      const { data: seoRow } = await supabase.from("team_members").select("owner_id").eq("id", seoId).maybeSingle();
      const { data: mgrRow } = await supabase.from("team_members").select("owner_id").eq("id", managerId).maybeSingle();
      const notifs: any[] = [];
      if (seoRow?.owner_id) notifs.push({
        user_id: seoRow.owner_id, project_id: project.id,
        title: `Новый проект: ${project.name}`,
        body: `Ты назначен SEO-специалистом. Старт: ${format(start, "dd.MM.yyyy")}.`,
      });
      if (mgrRow?.owner_id) notifs.push({
        user_id: mgrRow.owner_id, project_id: project.id,
        title: `Новый клиент: ${project.name}`,
        body: `Ты назначен аккаунт-менеджером. Подпиши договор сегодня.`,
      });
      if (notifs.length) await supabase.from("notifications").insert(notifs);

      toast.success(`Проект «${project.name}» создан. Онбординг запущен.`);
      onCreated();
      reset();
      onOpenChange(false);
    } catch (e: any) {
      console.error(e);
      toast.error("Ошибка создания: " + (e.message || "неизвестно"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) reset(); }}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Новый клиент — Шаг {step}/3</DialogTitle>
        </DialogHeader>

        {/* Прогресс шагов */}
        <div className="flex gap-2 mb-2">
          {[1, 2, 3].map((s) => (
            <div key={s} className={`h-1 flex-1 rounded-full ${s <= step ? "bg-primary" : "bg-muted"}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-3">
            <div>
              <Label className="text-[12px]">Название проекта / клиента *</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="ООО Ромашка" />
            </div>
            <div>
              <Label className="text-[12px]">Сайт клиента</Label>
              <Input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} placeholder="https://example.com" />
            </div>
            <div>
              <Label className="text-[12px]">Дата старта *</Label>
              <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">SEO-специалист *</Label>
                <Select value={seoId} onValueChange={setSeoId}>
                  <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                  <SelectContent>
                    {team.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-[12px]">Аккаунт-менеджер *</Label>
                <Select value={managerId} onValueChange={setManagerId}>
                  <SelectTrigger><SelectValue placeholder="Выбрать" /></SelectTrigger>
                  <SelectContent>
                    {team.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-3">
            <Label className="text-[12px]">Тариф *</Label>
            <RadioGroup value={tariffId} onValueChange={setTariffId} className="space-y-2">
              {tariffs.map((t) => (
                <Card key={t.id} className={`p-3 cursor-pointer transition ${tariffId === t.id ? "border-primary bg-primary/5" : ""}`} onClick={() => setTariffId(t.id)}>
                  <div className="flex items-center gap-3">
                    <RadioGroupItem value={t.id} id={t.id} />
                    <div className="flex-1">
                      <div className="text-[13px] font-medium">{t.name}</div>
                      <div className="text-[11px] text-muted-foreground">{t.description}</div>
                    </div>
                  </div>
                </Card>
              ))}
            </RadioGroup>

            {selectedTariff?.is_custom && (
              <div>
                <Label className="text-[12px]">Бюджет договора, ₽ *</Label>
                <Input type="number" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="120000" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">Дата первой оплаты</Label>
                <Input type="date" value={firstPayment} onChange={(e) => setFirstPayment(e.target.value)} />
              </div>
              <div>
                <Label className="text-[12px]">Периодичность</Label>
                <Select value={recurrence} onValueChange={(v: any) => setRecurrence(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно</SelectItem>
                    <SelectItem value="quarterly">Квартально</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="space-y-3">
            <div>
              <Label className="text-[12px]">Контактное лицо</Label>
              <Input value={contactName} onChange={(e) => setContactName(e.target.value)} placeholder="Иван Иванов" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">Телефон</Label>
                <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} placeholder="+7 ..." />
              </div>
              <div>
                <Label className="text-[12px]">Email</Label>
                <Input type="email" value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} placeholder="client@example.com" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-[12px]">Telegram</Label>
                <Input value={contactTg} onChange={(e) => setContactTg(e.target.value)} placeholder="@username" />
              </div>
              <div>
                <Label className="text-[12px]">Предпочтительный канал</Label>
                <Select value={contactPref} onValueChange={setContactPref}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="phone">Телефон</SelectItem>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="telegram">Telegram</SelectItem>
                    <SelectItem value="whatsapp">WhatsApp</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        <DialogFooter className="flex justify-between sm:justify-between">
          <Button variant="ghost" onClick={() => step > 1 ? setStep(step - 1) : onOpenChange(false)} disabled={submitting}>
            {step > 1 ? "Назад" : "Отмена"}
          </Button>
          {step < 3 ? (
            <Button onClick={() => setStep(step + 1)} disabled={(step === 1 && !canNext1) || (step === 2 && !canNext2)}>
              Далее
            </Button>
          ) : (
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Создать проект
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
