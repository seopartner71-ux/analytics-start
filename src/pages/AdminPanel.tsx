import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Shield, FolderOpen, Key, Users, Save, Eye, EyeOff,
  CheckCircle2, XCircle, Settings2, Rocket, Wallet, Building,
} from "lucide-react";
import { OnboardingTaskTemplateEditor } from "@/components/admin/OnboardingTaskTemplateEditor";
import { AiAssistantSettings } from "@/components/admin/AiAssistantSettings";
import { CompanyRequisitesEditor } from "@/components/admin/CompanyRequisitesEditor";
import { Checkbox } from "@/components/ui/checkbox";
import { Bot } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const INTEGRATION_KEYS = [
  { key: "openrouter_api_key", label: "OpenRouter API Key", service: "ai", secret: true },
  { key: "yandex_metrika_client_id", label: "Яндекс.Метрика Client ID", service: "yandexMetrika" },
  { key: "yandex_metrika_client_secret", label: "Яндекс.Метрика Client Secret", service: "yandexMetrika", secret: true },
  { key: "yandex_webmaster_client_id", label: "Яндекс.Вебмастер Client ID", service: "yandexWebmaster" },
  { key: "yandex_webmaster_client_secret", label: "Яндекс.Вебмастер Client Secret", service: "yandexWebmaster", secret: true },
  { key: "gsc_client_id", label: "Google Search Console Client ID", service: "googleSearchConsole" },
  { key: "gsc_client_secret", label: "Google Search Console Client Secret", service: "googleSearchConsole", secret: true },
  { key: "topvisor_api_key", label: "Topvisor API Key", service: "topvisor", secret: true },
  { key: "tochka_client_id", label: "Точка Банк Client ID", service: "tochka" },
  { key: "tochka_client_secret", label: "Точка Банк Client Secret", service: "tochka", secret: true },
];

