import { useState, useEffect, useRef } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ChevronRight, Globe, LogOut, Copy, Pencil, Upload, X, User, Search, Sun, Moon } from "lucide-react";
import { toast } from "sonner";
import { IntegrationsTab } from "@/components/project/IntegrationsTab";
import { AnalyticsTab } from "@/components/project/AnalyticsTab";
import { WorkLogTab } from "@/components/project/WorkLogTab";
import { MetrikaWidget } from "@/components/widgets/MetrikaWidget";
import { WebmasterWidget } from "@/components/widgets/WebmasterWidget";
import { GSCWidget } from "@/components/widgets/GSCWidget";
import { TopvisorWidget } from "@/components/widgets/TopvisorWidget";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("*").eq("project_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: workLogs = [] } = useQuery({
    queryKey: ["work_logs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_logs").select("*").eq("project_id", id!).order("task_date", { ascending: false }).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeoSpecialist, setEditSeoSpecialist] = useState("");
  const [editAccountManager, setEditAccountManager] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (project && !initialized) {
      setEditName(project.name);
      setEditUrl(project.url || "");
      setEditDescription(project.description || "");
      setEditSeoSpecialist((project as any).seo_specialist || "");
      setEditAccountManager((project as any).account_manager || "");
      setEditClientEmail(project.client_email || "");
      setLogoPreview(project.logo_url || null);
      setInitialized(true);
    }
  }, [project, initialized]);

  const updateProject = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("project.settingsTab.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error(t("project.settingsTab.logoError"));
      return;
    }

    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${id}/${Date.now()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from("project-logos")
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      toast.error(uploadError.message);
      setUploading(false);
      return;
    }

    const { data: publicUrl } = supabase.storage
      .from("project-logos")
      .getPublicUrl(filePath);

    setLogoPreview(publicUrl.publicUrl);

    await supabase.from("projects").update({ logo_url: publicUrl.publicUrl }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    toast.success(t("project.settingsTab.logoUploaded"));
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    setLogoPreview(null);
    await supabase.from("projects").update({ logo_url: null }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
  };

  const handleSaveSettings = () => {
    updateProject.mutate({
      name: editName,
      url: editUrl,
      description: editDescription,
      seo_specialist: editSeoSpecialist,
      account_manager: editAccountManager,
      client_email: editClientEmail,
    });
  };

  const handleCopyShareLink = () => {
    if (project?.share_token) {
      navigator.clipboard.writeText(`${window.location.origin}/share/${project.share_token}`);
      toast.success(t("project.analytics.linkCopied"));
    }
  };

  const isConnected = (serviceName: string) =>
    integrations.some((i) => i.service_name === serviceName && i.connected);

  if (isLoading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/60 px-4 bg-card">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" />
                {i18n.language === "ru" ? "EN" : "RU"}
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                {t("auth.logout")}
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <nav className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Link to="/" className="hover:text-foreground transition-colors">
                  {t("project.breadcrumbProjects")}
                </Link>
                <ChevronRight className="h-3.5 w-3.5" />
                <div className="flex items-center gap-2">
                  {logoPreview && (
                    <img src={logoPreview} alt={project.name} className="h-6 w-6 rounded-full object-cover" />
                  )}
                  <span className="text-foreground font-medium">{project.name}</span>
                </div>
              </nav>
              <Button variant="outline" size="sm" className="gap-1.5" onClick={() => setActiveTab("settings")}>
                <Pencil className="h-3.5 w-3.5" />
                {t("project.editProject")}
              </Button>
            </div>

            <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
              <TabsList className="bg-muted/60">
                <TabsTrigger value="overview">{t("project.tabs.overview")}</TabsTrigger>
                <TabsTrigger value="analytics">{t("project.tabs.analytics")}</TabsTrigger>
                <TabsTrigger value="worklog">{t("project.tabs.worklog")}</TabsTrigger>
                <TabsTrigger value="integrations">{t("project.tabs.integrations")}</TabsTrigger>
                <TabsTrigger value="settings">{t("project.tabs.settings")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <div className="grid gap-6 lg:grid-cols-2">
                  {isConnected("yandexMetrika") && <MetrikaWidget />}
                  {isConnected("yandexWebmaster") && <WebmasterWidget />}
                  {isConnected("googleSearchConsole") && <GSCWidget />}
                  {isConnected("topvisor") && <TopvisorWidget />}
                  {integrations.length === 0 || !integrations.some((i) => i.connected) ? (
                    <div className="lg:col-span-2 text-center py-16">
                      <p className="text-muted-foreground">{t("integrations.noConnected")}</p>
                    </div>
                  ) : null}
                </div>
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsTab projectId={project.id} />
              </TabsContent>

              <TabsContent value="worklog">
                <WorkLogTab projectId={project.id} tasks={workLogs} isAdmin={true} />
              </TabsContent>

              <TabsContent value="integrations">
                <IntegrationsTab projectId={project.id} integrations={integrations} />
              </TabsContent>

              <TabsContent value="settings">
                <div className="max-w-lg space-y-8">
                  <h2 className="text-lg font-semibold text-foreground">{t("project.settingsTab.title")}</h2>

                  {/* Logo */}
                  <div className="space-y-3">
                    <Label>{t("project.settingsTab.logoLabel")}</Label>
                    <div className="flex items-center gap-4">
                      {logoPreview ? (
                        <div className="relative">
                          <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-xl object-cover border border-border" />
                          <button
                            onClick={handleRemoveLogo}
                            className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <div
                          onClick={() => fileInputRef.current?.click()}
                          className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors"
                        >
                          <Upload className="h-6 w-6 text-muted-foreground/50" />
                        </div>
                      )}
                      <div>
                        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                          {uploading ? t("common.loading") : t("project.settingsTab.uploadLogo")}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">{t("project.settingsTab.logoHint")}</p>
                      </div>
                    </div>
                    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  </div>

                  {/* Basic info */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.nameLabel")}</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.urlLabel")}</Label>
                      <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.descriptionLabel")}</Label>
                      <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
                    </div>
                  </div>

                  {/* Team */}
                  <div className="border-t border-border pt-6 space-y-4">
                    <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("project.settingsTab.teamTitle")}
                    </h3>
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.seoSpecialist")}</Label>
                      <Input
                        value={editSeoSpecialist}
                        onChange={(e) => setEditSeoSpecialist(e.target.value)}
                        placeholder={t("project.settingsTab.seoPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.accountManager")}</Label>
                      <Input
                        value={editAccountManager}
                        onChange={(e) => setEditAccountManager(e.target.value)}
                        placeholder={t("project.settingsTab.managerPlaceholder")}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.clientEmail")}</Label>
                      <Input
                        type="email"
                        value={editClientEmail}
                        onChange={(e) => setEditClientEmail(e.target.value)}
                        placeholder="client@company.com"
                      />
                    </div>
                  </div>

                  <Button onClick={handleSaveSettings} disabled={updateProject.isPending}>
                    {updateProject.isPending ? t("common.loading") : t("project.settingsTab.save")}
                  </Button>

                  {/* Share link */}
                  <div className="border-t border-border pt-6 space-y-3">
                    <h3 className="text-sm font-semibold text-foreground">{t("project.shareLink")}</h3>
                    <div className="flex gap-2">
                      <Input readOnly value={project.share_token ? `${window.location.origin}/share/${project.share_token}` : ""} className="text-xs" />
                      <Button variant="outline" size="icon" onClick={handleCopyShareLink}>
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default ProjectDetail;
