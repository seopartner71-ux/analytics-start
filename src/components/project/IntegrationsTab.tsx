import { useState } from "react";
import { useTranslation } from "react-i18next";
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
import type { Integration } from "@/data/projects";

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
  integrations: Integration[];
  onIntegrationsChange: (integrations: Integration[]) => void;
}

export function IntegrationsTab({ integrations, onIntegrationsChange }: IntegrationsTabProps) {
  const { t } = useTranslation();
  const [oauthDialog, setOauthDialog] = useState<string | null>(null);
  const [topvisorDialog, setTopvisorDialog] = useState(false);
  const [tvApiKey, setTvApiKey] = useState("");
  const [tvProjectId, setTvProjectId] = useState("");

  const getIntegration = (key: string) => integrations.find((i) => i.key === key);

  const handleConnect = (meta: IntegrationMeta) => {
    if (meta.authType === "oauth") {
      setOauthDialog(meta.key);
    } else {
      setTopvisorDialog(true);
    }
  };

  const handleOAuthConfirm = () => {
    if (!oauthDialog) return;
    const updated = integrations.map((i) =>
      i.key === oauthDialog ? { ...i, connected: true, lastSync: new Date().toISOString() } : i
    );
    onIntegrationsChange(updated);
    toast.success(t("integrations.connected"));
    setOauthDialog(null);
  };

  const handleTopvisorConnect = () => {
    if (!tvApiKey.trim() || !tvProjectId.trim()) {
      toast.error(t("integrations.fillFields"));
      return;
    }
    const updated = integrations.map((i) =>
      i.key === "topvisor"
        ? { ...i, connected: true, lastSync: new Date().toISOString(), apiKey: tvApiKey.trim(), projectId: tvProjectId.trim() }
        : i
    );
    onIntegrationsChange(updated);
    toast.success(t("integrations.connected"));
    setTopvisorDialog(false);
    setTvApiKey("");
    setTvProjectId("");
  };

  const handleDisconnect = (key: string) => {
    const updated = integrations.map((i) =>
      i.key === key ? { ...i, connected: false, lastSync: undefined, apiKey: undefined, projectId: undefined } : i
    );
    onIntegrationsChange(updated);
    toast.success(t("integrations.disconnected"));
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

                    {connected && integration?.lastSync && (
                      <p className="text-xs text-muted-foreground mb-3">
                        {t("integrations.lastSync")}: {new Date(integration.lastSync).toLocaleDateString()}
                      </p>
                    )}

                    {connected ? (
                      <Button variant="outline" size="sm" className="gap-1.5 text-destructive hover:text-destructive" onClick={() => handleDisconnect(meta.key)}>
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
            <Button variant="outline" onClick={() => setOauthDialog(null)}>{t("addProjectDialog.cancel")}</Button>
            <Button onClick={handleOAuthConfirm}>{t("integrations.authorize")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
            <Button variant="outline" onClick={() => setTopvisorDialog(false)}>{t("addProjectDialog.cancel")}</Button>
            <Button onClick={handleTopvisorConnect}>{t("integrations.connect")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
