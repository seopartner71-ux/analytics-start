import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Globe, LogOut, Copy } from "lucide-react";
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
import type { Tables } from "@/integrations/supabase/types";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const queryClient = useQueryClient();

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

  const updateProject = useMutation({
    mutationFn: async (updates: { name: string; url: string }) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      toast.success(t("project.settingsTab.saved"));
    },
  });

  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");

  // Initialize edit fields when project loads
  if (project && editName === "" && editUrl === "") {
    setEditName(project.name);
    setEditUrl(project.url || "");
  }

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
            <nav className="flex items-center gap-1.5 text-sm text-muted-foreground mb-6">
              <Link to="/" className="hover:text-foreground transition-colors">
                {t("project.breadcrumbProjects")}
              </Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="text-foreground font-medium">{project.name}</span>
            </nav>

            <Tabs defaultValue="overview" className="space-y-6">
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
                <div className="max-w-md space-y-6">
                  <h2 className="text-lg font-semibold text-foreground">{t("project.settingsTab.title")}</h2>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.nameLabel")}</Label>
                      <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("project.settingsTab.urlLabel")}</Label>
                      <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} />
                    </div>
                    <Button onClick={() => updateProject.mutate({ name: editName, url: editUrl })}>
                      {t("project.settingsTab.save")}
                    </Button>
                  </div>

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
