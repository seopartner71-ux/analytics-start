import { useState, useEffect } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Settings2, Globe, CalendarDays, Link2, Wifi, WifiOff,
  Users, Save, X, BarChart3, Search, Eye, UserPlus,
  CheckCircle2, AlertCircle, ExternalLink, Loader2, Clock, DollarSign, Wallet, Unplug,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

interface EditProjectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  project: any;
  projectId: string;
}

const INTEGRATION_DEFS = [
  { key: "yandexMetrika", label: "Яндекс Метрика", icon: "Я", color: "hsl(var(--primary))", fieldLabel: "Counter ID", fieldKey: "counter_id" },
  { key: "yandexWebmaster", label: "Яндекс Вебмастер", icon: "Я", color: "#FF0000", fieldLabel: "Host ID", fieldKey: "external_project_id" },
  { key: "topvisor", label: "TopVisor", icon: "T", color: "#4CAF50", fieldLabel: "Project ID", fieldKey: "external_project_id", extraFields: [{ label: "API Key", key: "api_key", type: "password" as const }, { label: "User ID", key: "counter_id", type: "text" as const, placeholder: "123456 или user@example.com" }] },
  { key: "googleSearchConsole", label: "Google Search Console", icon: "G", color: "#4285F4", fieldLabel: "Property URL", fieldKey: "external_project_id" },
];

function isValidTopvisorUserId(value?: string) {
  const normalized = value?.trim() || "";
  if (!normalized) return false;
  const isNumeric = /^\d+$/.test(normalized);
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
  return isNumeric || isEmail;
}

