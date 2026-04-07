import { useState, useEffect } from "react";
import { Plus, Upload, ChevronRight, ChevronLeft, Check, Loader2, ExternalLink, CheckCircle2, AlertCircle, Users } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

interface Counter { id: string; name: string; site: string; }
interface WmHost { host_id: string; ascii_host_url: string; unicode_host_url: string; verified: boolean; }
interface TvProject { id: number; name: string; site: string; }

interface AddProjectWizardProps {
  onCreated: (projectId: string) => void;
}

const YANDEX_REDIRECT_URI = "https://oauth.yandex.ru/verification_code";

export function AddProjectWizard({ onCreated }: AddProjectWizardProps) {
  const [open, setOpen] = useState(false);
  const { t } = useTranslation();
  const { user } = useAuth();

  // Step tracking
  const [currentStep, setCurrentStep] = useState(0);

  // Step 1: General
  const [name, setName] = useState("");
  const [url, setUrl] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  // Step 2: Yandex
  const [yandexToken, setYandexToken] = useState("");
  const [yandexCodeInput, setYandexCodeInput] = useState("");
  const [yandexAuthStep, setYandexAuthStep] = useState<"idle" | "code" | "loading" | "done">("idle");
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState("");
  const [wmHosts, setWmHosts] = useState<WmHost[]>([]);
  const [selectedHost, setSelectedHost] = useState("");
  const [wmError, setWmError] = useState("");

  // Step 3: Topvisor
  const [tvUserId, setTvUserId] = useState("");
  const [tvApiKey, setTvApiKey] = useState("");
  const [tvProjects, setTvProjects] = useState<TvProject[]>([]);
  const [selectedTvProject, setSelectedTvProject] = useState("");
  const [tvLoading, setTvLoading] = useState(false);
  const [tvConnected, setTvConnected] = useState(false);
  const [tvError, setTvError] = useState("");

  // Step 4: Team (required)
  const [seoSpecialistId, setSeoSpecialistId] = useState("");
  const [accountManagerId, setAccountManagerId] = useState("");
  const [observerId, setObserverId] = useState("");

  // Saving
  const [saving, setSaving] = useState(false);

  // Load team members
  const { data: members = [] } = useQuery({
    queryKey: ["team-members-wizard"],
    queryFn: async () => {
      const { data } = await supabase.from("team_members").select("id, full_name, role").order("full_name");
      return data || [];
    },
    enabled: open,
  });

  const steps = [
    { label: t("wizard.step1", "Основная информация") },
    { label: t("wizard.step2", "Команда") },
    { label: t("wizard.step3", "Яндекс") },
    { label: t("wizard.step4", "Topvisor") },
  ];

  // Reset on close
  useEffect(() => {
    if (!open) {
      setCurrentStep(0);
      setName(""); setUrl(""); setLogoFile(null); setLogoPreview(null);
      setYandexToken(""); setYandexCodeInput(""); setYandexAuthStep("idle");
      setCounters([]); setSelectedCounter(""); setWmHosts([]); setSelectedHost(""); setWmError("");
      setTvUserId(""); setTvApiKey(""); setTvProjects([]); setSelectedTvProject("");
      setTvLoading(false); setTvConnected(false); setTvError("");
      setSeoSpecialistId(""); setAccountManagerId(""); setObserverId("");
      setSaving(false);
    }
  }, [open]);

  // --- Step 1 validation ---
  const step1Valid = name.trim().length > 0 && url.trim().length > 0;
  const step2Valid = seoSpecialistId.length > 0 && accountManagerId.length > 0 && observerId.length > 0;

  // --- Step 2: Yandex OAuth ---
  const getSession = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  };
  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;

  const handleStartOAuth = async () => {
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
        setYandexAuthStep("code");
      }
    } catch { toast.error("Ошибка OAuth"); }
  };

  const handleYandexCode = async () => {
    const code = yandexCodeInput.trim();
    if (!code) return;
    setYandexAuthStep("loading");
    try {
      const session = await getSession();
      if (!session) return;

      // Exchange code
      const tokenResp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=exchange-token`,
        { method: "POST", headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" }, body: JSON.stringify({ code }) }
      );
      const tokenData = await tokenResp.json();
      if (tokenData.error) throw new Error(tokenData.error);
      const token = tokenData.access_token;
      setYandexToken(token);

      // Fetch counters + hosts in parallel
      const [countersResp, hostsResp] = await Promise.all([
        fetch(`https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=list-counters`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: token }),
        }),
        fetch(`https://${projectRef}.supabase.co/functions/v1/yandex-webmaster`, {
          method: "POST",
          headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
          body: JSON.stringify({ action: "get-hosts", access_token: token }),
        }),
      ]);

      const countersData = await countersResp.json();
      setCounters(countersData.counters || []);

      try {
        const hostsData = await hostsResp.json();
        const hosts = hostsData.hosts || [];
        setWmHosts(hosts.map((h: any) => ({
          host_id: h.host_id,
          ascii_host_url: h.ascii_host_url || h.host_id,
          unicode_host_url: h.unicode_host_url || h.ascii_host_url || h.host_id,
          verified: h.verified || false,
        })));
        setWmError("");
      } catch {
        setWmError("Не удалось загрузить список сайтов Вебмастера");
      }

      setYandexAuthStep("done");
    } catch (err: any) {
      toast.error(err.message || "Ошибка авторизации");
      setYandexAuthStep("code");
    }
  };

  // --- Step 3: Topvisor ---
  const handleTvFetch = async () => {
    if (!tvUserId.trim() || !tvApiKey.trim()) {
      toast.error("Введите User ID и API Key");
      return;
    }
    setTvLoading(true);
    setTvError("");
    setTvConnected(false);
    try {
      const session = await getSession();
      if (!session) return;
      const resp = await fetch(`https://${projectRef}.supabase.co/functions/v1/topvisor-api`, {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ action: "get-projects", user_id: tvUserId.trim(), api_key: tvApiKey.trim() }),
      });
      const data = await resp.json();
      if (data.error) throw new Error(data.error);
      const projects = (data.result || []).map((p: any) => ({ id: p.id, name: p.name, site: p.site }));
      setTvProjects(projects);
      setTvConnected(true);
      if (projects.length === 0) setTvError("Проекты не найдены в Topvisor");
    } catch (err: any) {
      setTvError(err.message || "Ошибка подключения");
    } finally { setTvLoading(false); }
  };

  // --- Final save ---
  const handleFinish = async () => {
    if (!user) return;
    setSaving(true);
    try {
      // Upload logo if exists
      let logoUrl: string | null = null;
      if (logoFile) {
        const ext = logoFile.name.split(".").pop();
        const path = `${user.id}/${Date.now()}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from("project-logos").upload(path, logoFile);
        if (!uploadErr) {
          const { data: urlData } = supabase.storage.from("project-logos").getPublicUrl(path);
          logoUrl = urlData.publicUrl;
        }
      }

      // Create project with all integration data
      const insertData: Record<string, any> = {
        name: name.trim(),
        url: url.trim(),
        owner_id: user.id,
        logo_url: logoUrl,
      };

      if (selectedCounter) insertData.metrika_counter_id = selectedCounter;
      if (selectedHost) insertData.yandex_webmaster_host_id = selectedHost;
      if (tvUserId.trim()) insertData.topvisor_user_id = tvUserId.trim();
      if (tvApiKey.trim()) insertData.topvisor_api_key = tvApiKey.trim();
      if (selectedTvProject) insertData.topvisor_project_id = selectedTvProject;

      const { data: newProject, error } = await supabase.from("projects").insert(insertData as any).select("id").single();
      if (error) throw error;

      // Save Yandex integration if token present
      if (yandexToken && selectedCounter) {
        await supabase.from("integrations").insert({
          project_id: newProject.id,
          service_name: "yandexMetrika",
          connected: true,
          access_token: yandexToken,
          counter_id: selectedCounter,
          last_sync: new Date().toISOString(),
        });
      }

      if (yandexToken && selectedHost) {
        await supabase.from("integrations").insert({
          project_id: newProject.id,
          service_name: "yandexWebmaster",
          connected: true,
          access_token: yandexToken,
          last_sync: new Date().toISOString(),
        });
      }

      if (tvApiKey.trim() && tvUserId.trim()) {
        await supabase.from("integrations").insert({
          project_id: newProject.id,
          service_name: "topvisor",
          connected: true,
          api_key: tvApiKey.trim(),
          external_project_id: selectedTvProject || null,
          counter_id: tvUserId.trim(),
          last_sync: new Date().toISOString(),
        });
      }

      toast.success("Проект создан!");
      setOpen(false);
      onCreated(newProject.id);
    } catch (err: any) {
      toast.error(err.message || "Ошибка создания проекта");
    } finally { setSaving(false); }
  };

  const handleLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setLogoFile(file);
      setLogoPreview(URL.createObjectURL(file));
    }
  };

  const canProceed = (step: number) => {
    if (step === 0) return step1Valid;
    if (step === 1) return step2Valid; // Team is required
    if (step === 2) return true; // Yandex is optional
    if (step === 3) return true; // Topvisor is optional
    return true;
  };

  return (
    <>
      <Button className="gap-2" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" />
        {t("dashboard.addProject")}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t("wizard.title", "Новый проект")}</DialogTitle>
            <DialogDescription>{steps[currentStep].label}</DialogDescription>
          </DialogHeader>

          {/* Stepper */}
          <div className="flex items-center justify-center gap-1 py-3">
            {steps.map((s, i) => (
              <div key={i} className="flex items-center gap-1">
                <div className={cn(
                  "flex items-center justify-center h-8 w-8 rounded-full text-sm font-medium transition-colors",
                  i < currentStep ? "bg-primary text-primary-foreground" :
                  i === currentStep ? "bg-primary text-primary-foreground ring-2 ring-primary/30" :
                  "bg-muted text-muted-foreground"
                )}>
                  {i < currentStep ? <Check className="h-4 w-4" /> : i + 1}
                </div>
                <span className={cn("text-xs hidden sm:block max-w-[100px] truncate", i === currentStep ? "text-foreground font-medium" : "text-muted-foreground")}>
                  {s.label}
                </span>
                {i < steps.length - 1 && <div className={cn("w-8 h-0.5 mx-1", i < currentStep ? "bg-primary" : "bg-border")} />}
              </div>
            ))}
          </div>

          {/* Step 1: General */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("addProjectDialog.name", "Название")} *</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Мой проект" autoFocus />
              </div>
              <div className="space-y-2">
                <Label>{t("addProjectDialog.site", "URL сайта")} *</Label>
                <Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <Label>{t("addProjectDialog.logo", "Логотип")}</Label>
                <label className="flex items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 p-4 cursor-pointer hover:border-primary/40 transition-colors">
                  <input type="file" accept="image/*" className="hidden" onChange={handleLogoChange} />
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="h-16 w-16 object-contain rounded" />
                  ) : (
                    <div className="text-center">
                      <Upload className="mx-auto h-6 w-6 text-muted-foreground/50" />
                      <p className="mt-1 text-xs text-muted-foreground">{t("addProjectDialog.logoHint", "Нажмите для загрузки")}</p>
                    </div>
                  )}
                </label>
              </div>
            </div>
          )}

          {/* Step 2: Yandex */}
          {currentStep === 1 && (
            <div className="space-y-4">
              {yandexAuthStep === "idle" && (
                <div className="flex flex-col items-center gap-4 py-4">
                  <p className="text-sm text-muted-foreground text-center">
                    Авторизуйтесь через Яндекс, чтобы подключить Метрику и Вебмастер
                  </p>
                  <Button onClick={handleStartOAuth} className="gap-2">
                    <ExternalLink className="h-4 w-4" />
                    Войти через Яндекс
                  </Button>
                  <p className="text-xs text-muted-foreground">Этот шаг можно пропустить</p>
                </div>
              )}

              {yandexAuthStep === "code" && (
                <div className="space-y-4">
                  <p className="text-sm text-muted-foreground">Скопируйте код подтверждения из Яндекса и вставьте ниже:</p>
                  <div className="flex gap-2">
                    <Input value={yandexCodeInput} onChange={(e) => setYandexCodeInput(e.target.value)} placeholder="Код подтверждения" autoFocus />
                    <Button onClick={handleYandexCode} disabled={!yandexCodeInput.trim()}>Подтвердить</Button>
                  </div>
                </div>
              )}

              {yandexAuthStep === "loading" && (
                <div className="flex flex-col items-center gap-3 py-6">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">Загрузка данных...</p>
                </div>
              )}

              {yandexAuthStep === "done" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 text-sm text-[hsl(var(--success))]">
                    <CheckCircle2 className="h-4 w-4" />
                    Авторизация успешна
                  </div>

                  {/* Metrika counter select */}
                  <div className="space-y-2">
                    <Label>Счетчик Яндекс.Метрики</Label>
                    <Select value={selectedCounter} onValueChange={setSelectedCounter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Выберите счетчик" />
                      </SelectTrigger>
                      <SelectContent>
                        {counters.map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.name} ({c.site}) — ID: {c.id}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {selectedCounter && (
                      <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--success))]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Связь установлена
                      </div>
                    )}
                  </div>

                  {/* Webmaster host select */}
                  <div className="space-y-2">
                    <Label>Сайт в Яндекс.Вебмастере</Label>
                    {wmError ? (
                      <div className="flex items-center gap-2 text-sm text-destructive">
                        <AlertCircle className="h-4 w-4" /> {wmError}
                      </div>
                    ) : wmHosts.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Нет подтверждённых сайтов</p>
                    ) : (
                      <Select value={selectedHost} onValueChange={setSelectedHost}>
                        <SelectTrigger>
                          <SelectValue placeholder="Выберите сайт" />
                        </SelectTrigger>
                        <SelectContent>
                          {wmHosts.map((h) => (
                            <SelectItem key={h.host_id} value={h.host_id}>
                              {h.unicode_host_url}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                    {selectedHost && (
                      <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--success))]">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Связь установлена
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Topvisor */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Введите данные от Topvisor для подключения позиций. Этот шаг можно пропустить.
              </p>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>User ID</Label>
                  <Input value={tvUserId} onChange={(e) => setTvUserId(e.target.value)} placeholder="12345" />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input value={tvApiKey} onChange={(e) => setTvApiKey(e.target.value)} placeholder="tv_xxxx" />
                </div>
              </div>
              <Button variant="outline" onClick={handleTvFetch} disabled={tvLoading || !tvUserId.trim() || !tvApiKey.trim()} className="gap-2">
                {tvLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                Проверить подключение
              </Button>

              {tvError && (
                <div className="flex items-center gap-2 text-sm text-destructive">
                  <AlertCircle className="h-4 w-4" /> {tvError}
                </div>
              )}

              {tvConnected && tvProjects.length > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-sm text-[hsl(var(--success))]">
                    <CheckCircle2 className="h-4 w-4" /> Подключено. Найдено проектов: {tvProjects.length}
                  </div>
                  <Label>Выберите проект</Label>
                  <Select value={selectedTvProject} onValueChange={setSelectedTvProject}>
                    <SelectTrigger>
                      <SelectValue placeholder="Выберите проект Topvisor" />
                    </SelectTrigger>
                    <SelectContent>
                      {tvProjects.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name} ({p.site})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {selectedTvProject && (
                    <div className="flex items-center gap-1.5 text-xs text-[hsl(var(--success))]">
                      <CheckCircle2 className="h-3.5 w-3.5" /> Связь установлена
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between pt-2">
            <Button variant="ghost" onClick={() => currentStep === 0 ? setOpen(false) : setCurrentStep(currentStep - 1)} disabled={saving}>
              {currentStep === 0 ? t("common.cancel", "Отмена") : (
                <><ChevronLeft className="h-4 w-4 mr-1" /> Назад</>
              )}
            </Button>
            {currentStep < steps.length - 1 ? (
              <Button onClick={() => setCurrentStep(currentStep + 1)} disabled={!canProceed(currentStep)} className="gap-1">
                Далее <ChevronRight className="h-4 w-4" />
              </Button>
            ) : (
              <Button onClick={handleFinish} disabled={saving || !step1Valid} className="gap-1">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Check className="h-4 w-4 mr-1" />}
                Создать проект
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
