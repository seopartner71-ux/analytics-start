import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart3, Globe, Search, Target,
  CheckCircle2, Unplug, KeyRound, RefreshCw, Lock, ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { useAuth } from "@/contexts/AuthContext";
import { MetrikaOAuthDialog } from "./MetrikaOAuthDialog";

/** Перевод RLS / Postgres ошибок в понятный человеку текст */
function humanizePermissionError(err: Error): string {
  const msg = (err?.message || "").toLowerCase();
  if (
    msg.includes("row-level security") ||
    msg.includes("row level security") ||
    msg.includes("permission denied") ||
    msg.includes("violates row-level") ||
    msg.includes("not authorized")
  ) {
    return "Недостаточно прав. Изменять интеграции может только администратор, руководитель проекта или владелец проекта. Обратитесь к ним за помощью.";
  }
  return err?.message || "Произошла ошибка";
}

interface IntegrationMeta {
  key: string;
  icon: React.ReactNode;
  descriptionKey: string;
  authType: "oauth" | "apikey";
}

const integrationsMeta: IntegrationMeta[] = [
  { key: "yandexMetrika", icon: <BarChart3 className="h-6 w-6" />, descriptionKey: "integrations.desc.yandexMetrika", authType: "oauth" },
  { key: "yandexWebmaster", icon: <Globe className="h-6 w-6" />, descriptionKey: "integrations.desc.yandexWebmaster", authType: "oauth" },
  { key: "googleSearchConsole", icon: <Search className="h-6 w-6" />, descriptionKey: "integrations.desc.gsc", authType: "oauth" },
  { key: "topvisor", icon: <Target className="h-6 w-6" />, descriptionKey: "integrations.desc.topvisor", authType: "apikey" },
];

interface IntegrationsTabProps {
  projectId: string;
  integrations: Tables<"integrations">[];
}