export default function EditProjectDialog({ open, onOpenChange, project, projectId }: EditProjectDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [startDate, setStartDate] = useState("");
  const [reportPeriod, setReportPeriod] = useState<"monthly" | "weekly" | "quarterly" | "custom">("monthly");
  const [reportDay, setReportDay] = useState<number>(1);
  const [seoSpecialistId, setSeoSpecialistId] = useState("");
  const [accountManagerId, setAccountManagerId] = useState("");
  const [coExecutors, setCoExecutors] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);
  const [plannedHours, setPlannedHours] = useState("");
  const [hourlyRate, setHourlyRate] = useState("");
  const [monthlyBudget, setMonthlyBudget] = useState("");

  // Integration fields
  const [integrationValues, setIntegrationValues] = useState<Record<string, Record<string, string>>>({});

  // Yandex OAuth state
  const [yandexOAuthStep, setYandexOAuthStep] = useState<"idle" | "code" | "loading" | "done">("idle");
  const [yandexCodeInput, setYandexCodeInput] = useState("");
  const [yandexCounters, setYandexCounters] = useState<{ id: string; name: string; site: string }[]>([]);
  const [yandexHosts, setYandexHosts] = useState<{ host_id: string; unicode_host_url: string }[]>([]);
  const [selectedCounter, setSelectedCounter] = useState("");
  const [selectedHost, setSelectedHost] = useState("");
  const YANDEX_REDIRECT_URI = "https://oauth.yandex.ru/verification_code";
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  // Load team members
  const { data: members = [] } = useQuery({
    queryKey: ["team-members-edit"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name, role").order("full_name");
      return data || [];
    },
  });

  // Load integrations
  const { data: integrations = [] } = useQuery({
    queryKey: ["project-integrations-edit", projectId],
    queryFn: async () => {
      const { data } = await supabase.from("integrations").select("*").eq("project_id", projectId);
      return (data || []) as Tables<"integrations">[];
    },
    enabled: !!projectId && open,
  });

  // Init form from project
  useEffect(() => {
    if (!project || !open) return;
    setName(project.name || "");
    setUrl(project.url || "");
    setDeadline(project.deadline ? format(new Date(project.deadline), "yyyy-MM-dd") : "");
    setStartDate(project.start_date ? format(new Date(project.start_date), "yyyy-MM-dd") : "");
    setReportPeriod((project.report_period as any) || "monthly");
    setReportDay(typeof project.report_day === "number" ? project.report_day : 1);
    setSeoSpecialistId(project.seo_specialist_id || "");
    setAccountManagerId(project.account_manager_id || "");
    setCoExecutors([]);
    setObservers([]);
    setYandexOAuthStep("idle");
    setYandexCodeInput("");
    setYandexCounters([]);
    setYandexHosts([]);
    setSelectedCounter(project.metrika_counter_id || "");
    setSelectedHost(project.yandex_webmaster_host_id || "");
    setPlannedHours(project.planned_hours ? String(project.planned_hours) : "");
    setHourlyRate(project.hourly_rate ? String(project.hourly_rate) : "");
    setMonthlyBudget(project.monthly_budget ? String(project.monthly_budget) : "");
  }, [project, open]);

  // Init integration values
  useEffect(() => {
    if (!open) return;
    const vals: Record<string, Record<string, string>> = {};
    for (const def of INTEGRATION_DEFS) {
      const existing = integrations.find(i => i.service_name === def.key);
      vals[def.key] = {
        [def.fieldKey]: existing?.[def.fieldKey as keyof typeof existing] as string || "",
        connected: existing?.connected ? "true" : "false",
      };
      if ((def as any).extraFields) {
        for (const ef of (def as any).extraFields as Array<{ key: string }>) {
          vals[def.key][ef.key] = (existing?.[ef.key as keyof typeof existing] as string) || "";
        }
      }
    }
    setIntegrationValues(vals);
  }, [integrations, open]);

  // Save project
  const saveProject = useMutation({
    mutationFn: async () => {
      const projectUpdate: any = {
        name,
        url,
        deadline: deadline || null,
        start_date: startDate || null,
        report_period: reportPeriod,
        report_day: reportPeriod === "monthly" ? reportDay : 1,
        seo_specialist_id: seoSpecialistId || null,
        account_manager_id: accountManagerId || null,
        planned_hours: Number(plannedHours) || 0,
        hourly_rate: Number(hourlyRate) || 0,
        monthly_budget: Number(monthlyBudget) || 0,
      };
      // Save selected counter/host to project
      if (selectedCounter) projectUpdate.metrika_counter_id = selectedCounter;
      if (selectedHost) projectUpdate.yandex_webmaster_host_id = selectedHost;

      const { error } = await supabase.from("projects").update(projectUpdate).eq("id", projectId);
      if (error) throw error;

      // Update counter_id on metrika integration
      if (selectedCounter) {
        const metrikaInt = integrations.find(i => i.service_name === "yandexMetrika");
        if (metrikaInt) {
          await supabase.from("integrations").update({ counter_id: selectedCounter }).eq("id", metrikaInt.id);
        }
      }

      // Upsert integrations
      for (const def of INTEGRATION_DEFS) {
        const vals = integrationValues[def.key];
        if (!vals) continue;
        const mainVal = vals[def.fieldKey]?.trim();
        if (!mainVal) continue;

        if (def.key === "topvisor") {
          const topvisorEmail = vals.counter_id?.trim();
          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
          if (!topvisorEmail || !emailPattern.test(topvisorEmail)) {
            throw new Error("Для Topvisor в поле User ID нужно указать email аккаунта");
          }
        }

        const payload: any = {
          project_id: projectId,
          service_name: def.key,
          connected: true,
          [def.fieldKey]: mainVal,
        };
        if ((def as any).extraFields) {
          for (const ef of (def as any).extraFields as Array<{ key: string }>) {
            if (vals[ef.key]) payload[ef.key] = vals[ef.key];
          }
        }

        const existing = integrations.find(i => i.service_name === def.key);
        if (existing) {
          await supabase.from("integrations").update(payload).eq("id", existing.id);
        } else {
          await supabase.from("integrations").insert(payload);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-integrations-edit", projectId] });
      toast.success("Проект обновлён");
      onOpenChange(false);
    },
    onError: (e: any) => toast.error(e.message || "Ошибка сохранения"),
  });

  // Отключение интеграции: помечаем connected=false, чистим креды.
  // Для Topvisor дополнительно зануляем зеркальные поля в projects.
  const disconnectIntegration = useMutation({
    mutationFn: async (serviceKey: string) => {
      const existing = integrations.find(i => i.service_name === serviceKey);
      if (existing) {
        const { error } = await supabase.from("integrations").update({
          connected: false,
          access_token: null,
          api_key: null,
          external_project_id: null,
        }).eq("id", existing.id);
        if (error) throw error;
      }
      if (serviceKey === "topvisor") {
        await supabase.from("projects").update({
          topvisor_api_key: null,
          topvisor_user_id: null,
          topvisor_project_id: null,
        } as any).eq("id", projectId);
      }
      if (serviceKey === "yandexMetrika") {
        await supabase.from("projects").update({ metrika_counter_id: null } as any).eq("id", projectId);
      }
      if (serviceKey === "yandexWebmaster") {
        await supabase.from("projects").update({ yandex_webmaster_host_id: null } as any).eq("id", projectId);
      }
    },
    onSuccess: (_data, serviceKey) => {
      // Чистим локальный стейт полей
      setIntegrationValues(prev => ({
        ...prev,
        [serviceKey]: { connected: "false" },
      }));
      queryClient.invalidateQueries({ queryKey: ["project-integrations-edit", projectId] });
      queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      toast.success("Интеграция отключена");
    },
    onError: (e: any) => toast.error(e.message || "Не удалось отключить"),
  });

  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };

  const handleYandexStartOAuth = async () => {
    try {
      const session = await getSession();
      if (!session) return;
      const resp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=auth-url&redirect_uri=${encodeURIComponent(YANDEX_REDIRECT_URI)}`,
        { headers: { Authorization: `Bearer ${session.access_token}` } }
      );
      const data = await resp.json();
      if (data.url) {
        window.open(data.url, "_blank", "noopener,noreferrer");
        setYandexOAuthStep("code");
      }
    } catch { toast.error("Ошибка OAuth"); }
  };

  const handleYandexCode = async () => {
    const code = yandexCodeInput.trim();
    if (!code) return;
    setYandexOAuthStep("loading");
    try {
      const session = await getSession();
      if (!session) return;

      const tokenResp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=exchange-token`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ code }) }
      );
      const tokenData = await tokenResp.json();
      if (tokenData.error) throw new Error(tokenData.error);
      const accessToken = tokenData.access_token;

      // Fetch counters + hosts in parallel
      const [countersResp, hostsResp] = await Promise.all([
        fetch(`https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=list-counters`, {
          method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: accessToken }),
        }),
        fetch(`https://${projectRef}.supabase.co/functions/v1/yandex-webmaster`, {
          method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-hosts", access_token: accessToken }),
        }),
      ]);

      const countersData = await countersResp.json();
      setYandexCounters(countersData.counters || []);

      try {
        const hostsData = await hostsResp.json();
        const hosts = (hostsData.hosts || []).map((h: any) => ({
          host_id: h.host_id,
          unicode_host_url: h.unicode_host_url || h.ascii_host_url || h.host_id,
        }));
        setYandexHosts(hosts);
      } catch { setYandexHosts([]); }

      // Pre-select existing values
      const existingMetrika = integrations.find(i => i.service_name === "yandexMetrika");
      if (existingMetrika?.counter_id) setSelectedCounter(existingMetrika.counter_id);

      // Save token to both integrations
      if (existingMetrika) {
        await supabase.from("integrations").update({ access_token: accessToken, connected: true }).eq("id", existingMetrika.id);
      } else {
        await supabase.from("integrations").insert({ project_id: projectId, service_name: "yandexMetrika", access_token: accessToken, connected: true } as any);
      }

      const existingWm = integrations.find(i => i.service_name === "yandexWebmaster");
      if (existingWm) {
        await supabase.from("integrations").update({ access_token: accessToken, connected: true }).eq("id", existingWm.id);
      } else {
        await supabase.from("integrations").insert({ project_id: projectId, service_name: "yandexWebmaster", access_token: accessToken, connected: true } as any);
      }

      setIntegrationValues(prev => ({
        ...prev,
        yandexMetrika: { ...prev.yandexMetrika, connected: "true" },
        yandexWebmaster: { ...prev.yandexWebmaster, connected: "true" },
      }));

      queryClient.invalidateQueries({ queryKey: ["project-integrations-edit", projectId] });
      setYandexOAuthStep("done");
      toast.success("Яндекс авторизован! Выберите счётчик и сайт.");
    } catch (err: any) {
      toast.error(err.message || "Ошибка авторизации");
      setYandexOAuthStep("idle");
    }
  };

  const setIntField = (service: string, field: string, value: string) => {
    setIntegrationValues(prev => ({
      ...prev,
      [service]: { ...prev[service], [field]: value },
    }));
  };

  const addMulti = (list: string[], setList: (v: string[]) => void, val: string) => {
    if (val && !list.includes(val)) setList([...list, val]);
  };

  const removeMulti = (list: string[], setList: (v: string[]) => void, val: string) => {
    setList(list.filter(v => v !== val));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <Settings2 className="h-5 w-5 text-primary" />
            Редактирование проекта
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="general" className="w-full">
          <div className="px-6 pt-4">
            <TabsList className="w-full grid grid-cols-3">
              <TabsTrigger value="general" className="text-[13px] gap-1.5">
                <Settings2 className="h-3.5 w-3.5" /> Основное
              </TabsTrigger>
              <TabsTrigger value="integrations" className="text-[13px] gap-1.5">
                <Link2 className="h-3.5 w-3.5" /> Интеграции
              </TabsTrigger>
              <TabsTrigger value="team" className="text-[13px] gap-1.5">
                <Users className="h-3.5 w-3.5" /> Команда
              </TabsTrigger>
            </TabsList>
          </div>

          {/* General Tab */}
          <TabsContent value="general" className="px-6 py-5 space-y-5 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <Settings2 className="h-3 w-3" /> Название проекта
                </Label>
                <Input value={name} onChange={e => setName(e.target.value)} className="h-9 text-[13px]" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <Globe className="h-3 w-3" /> URL сайта
                </Label>
                <Input value={url} onChange={e => setUrl(e.target.value)} placeholder="https://example.com" className="h-9 text-[13px]" />
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Дата начала работ
                </Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="h-9 text-[13px]"
                />
                <p className="text-[11px] text-muted-foreground/70">
                  От этой даты считаются план-факт, недельные отчёты и онбординг
                </p>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  <CalendarDays className="h-3 w-3" /> Дедлайн проекта
                </Label>
                <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-9 text-[13px]" />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> Отчётный период
              </Label>
              <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                <Select value={reportPeriod} onValueChange={(v) => setReportPeriod(v as any)}>
                  <SelectTrigger className="h-9 text-[13px] w-full sm:w-56">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Ежемесячно (1-го числа)</SelectItem>
                    <SelectItem value="weekly">Еженедельно (по понедельникам)</SelectItem>
                    <SelectItem value="quarterly">Ежеквартально</SelectItem>
                    <SelectItem value="custom">Индивидуально</SelectItem>
                  </SelectContent>
                </Select>
                {reportPeriod === "monthly" && (
                  <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
                    <span>Формировать</span>
                    <Input
                      type="number"
                      min={1}
                      max={28}
                      value={reportDay}
                      onChange={(e) => {
                        const n = Math.max(1, Math.min(28, Number(e.target.value) || 1));
                        setReportDay(n);
                      }}
                      className="h-9 text-[13px] w-16 text-center"
                    />
                    <span>числа каждого месяца</span>
                  </div>
                )}
              </div>
            </div>

            <Separator />

            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <Wallet className="h-3 w-3" /> План-факт по проекту (за месяц)
              </Label>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Clock className="h-3 w-3" /> Часов по договору
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={plannedHours}
                    onChange={(e) => setPlannedHours(e.target.value)}
                    placeholder="40"
                    className="h-9 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <DollarSign className="h-3 w-3" /> Ставка в час, ₽
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="100"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    placeholder="2000"
                    className="h-9 text-[13px]"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <Wallet className="h-3 w-3" /> Бюджет договора, ₽
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    step="1000"
                    value={monthlyBudget}
                    onChange={(e) => setMonthlyBudget(e.target.value)}
                    placeholder="80000"
                    className="h-9 text-[13px]"
                  />
                </div>
              </div>
              <p className="text-[10px] text-muted-foreground">Используется на странице План-факт для контроля прибыльности.</p>
            </div>
          </TabsContent>
          <TabsContent value="integrations" className="px-6 py-5 space-y-4 mt-0">
            {/* Yandex OAuth Block */}
            <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-foreground bg-[hsl(var(--primary))]">Я</div>
                  <div>
                    <p className="text-[13px] font-semibold text-foreground">Авторизация Яндекс</p>
                    <p className="text-[11px] text-muted-foreground">Один токен для Метрики и Вебмастера</p>
                  </div>
                </div>
                {yandexOAuthStep === "done" ? (
                  <Badge className="bg-emerald-500/10 text-emerald-500 border-0 gap-1 text-[11px]">
                    <CheckCircle2 className="h-3 w-3" /> Авторизовано
                  </Badge>
                ) : null}
              </div>

              {yandexOAuthStep === "idle" && (
                <Button size="sm" variant="outline" className="gap-1.5 text-[12px]" onClick={handleYandexStartOAuth}>
                  <ExternalLink className="h-3.5 w-3.5" /> Войти через Яндекс
                </Button>
              )}

              {yandexOAuthStep === "code" && (
                <div className="flex gap-2">
                  <Input
                    value={yandexCodeInput}
                    onChange={e => setYandexCodeInput(e.target.value)}
                    placeholder="Вставьте код подтверждения"
                    className="h-8 text-[12px] flex-1"
                    autoFocus
                  />
                  <Button size="sm" className="h-8 text-[12px]" onClick={handleYandexCode} disabled={!yandexCodeInput.trim()}>
                    Подтвердить
                  </Button>
                </div>
              )}

              {yandexOAuthStep === "loading" && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" /> Авторизация...
                </div>
              )}

              {yandexOAuthStep === "done" && (
                <div className="space-y-3">
                  {/* Counter selector */}
                  {yandexCounters.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Счётчик Яндекс.Метрики</Label>
                      <Select value={selectedCounter} onValueChange={setSelectedCounter}>
                        <SelectTrigger className="h-8 text-[12px]">
                          <SelectValue placeholder="Выберите счётчик..." />
                        </SelectTrigger>
                        <SelectContent>
                          {yandexCounters.map(c => (
                            <SelectItem key={c.id} value={c.id}>{c.name} ({c.site}) — ID: {c.id}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedCounter && (
                        <p className="text-[11px] text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Выбран</p>
                      )}
                    </div>
                  )}

                  {/* Host selector */}
                  {yandexHosts.length > 0 && (
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">Сайт в Яндекс.Вебмастере</Label>
                      <Select value={selectedHost} onValueChange={setSelectedHost}>
                        <SelectTrigger className="h-8 text-[12px]">
                          <SelectValue placeholder="Выберите сайт..." />
                        </SelectTrigger>
                        <SelectContent>
                          {yandexHosts.map(h => (
                            <SelectItem key={h.host_id} value={h.host_id}>{h.unicode_host_url}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedHost && (
                        <p className="text-[11px] text-emerald-500 flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Выбран</p>
                      )}
                    </div>
                  )}

                  {yandexCounters.length === 0 && yandexHosts.length === 0 && (
                    <p className="text-[11px] text-muted-foreground">Данные не найдены. Проверьте настройки аккаунта Яндекс.</p>
                  )}

                  <Button size="sm" variant="ghost" className="gap-1.5 text-[11px] text-muted-foreground" onClick={() => { setYandexOAuthStep("idle"); setYandexCodeInput(""); }}>
                    Переавторизоваться
                  </Button>
                </div>
              )}
            </div>

            <Separator />

            {INTEGRATION_DEFS.map(def => {
              const vals = integrationValues[def.key] || {};
              const isConnected = vals.connected === "true" && vals[def.fieldKey]?.trim();
              return (
                <div key={def.key} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-foreground"
                        style={{ backgroundColor: def.color }}
                      >
                        {def.icon}
                      </div>
                      <div>
                        <p className="text-[13px] font-semibold text-foreground">{def.label}</p>
                        <p className="text-[11px] text-muted-foreground">{def.fieldLabel}</p>
                      </div>
                    </div>
                    {isConnected ? (
                      <div className="flex items-center gap-2">
                        <Badge className="bg-emerald-500/10 text-emerald-500 border-0 gap-1 text-[11px]">
                          <CheckCircle2 className="h-3 w-3" /> Подключено
                        </Badge>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-[11px] gap-1 text-destructive hover:text-destructive hover:bg-destructive/10"
                          disabled={disconnectIntegration.isPending}
                          onClick={() => {
                            if (confirm(`Отключить ${def.label}? Сохранённые данные останутся, отключатся только текущие учётные данные.`)) {
                              disconnectIntegration.mutate(def.key);
                            }
                          }}
                        >
                          {disconnectIntegration.isPending && disconnectIntegration.variables === def.key
                            ? <Loader2 className="h-3 w-3 animate-spin" />
                            : <Unplug className="h-3 w-3" />}
                          Отключить
                        </Button>
                      </div>
                    ) : (
                      <Badge variant="secondary" className="gap-1 text-[11px]">
                        <AlertCircle className="h-3 w-3" /> Не подключено
                      </Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-[11px] text-muted-foreground">{def.fieldLabel}</Label>
                      <Input
                        value={vals[def.fieldKey] || ""}
                        onChange={e => setIntField(def.key, def.fieldKey, e.target.value)}
                        placeholder={`Введите ${def.fieldLabel.toLowerCase()}`}
                        className="h-8 text-[12px]"
                      />
                    </div>
                    {(def as any).extraFields?.map((ef: { label: string; key: string; type?: string; placeholder?: string }) => (
                      <div key={ef.key} className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">{ef.label}</Label>
                        <Input
                          value={vals[ef.key] || ""}
                          onChange={e => setIntField(def.key, ef.key, e.target.value)}
                          placeholder={ef.placeholder || `Введите ${ef.label.toLowerCase()}`}
                          className="h-8 text-[12px]"
                          type={ef.type === "password" ? "password" : "text"}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </TabsContent>

          {/* Team Tab */}
          <TabsContent value="team" className="px-6 py-5 space-y-5 mt-0">
            {/* Single-select roles */}
            {[
              { label: "SEO-специалист", icon: <Search className="h-3 w-3" />, value: seoSpecialistId, setter: setSeoSpecialistId },
              { label: "Аккаунт-менеджер", icon: <Users className="h-3 w-3" />, value: accountManagerId, setter: setAccountManagerId },
            ].map(role => (
              <div key={role.label} className="space-y-1.5">
                <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                  {role.icon} {role.label}
                </Label>
                <Select value={role.value} onValueChange={role.setter}>
                  <SelectTrigger className="h-9 text-[13px]"><SelectValue placeholder="Выбрать..." /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none">Не назначен</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            ))}

            <Separator />

            {/* Multi-select: Co-executors */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <UserPlus className="h-3 w-3" /> Соисполнители
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {coExecutors.map(id => {
                  const m = members.find(mm => mm.id === id);
                  return m ? (
                    <Badge key={id} variant="secondary" className="text-[11px] gap-1 pr-1">
                      {m.full_name}
                      <button onClick={() => removeMulti(coExecutors, setCoExecutors, id)} className="hover:text-destructive ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <Select onValueChange={v => addMulti(coExecutors, setCoExecutors, v)}>
                <SelectTrigger className="h-8 text-[12px] w-48"><SelectValue placeholder="Добавить..." /></SelectTrigger>
                <SelectContent>
                  {members.filter(m => !coExecutors.includes(m.id)).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Multi-select: Observers */}
            <div className="space-y-2">
              <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <Eye className="h-3 w-3" /> Наблюдатели
              </Label>
              <div className="flex flex-wrap gap-1.5 min-h-[28px]">
                {observers.map(id => {
                  const m = members.find(mm => mm.id === id);
                  return m ? (
                    <Badge key={id} variant="secondary" className="text-[11px] gap-1 pr-1">
                      {m.full_name}
                      <button onClick={() => removeMulti(observers, setObservers, id)} className="hover:text-destructive ml-0.5">
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ) : null;
                })}
              </div>
              <Select onValueChange={v => addMulti(observers, setObservers, v)}>
                <SelectTrigger className="h-8 text-[12px] w-48"><SelectValue placeholder="Добавить..." /></SelectTrigger>
                <SelectContent>
                  {members.filter(m => !observers.includes(m.id)).map(m => (
                    <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-6 py-4 border-t border-border bg-muted/30">
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)} className="h-9 px-5 text-[13px] gap-1.5">
            <X className="h-3.5 w-3.5" /> Отмена
          </Button>
          <Button
            size="sm"
            onClick={() => saveProject.mutate()}
            disabled={saveProject.isPending || !name.trim()}
            className="h-9 px-5 text-[13px] gap-1.5"
          >
            <Save className="h-3.5 w-3.5" /> Сохранить
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