export default function AdminPanel() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const defaultTab = searchParams.get("tab") || "projects";
  const [activeTab, setActiveTab] = useState(defaultTab);
  const [keyValues, setKeyValues] = useState<Record<string, string>>({});
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});
  const [savingKeys, setSavingKeys] = useState(false);

  // Check admin role
  const { data: isAdmin, isLoading: checkingRole } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });
      return data === true;
    },
    enabled: !!user,
  });

  // All projects
  const { data: allProjects = [] } = useQuery({
    queryKey: ["admin-projects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*, integrations(*)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // All profiles
  const { data: allProfiles = [] } = useQuery({
    queryKey: ["admin-profiles"],
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: isAdmin === true,
  });

  // App settings (integration keys)
  const { data: appSettings = [] } = useQuery({
    queryKey: ["app-settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("app_settings").select("*");
      if (error) throw error;
      // Init keyValues from settings
      const vals: Record<string, string> = {};
      data.forEach((s: any) => { vals[s.key] = s.value; });
      setKeyValues((prev) => ({ ...vals, ...prev }));
      return data;
    },
    enabled: isAdmin === true,
  });

  const handleSaveKeys = async () => {
    setSavingKeys(true);
    try {
      for (const def of INTEGRATION_KEYS) {
        const val = keyValues[def.key]?.trim();
        if (!val) continue;

        const existing = appSettings.find((s: any) => s.key === def.key);
        if (existing) {
          if ((existing as any).value !== val) {
            const { error } = await supabase.from("app_settings").update({ value: val }).eq("id", (existing as any).id);
            if (error) throw error;
          }
        } else {
          const { error } = await supabase.from("app_settings").insert({ key: def.key, value: val });
          if (error) throw error;
        }
      }
      queryClient.invalidateQueries({ queryKey: ["app-settings"] });
      toast.success(t("admin.keysSaved"));
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setSavingKeys(false);
    }
  };

  if (checkingRole) {
    return <p className="text-muted-foreground p-6">{t("common.loading")}</p>;
  }

  if (!isAdmin) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground">{t("admin.accessDenied")}</h2>
          <p className="text-sm text-muted-foreground">{t("admin.accessDeniedDesc")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Shield className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-foreground">{t("admin.title")}</h1>
                <p className="text-sm text-muted-foreground">{t("admin.subtitle")}</p>
              </div>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="projects" className="gap-1.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  {t("admin.tabs.projects")}
                </TabsTrigger>
                <TabsTrigger value="users" className="gap-1.5">
                  <Users className="h-3.5 w-3.5" />
                  {t("admin.tabs.users")}
                </TabsTrigger>
                <TabsTrigger value="keys" className="gap-1.5">
                  <Key className="h-3.5 w-3.5" />
                  {t("admin.tabs.keys")}
                </TabsTrigger>
                <TabsTrigger value="onboarding-template" className="gap-1.5">
                  <Rocket className="h-3.5 w-3.5" />
                  Шаблон онбординга
                </TabsTrigger>
                <TabsTrigger value="ai-assistant" className="gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  AI-ассистент
                </TabsTrigger>
              </TabsList>

              {/* Projects tab */}
              <TabsContent value="projects">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("admin.allProjects")} ({allProjects.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("admin.projectName")}</TableHead>
                            <TableHead>URL</TableHead>
                            <TableHead>{t("admin.owner")}</TableHead>
                            <TableHead>{t("admin.integrations")}</TableHead>
                            <TableHead>{t("admin.created")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allProjects.map((p: any) => {
                            const ownerProfile = allProfiles.find((pr: any) => pr.user_id === p.owner_id);
                            const connectedCount = (p.integrations || []).filter((i: any) => i.connected).length;
                            return (
                              <TableRow key={p.id}>
                                <TableCell className="font-medium">{p.name}</TableCell>
                                <TableCell className="text-muted-foreground text-sm">{p.url || "—"}</TableCell>
                                <TableCell className="text-sm">
                                  {ownerProfile?.full_name || ownerProfile?.email || p.owner_id.slice(0, 8)}
                                </TableCell>
                                <TableCell>
                                  {connectedCount > 0 ? (
                                    <Badge variant="secondary" className="gap-1">
                                      <CheckCircle2 className="h-3 w-3" />
                                      {connectedCount}
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="gap-1 text-muted-foreground">
                                      <XCircle className="h-3 w-3" />
                                      0
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(p.created_at).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                          {allProjects.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                                {t("admin.noProjects")}
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Users tab */}
              <TabsContent value="users">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">{t("admin.allUsers")} ({allProfiles.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{t("admin.userName")}</TableHead>
                            <TableHead>Email</TableHead>
                            <TableHead>{t("admin.agency")}</TableHead>
                            <TableHead>{t("admin.projectCount")}</TableHead>
                            <TableHead>{t("admin.registered")}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {allProfiles.map((pr: any) => {
                            const projectCount = allProjects.filter((p: any) => p.owner_id === pr.user_id).length;
                            return (
                              <TableRow key={pr.id}>
                                <TableCell className="font-medium">{pr.full_name || "—"}</TableCell>
                                <TableCell className="text-sm">{pr.email}</TableCell>
                                <TableCell className="text-sm text-muted-foreground">{pr.agency_name || "—"}</TableCell>
                                <TableCell>
                                  <Badge variant="secondary">{projectCount}</Badge>
                                </TableCell>
                                <TableCell className="text-sm text-muted-foreground">
                                  {new Date(pr.created_at).toLocaleDateString()}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Integration Keys tab */}
              <TabsContent value="keys">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Settings2 className="h-4 w-4" />
                      {t("admin.integrationKeys")}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground mb-6">{t("admin.keysDesc")}</p>
                    <div className="space-y-4">
                      {INTEGRATION_KEYS.map((def) => {
                        const currentVal = keyValues[def.key] || "";
                        const isSecret = def.secret;
                        const isVisible = showSecrets[def.key];
                        return (
                          <div key={def.key} className="space-y-1.5">
                            <Label className="text-sm">{def.label}</Label>
                            <div className="flex gap-2">
                              <Input
                                type={isSecret && !isVisible ? "password" : "text"}
                                value={currentVal}
                                onChange={(e) => setKeyValues({ ...keyValues, [def.key]: e.target.value })}
                                placeholder={`Введите ${def.label}`}
                                className="flex-1"
                              />
                              {isSecret && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => setShowSecrets({ ...showSecrets, [def.key]: !isVisible })}
                                >
                                  {isVisible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </Button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-6">
                      <Button onClick={handleSaveKeys} disabled={savingKeys} className="gap-1.5">
                        <Save className="h-4 w-4" />
                        {t("admin.saveKeys")}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="onboarding-template">
                <Card>
                  <CardContent className="pt-6">
                    <OnboardingTaskTemplateEditor />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="ai-assistant">
                <AiAssistantSettings />
              </TabsContent>
          </Tabs>
        </div>
  );
}