export function IntegrationsTab({ projectId, integrations }: IntegrationsTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [oauthDialog, setOauthDialog] = useState<string | null>(null);
  const [metrikaDialog, setMetrikaDialog] = useState(false);
  const [topvisorDialog, setTopvisorDialog] = useState(false);
  const [tvApiKey, setTvApiKey] = useState("");
  const [tvUserId, setTvUserId] = useState("");
  const [tvProjectId, setTvProjectId] = useState("");

  // Yandex Webmaster dialog state
  const [wmDialog, setWmDialog] = useState(false);
  const [wmSiteUrl, setWmSiteUrl] = useState("");
  const [wmToken, setWmToken] = useState("");

  // Google Search Console dialog state
  const [gscDialog, setGscDialog] = useState(false);
  const [gscPropertyUrl, setGscPropertyUrl] = useState("");
  const [gscToken, setGscToken] = useState("");

  const { user, isAdmin, isManager } = useAuth();

  // Get project owner to determine if current user can manage integrations
  const { data: projectMeta } = useQuery({
    queryKey: ["project-owner-for-integrations", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("owner_id, seo_specialist_id, account_manager_id")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isOwner = !!user && projectMeta?.owner_id === user.id;
  // Manager assigned as SEO specialist or account manager on this project
  const { data: isProjectLead } = useQuery({
    queryKey: ["is-project-lead", projectId, user?.id],
    enabled: !!user && !!projectMeta && (isManager || false),
    queryFn: async () => {
      if (!user || !projectMeta) return false;
      const ids = [projectMeta.seo_specialist_id, projectMeta.account_manager_id].filter(Boolean) as string[];
      if (!ids.length) return false;
      const { data } = await supabase
        .from("team_members")
        .select("id")
        .in("id", ids)
        .eq("owner_id", user.id);
      return (data?.length ?? 0) > 0;
    },
  });

  const canManageIntegrations = isAdmin || isOwner || (isManager && !!isProjectLead);

  const getIntegration = (key: string) => integrations.find((i) => i.service_name === key);

  const connectMutation = useMutation({
    mutationFn: async ({ serviceName, apiKey, externalProjectId, counterId, accessToken }: {
      serviceName: string; apiKey?: string; externalProjectId?: string; counterId?: string; accessToken?: string;
    }) => {
      if (!canManageIntegrations) {
        throw new Error("Недостаточно прав для управления интеграциями");
      }
      // Validate that real credentials were provided — never write mock tokens
      if (!accessToken && !apiKey) {
        throw new Error("Не передан токен или API-ключ для подключения интеграции");
      }
      const existing = getIntegration(serviceName);
      if (existing) {
        const { error } = await supabase.from("integrations").update({
          connected: true,
          last_sync: new Date().toISOString(),
          access_token: accessToken ?? existing.access_token ?? null,
          api_key: apiKey ?? existing.api_key ?? null,
          external_project_id: externalProjectId ?? existing.external_project_id ?? null,
          counter_id: counterId ?? existing.counter_id ?? null,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          project_id: projectId,
          service_name: serviceName,
          connected: true,
          last_sync: new Date().toISOString(),
          access_token: accessToken ?? null,
          api_key: apiKey ?? null,
          external_project_id: externalProjectId ?? null,
          counter_id: counterId ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      toast.success(t("integrations.connected"));
    },
    onError: (err: Error) => toast.error(humanizePermissionError(err)),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
      if (!canManageIntegrations) {
        throw new Error("Недостаточно прав для отключения интеграции");
      }
      const { error } = await supabase.from("integrations").update({
        connected: false,
        access_token: null,
        api_key: null,
        external_project_id: null,
      }).eq("id", integrationId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      toast.success(t("integrations.disconnected"));
    },
    onError: (err: Error) => toast.error(humanizePermissionError(err)),
  });

  const [syncingId, setSyncingId] = useState<string | null>(null);

  const syncMutation = useMutation({
    mutationFn: async (integration: Tables<"integrations">) => {
      setSyncingId(integration.id);
      if (integration.service_name === "yandexMetrika" && integration.access_token && integration.counter_id) {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
        const resp = await fetch(
          `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=fetch-stats`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              access_token: integration.access_token,
              counter_id: integration.counter_id,
            }),
          }
        );
        const data = await resp.json();
        if (data.error) throw new Error(data.error);

        const totals = data.totals?.data?.[0]?.metrics || [0, 0, 0, 0, 0];
        const timeSeries = data.timeSeries;
        
        const visitsByDay: { day: string; visits: number }[] = [];
        if (timeSeries?.time_intervals && timeSeries?.data?.[0]?.metrics?.[0]) {
          const intervals = timeSeries.time_intervals;
          const visitsArr = timeSeries.data[0].metrics[0];
          for (let i = 0; i < intervals.length; i++) {
            const dateStr = intervals[i]?.[0]?.split("T")?.[0] || "";
            const day = dateStr.split("-")[2]?.replace(/^0/, "") || String(i + 1);
            visitsByDay.push({ day, visits: Math.round(visitsArr[i] || 0) });
          }
        }

        const trafficSources: { source: string; visits: number }[] = [];
        if (data.trafficSources?.data) {
          for (const row of data.trafficSources.data) {
            const sourceName = row.dimensions?.[0]?.name || row.dimensions?.[0]?.id || "unknown";
            const visits = Math.round(row.metrics?.[0] || 0);
            trafficSources.push({ source: sourceName, visits });
          }
        }

        const now = new Date();
        const dateFrom = new Date(now.getTime() - 30 * 86400000).toISOString().split("T")[0];
        const dateTo = now.toISOString().split("T")[0];

        await supabase.from("metrika_stats").delete().eq("project_id", integration.project_id);

        const { error: insertError } = await supabase.from("metrika_stats").insert({
          project_id: integration.project_id,
          counter_id: integration.counter_id!,
          date_from: dateFrom,
          date_to: dateTo,
          visits_by_day: visitsByDay,
          total_visits: Math.round(totals[0] || 0),
          total_users: Math.round(totals[1] || 0),
          bounce_rate: Number((totals[2] || 0).toFixed(2)),
          page_depth: Number((totals[3] || 0).toFixed(2)),
          avg_duration_seconds: Math.round(totals[4] || 0),
          fetched_at: now.toISOString(),
          traffic_sources: trafficSources,
        } as any);
        if (insertError) throw insertError;

        await supabase.from("integrations").update({
          last_sync: now.toISOString(),
        }).eq("id", integration.id);

        return data;
      }
      await supabase.from("integrations").update({
        last_sync: new Date().toISOString(),
      }).eq("id", integration.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      queryClient.invalidateQueries({ queryKey: ["metrika-stats", projectId] });
      toast.success(t("integrations.synced"));
      setSyncingId(null);
    },
    onError: (err: Error) => {
      toast.error(humanizePermissionError(err));
      setSyncingId(null);
    },
  });

  const handleConnect = (meta: IntegrationMeta) => {
    if (meta.key === "yandexMetrika") {
      setMetrikaDialog(true);
    } else if (meta.key === "yandexWebmaster") {
      // Pre-fill from existing integration
      const existing = getIntegration("yandexWebmaster");
      setWmSiteUrl(existing?.counter_id || "");
      setWmToken(existing?.access_token || "");
      setWmDialog(true);
    } else if (meta.key === "googleSearchConsole") {
      const existing = getIntegration("googleSearchConsole");
      setGscPropertyUrl(existing?.counter_id || "");
      setGscToken(existing?.access_token || "");
      setGscDialog(true);
    } else {
      const existing = getIntegration("topvisor");
      setTvApiKey(existing?.api_key || "");
      setTvUserId(existing?.counter_id || "");
      setTvProjectId(existing?.external_project_id || "");
      setTopvisorDialog(true);
    }
  };

  const handleWmConnect = () => {
    if (!wmToken.trim()) {
      toast.error("Введите OAuth токен Яндекса");
      return;
    }
    // Save host_id to project if site URL provided
    if (wmSiteUrl.trim()) {
      supabase.from("projects").update({
        yandex_webmaster_host_id: wmSiteUrl.trim(),
      }).eq("id", projectId).then(() => {
        queryClient.invalidateQueries({ queryKey: ["project-detail", projectId] });
      });
    }
    connectMutation.mutate({
      serviceName: "yandexWebmaster",
      accessToken: wmToken.trim(),
      counterId: wmSiteUrl.trim() || undefined,
    });
    setWmDialog(false);
    setWmSiteUrl("");
    setWmToken("");
  };

  const handleGscConnect = () => {
    if (!gscPropertyUrl.trim() || !gscToken.trim()) {
      toast.error("Заполните все поля");
      return;
    }
    connectMutation.mutate({
      serviceName: "googleSearchConsole",
      accessToken: gscToken.trim(),
      counterId: gscPropertyUrl.trim(), // store property URL in counter_id
    });
    setGscDialog(false);
    setGscPropertyUrl("");
    setGscToken("");
  };

  const handleTopvisorConnect = () => {
    const normalizedUserId = tvUserId.trim();
    if (!tvApiKey.trim() || !tvProjectId.trim() || !normalizedUserId) {
      toast.error(t("integrations.fillFields"));
      return;
    }
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailPattern.test(normalizedUserId)) {
      toast.error("Для Topvisor в поле User ID нужно указать email аккаунта");
      return;
    }
    connectMutation.mutate({
      serviceName: "topvisor",
      apiKey: tvApiKey.trim(),
      externalProjectId: tvProjectId.trim(),
      counterId: normalizedUserId,
    });
    setTopvisorDialog(false);
    setTvApiKey("");
    setTvUserId("");
    setTvProjectId("");
  };

  const lockedHint = "Только администратор, владелец проекта или назначенный руководитель проекта может управлять интеграциями. Вы можете просматривать данные, но не менять подключения.";

  return (
    <TooltipProvider>
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-lg font-semibold text-foreground">{t("integrations.title")}</h2>
          {!canManageIntegrations && (
            <Badge variant="outline" className="gap-1.5 border-amber-500/40 text-amber-600">
              <Lock className="h-3 w-3" />
              Только просмотр
            </Badge>
          )}
        </div>

        {!canManageIntegrations && (
          <Alert className="border-amber-500/40 bg-amber-500/5">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <AlertTitle className="text-amber-700 dark:text-amber-400">Недостаточно прав на изменение интеграций</AlertTitle>
            <AlertDescription className="text-muted-foreground">
              Вам доступен просмотр всей аналитики и подключённых сервисов проекта.
              Подключать, отключать и синхронизировать интеграции может администратор,
              владелец проекта или назначенный руководитель проекта (SEO-специалист или аккаунт-менеджер).
            </AlertDescription>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          {integrationsMeta.map((meta) => {
            const integration = getIntegration(meta.key);
            const connected = integration?.connected ?? false;

            const wrapDisabled = (node: React.ReactNode) =>
              !canManageIntegrations ? (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span className="inline-flex">{node}</span>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs">
                    {lockedHint}
                  </TooltipContent>
                </Tooltip>
              ) : (
                node
              );

            return (
              <Card key={meta.key} className="border-border/60">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                      {meta.icon}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <h3 className="font-semibold text-foreground">{t(`integrations.names.${meta.key}`)}</h3>
                        {connected && (
                          <Badge className="bg-[hsl(var(--success))] text-[hsl(var(--success-foreground))]">
                            <CheckCircle2 className="h-3 w-3 mr-1" />
                            {t("integrations.active")}
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">{t(meta.descriptionKey)}</p>

                      {connected && integration?.last_sync && (
                        <p className="text-xs text-muted-foreground mb-3">
                          {t("integrations.lastSync")}: {new Date(integration.last_sync).toLocaleDateString()}
                        </p>
                      )}

                      {connected ? (
                        <div className="flex items-center gap-2 flex-wrap">
                          {wrapDisabled(
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => syncMutation.mutate(integration!)}
                              disabled={syncingId === integration!.id || !canManageIntegrations}
                            >
                              <RefreshCw className={`h-3.5 w-3.5 ${syncingId === integration!.id ? "animate-spin" : ""}`} />
                              {t("integrations.sync")}
                            </Button>
                          )}
                          {wrapDisabled(
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5"
                              onClick={() => handleConnect(meta)}
                              disabled={!canManageIntegrations}
                            >
                              {canManageIntegrations ? <KeyRound className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                              Настроить
                            </Button>
                          )}
                          {wrapDisabled(
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1.5 text-destructive hover:text-destructive"
                              onClick={() => disconnectMutation.mutate(integration!.id)}
                              disabled={!canManageIntegrations}
                            >
                              <Unplug className="h-3.5 w-3.5" />
                              {t("integrations.disconnect")}
                            </Button>
                          )}
                        </div>
                      ) : (
                        wrapDisabled(
                          <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={() => handleConnect(meta)}
                            disabled={!canManageIntegrations}
                          >
                            {canManageIntegrations ? <KeyRound className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                            {t("integrations.connect")}
                          </Button>
                        )
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

      {/* Yandex Webmaster Dialog */}
      <Dialog open={wmDialog} onOpenChange={setWmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Подключение Яндекс Вебмастера</DialogTitle>
            <DialogDescription>
              Введите URL сайта и OAuth-токен Яндекса для доступа к данным Вебмастера.
              Токен можно получить на{" "}
              <a href="https://oauth.yandex.ru/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                oauth.yandex.ru
              </a>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>URL сайта</Label>
              <Input
                value={wmSiteUrl}
                onChange={(e) => setWmSiteUrl(e.target.value)}
                placeholder="https://example.com:443"
              />
              <p className="text-[11px] text-muted-foreground">
                Формат: https://example.com:443 (как в Яндекс Вебмастере)
              </p>
            </div>
            <div className="space-y-2">
              <Label>OAuth токен *</Label>
              <Input
                type="password"
                value={wmToken}
                onChange={(e) => setWmToken(e.target.value)}
                placeholder="y0_AgAAAAD..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWmDialog(false)}>Отмена</Button>
            <Button onClick={handleWmConnect} disabled={connectMutation.isPending}>
              <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Подключить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Google Search Console Dialog */}
      <Dialog open={gscDialog} onOpenChange={setGscDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Подключение Google Search Console</DialogTitle>
            <DialogDescription>
              Введите URL ресурса GSC и OAuth2 access token для доступа к данным.
              Токен можно получить через{" "}
              <a href="https://developers.google.com/oauthplayground/" target="_blank" rel="noopener noreferrer" className="text-primary underline">
                Google OAuth Playground
              </a>
              {" "}с scope webmasters.readonly.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Property URL *</Label>
              <Input
                value={gscPropertyUrl}
                onChange={(e) => setGscPropertyUrl(e.target.value)}
                placeholder="https://example.com/ или sc-domain:example.com"
              />
              <p className="text-[11px] text-muted-foreground">
                URL ресурса из Google Search Console
              </p>
            </div>
            <div className="space-y-2">
              <Label>Access Token *</Label>
              <Input
                type="password"
                value={gscToken}
                onChange={(e) => setGscToken(e.target.value)}
                placeholder="ya29.a0AfH..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGscDialog(false)}>Отмена</Button>
            <Button onClick={handleGscConnect} disabled={connectMutation.isPending}>
              <KeyRound className="h-3.5 w-3.5 mr-1.5" /> Подключить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Metrika OAuth Dialog */}
      <MetrikaOAuthDialog
        open={metrikaDialog}
        onOpenChange={setMetrikaDialog}
        projectId={projectId}
        existingIntegrationId={getIntegration("yandexMetrika")?.id}
      />

      {/* Topvisor Dialog */}
      <Dialog open={topvisorDialog} onOpenChange={setTopvisorDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("integrations.topvisorTitle")}</DialogTitle>
            <DialogDescription>{t("integrations.topvisorDesc")}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>API Key *</Label>
              <Input value={tvApiKey} onChange={(e) => setTvApiKey(e.target.value)} placeholder="tv_xxxxxxxxxxxxxxxx" />
              <p className="text-[11px] text-muted-foreground">Settings → API → API key</p>
            </div>
            <div className="space-y-2">
              <Label>User ID (email) *</Label>
              <Input value={tvUserId} onChange={(e) => setTvUserId(e.target.value)} placeholder="user@example.com" />
              <p className="text-[11px] text-muted-foreground">Email вашего аккаунта Topvisor</p>
            </div>
            <div className="space-y-2">
              <Label>Project ID *</Label>
              <Input value={tvProjectId} onChange={(e) => setTvProjectId(e.target.value)} placeholder="26206407" />
              <p className="text-[11px] text-muted-foreground">ID проекта в Topvisor (виден в URL)</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTopvisorDialog(false)}>{t("common.cancel")}</Button>
            <Button onClick={handleTopvisorConnect}>{t("integrations.connect")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
