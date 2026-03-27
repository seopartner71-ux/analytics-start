import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Loader2, BarChart3, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

interface Counter {
  id: string;
  name: string;
  site: string;
}

interface MetrikaOAuthDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projectId: string;
  existingIntegrationId?: string;
}

export function MetrikaOAuthDialog({ open, onOpenChange, projectId, existingIntegrationId }: MetrikaOAuthDialogProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<"auth" | "loading" | "select">("auth");
  const [accessToken, setAccessToken] = useState("");
  const [counters, setCounters] = useState<Counter[]>([]);
  const [selectedCounter, setSelectedCounter] = useState("");

  useEffect(() => {
    if (!open) {
      setStep("auth");
      setAccessToken("");
      setCounters([]);
      setSelectedCounter("");
    }
  }, [open]);

  // Listen for OAuth callback message
  useEffect(() => {
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "yandex-oauth-callback" && event.data?.code) {
        handleCodeExchange(event.data.code);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, []);

  const handleStartOAuth = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const redirectUri = `${window.location.origin}/oauth/yandex/callback`;
      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const funcUrl = `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=auth-url&redirect_uri=${encodeURIComponent(redirectUri)}`;
      
      const authResp = await fetch(funcUrl, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      const authData = await authResp.json();

      if (authData.url) {
        // Open popup for OAuth
        const popup = window.open(authData.url, "yandex-oauth", "width=600,height=700,scrollbars=yes");
        if (!popup) {
          toast.error("Разрешите всплывающие окна для авторизации");
        }
      }
    } catch (err) {
      toast.error("Ошибка запуска OAuth");
    }
  };

  const handleCodeExchange = async (code: string) => {
    setStep("loading");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      
      // Exchange code for token
      const tokenResp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=exchange-token`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ code }),
        }
      );
      const tokenData = await tokenResp.json();
      if (tokenData.error) throw new Error(tokenData.error);

      setAccessToken(tokenData.access_token);

      // Fetch counters
      const countersResp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=list-counters`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ access_token: tokenData.access_token }),
        }
      );
      const countersData = await countersResp.json();
      if (countersData.error) throw new Error(countersData.error);

      setCounters(countersData.counters || []);
      setStep("select");
    } catch (err: any) {
      toast.error(err.message || "Ошибка авторизации");
      setStep("auth");
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!selectedCounter || !accessToken) return;
      const counter = counters.find(c => c.id === selectedCounter);

      if (existingIntegrationId) {
        const { error } = await supabase.from("integrations").update({
          connected: true,
          access_token: accessToken,
          counter_id: selectedCounter,
          last_sync: new Date().toISOString(),
        }).eq("id", existingIntegrationId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("integrations").insert({
          project_id: projectId,
          service_name: "yandexMetrika",
          connected: true,
          access_token: accessToken,
          counter_id: selectedCounter,
          last_sync: new Date().toISOString(),
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
      toast.success(t("integrations.connected"));
      onOpenChange(false);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            {t("integrations.names.yandexMetrika")}
          </DialogTitle>
          <DialogDescription>
            {step === "auth" && t("integrations.metrika.authDesc")}
            {step === "loading" && t("integrations.metrika.loading")}
            {step === "select" && t("integrations.metrika.selectCounter")}
          </DialogDescription>
        </DialogHeader>

        {step === "auth" && (
          <div className="flex flex-col items-center gap-4 py-6">
            <div className="h-16 w-16 rounded-2xl bg-muted flex items-center justify-center">
              <BarChart3 className="h-8 w-8 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground text-center">
              {t("integrations.metrika.authHint")}
            </p>
          </div>
        )}

        {step === "loading" && (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">{t("integrations.metrika.loading")}</p>
          </div>
        )}

        {step === "select" && (
          <div className="space-y-4 py-2">
            <div className="flex items-center gap-2 text-sm text-[hsl(var(--success))]">
              <CheckCircle2 className="h-4 w-4" />
              {t("integrations.metrika.authorized")}
            </div>
            <div className="space-y-2">
              <Label>{t("integrations.metrika.counterLabel")}</Label>
              <Select value={selectedCounter} onValueChange={setSelectedCounter}>
                <SelectTrigger>
                  <SelectValue placeholder={t("integrations.metrika.counterPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  {counters.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name} ({c.site}) — ID: {c.id}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.cancel")}
          </Button>
          {step === "auth" && (
            <Button onClick={handleStartOAuth}>
              {t("integrations.authorize")}
            </Button>
          )}
          {step === "select" && (
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!selectedCounter || saveMutation.isPending}
            >
              {saveMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {t("integrations.connect")}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
