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
  CheckCircle2, AlertCircle, ExternalLink, Loader2,
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
  { key: "topvisor", label: "TopVisor", icon: "T", color: "#4CAF50", fieldLabel: "Project ID", fieldKey: "external_project_id", extraField: { label: "API Key", key: "api_key" } },
  { key: "googleSearchConsole", label: "Google Search Console", icon: "G", color: "#4285F4", fieldLabel: "Property URL", fieldKey: "external_project_id" },
];

export default function EditProjectDialog({ open, onOpenChange, project, projectId }: EditProjectDialogProps) {
  const queryClient = useQueryClient();

  // Form state
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [deadline, setDeadline] = useState("");
  const [periodFrom, setPeriodFrom] = useState("");
  const [periodTo, setPeriodTo] = useState("");
  const [seoSpecialistId, setSeoSpecialistId] = useState("");
  const [accountManagerId, setAccountManagerId] = useState("");
  const [coExecutors, setCoExecutors] = useState<string[]>([]);
  const [observers, setObservers] = useState<string[]>([]);

  // Integration fields
  const [integrationValues, setIntegrationValues] = useState<Record<string, Record<string, string>>>({});

  // Yandex OAuth state
  const [yandexOAuthStep, setYandexOAuthStep] = useState<"idle" | "code" | "loading" | "done">("idle");
  const [yandexCodeInput, setYandexCodeInput] = useState("");
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
    setPeriodFrom("");
    setPeriodTo("");
    setSeoSpecialistId(project.seo_specialist_id || "");
    setAccountManagerId(project.account_manager_id || "");
    setCoExecutors([]);
    setObservers([]);
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
      if (def.extraField) {
        vals[def.key][def.extraField.key] = existing?.[def.extraField.key as keyof typeof existing] as string || "";
      }
    }
    setIntegrationValues(vals);
  }, [integrations, open]);

  // Save project
  const saveProject = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").update({
        name,
        url,
        deadline: deadline || null,
        seo_specialist_id: seoSpecialistId || null,
        account_manager_id: accountManagerId || null,
      } as any).eq("id", projectId);
      if (error) throw error;

      // Upsert integrations
      for (const def of INTEGRATION_DEFS) {
        const vals = integrationValues[def.key];
        if (!vals) continue;
        const mainVal = vals[def.fieldKey]?.trim();
        if (!mainVal) continue;

        const payload: any = {
          project_id: projectId,
          service_name: def.key,
          connected: true,
          [def.fieldKey]: mainVal,
        };
        if (def.extraField && vals[def.extraField.key]) {
          payload[def.extraField.key] = vals[def.extraField.key];
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

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> Дедлайн проекта
              </Label>
              <Input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="h-9 text-[13px] w-full sm:w-56" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-[12px] text-muted-foreground flex items-center gap-1.5">
                <CalendarDays className="h-3 w-3" /> Отчётный период
              </Label>
              <div className="flex items-center gap-2">
                <Input type="date" value={periodFrom} onChange={e => setPeriodFrom(e.target.value)} className="h-9 text-[13px] flex-1" />
                <span className="text-[12px] text-muted-foreground">—</span>
                <Input type="date" value={periodTo} onChange={e => setPeriodTo(e.target.value)} className="h-9 text-[13px] flex-1" />
              </div>
            </div>
          </TabsContent>

          {/* Integrations Tab */}
          <TabsContent value="integrations" className="px-6 py-5 space-y-4 mt-0">
            {INTEGRATION_DEFS.map(def => {
              const vals = integrationValues[def.key] || {};
              const isConnected = vals.connected === "true" && vals[def.fieldKey]?.trim();
              return (
                <div key={def.key} className="rounded-xl border border-border bg-card p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-xs font-bold text-white"
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
                      <Badge className="bg-emerald-500/10 text-emerald-500 border-0 gap-1 text-[11px]">
                        <CheckCircle2 className="h-3 w-3" /> Подключено
                      </Badge>
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
                    {def.extraField && (
                      <div className="space-y-1">
                        <Label className="text-[11px] text-muted-foreground">{def.extraField.label}</Label>
                        <Input
                          value={vals[def.extraField.key] || ""}
                          onChange={e => setIntField(def.key, def.extraField!.key, e.target.value)}
                          placeholder={`Введите ${def.extraField.label.toLowerCase()}`}
                          className="h-8 text-[12px]"
                          type="password"
                        />
                      </div>
                    )}
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
