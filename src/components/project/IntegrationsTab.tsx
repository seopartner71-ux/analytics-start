import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  BarChart3, Globe, Search, Target,
  CheckCircle2, Unplug, KeyRound,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Tables } from "@/integrations/supabase/types";
import { MetrikaOAuthDialog } from "./MetrikaOAuthDialog";

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
  const [tvProjectId, setTvProjectId] = useState("");

  const getIntegration = (key: string) => integrations.find((i) => i.service_name === key);

  const connectMutation = useMutation({
    mutationFn: async ({ serviceName, apiKey, externalProjectId }: { serviceName: string; apiKey?: string; externalProjectId?: string }) => {
      const existing = getIntegration(serviceName);
      if (existing) {
        const { error } = await supabase.from("integrations").update({
          connected: true,
          last_sync: new Date().toISOString(),
          access_token: "mock_token_" + Date.now(),
          api_key: apiKey || null,
          external_project_id: externalProjectId || null,
        }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          project_id: projectId,
          service_name: serviceName,
          connected: true,
          last_sync: new Date().toISOString(),
          access_token: "mock_token_" + Date.now(),
          api_key: apiKey || null,
          external_project_id: externalProjectId || null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      toast.success(t("integrations.connected"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const disconnectMutation = useMutation({
    mutationFn: async (integrationId: string) => {
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
  });

  const handleConnect = (meta: IntegrationMeta) => {
    if (meta.key === "yandexMetrika") {
      setMetrikaDialog(true);
    } else if (meta.authType === "oauth") {
      setOauthDialog(meta.key);
    } else {
      setTopvisorDialog(true);
    }
  };

  const handleOAuthConfirm = () => {
    if (!oauthDialog) return;
    connectMutation.mutate({ serviceName: oauthDialog });
    setOauthDialog(null);
  };

  const handleTopvisorConnect = () => {
    if (!tvApiKey.trim() || !tvProjectId.trim()) {
      toast.error(t("integrations.fillFields"));
      return;
    }
    connectMutation.mutate({ serviceName: "topvisor", apiKey: tvApiKey.trim(), externalProjectId: tvProjectId.trim() });
    setTopvisorDialog(false);
    setTvApiKey("");
    setTvProjectId("");
  };

  const oauthMeta = integrationsMeta.find((m) => m.key === oauthDialog);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-foreground">{t("integrations.title")}</h2>

      <div className="grid gap-4 sm:grid-cols-2">
        {integrationsMeta.map((meta) => {
          const integration = getIntegration(meta.key);
          const connected = integration?.connected ?? false;

          return (
            <Card key={meta.key} className="border-border/60">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-xl bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                    {meta.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
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
                      <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => disconnectMutation.mutate(integration!.id)}>
                        <Unplug className="h-3.5 w-3.5" />
                        {t("integrations.disconnect")}
                      </Button>
                    ) : (
                      <Button size="sm" className="gap-1.5" onClick={() => handleConnect(meta)}>
                        <KeyRound className="h-3.5 w-3.5" />
                        {t("integrations.connect")}
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* OAuth Dialog */}
      <Dialog open={!!oauthDialog} onOpenChange={(open) => !open && setOauthDialog(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{t("integrations.oauthTitle", { service: oauthMeta ? t(`integrations.names.${oauthMeta.key}`) : "" })}</DialogTitle>
            <DialogDescription>{t("integrations.oauthDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center justify-center py-8">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-muted flex items-center justify-center">
                {oauthMeta?.icon}
              </div>
              <p className="text-sm text-muted-foreground">{t("integrations.oauthPlaceholder")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOauthDialog(null)}>{t("common.cancel")}</Button>
            <Button onClick={handleOAuthConfirm}>{t("integrations.authorize")}</Button>
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
            </div>
            <div className="space-y-2">
              <Label>Project ID *</Label>
              <Input value={tvProjectId} onChange={(e) => setTvProjectId(e.target.value)} placeholder="123456" />
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
