import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ChevronRight, Globe } from "lucide-react";
import { toast } from "sonner";
import { OverviewTab } from "@/components/project/OverviewTab";
import { AnalyticsTab } from "@/components/project/AnalyticsTab";
import { WorkLogTab } from "@/components/project/WorkLogTab";
import { demoProjects, type ProjectData, type WorkTask } from "@/data/projects";

const ProjectDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { t, i18n } = useTranslation();

  const initial = demoProjects.find((p) => p.id === id) || demoProjects[0];
  const [project, setProject] = useState<ProjectData>({ ...initial, tasks: [...initial.tasks] });
  const [editName, setEditName] = useState(project.name);
  const [editUrl, setEditUrl] = useState(project.url);

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const handleToggleService = (key: string) => {
    setProject((prev) => ({
      ...prev,
      services: { ...prev.services, [key]: !prev.services[key as keyof typeof prev.services] },
    }));
  };

  const handleTasksChange = (tasks: WorkTask[]) => {
    setProject((prev) => ({ ...prev, tasks }));
  };

  const handleSaveSettings = () => {
    setProject((prev) => ({ ...prev, name: editName, url: editUrl }));
    toast.success(t("project.settingsTab.saved"));
  };

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
            <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5 text-xs">
              <Globe className="h-3.5 w-3.5" />
              {i18n.language === "ru" ? "EN" : "RU"}
            </Button>
          </header>

          <main className="flex-1 p-6 lg:p-8">
            {/* Breadcrumbs */}
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
                <TabsTrigger value="settings">{t("project.tabs.settings")}</TabsTrigger>
              </TabsList>

              <TabsContent value="overview">
                <OverviewTab services={project.services} onToggleService={handleToggleService} />
              </TabsContent>

              <TabsContent value="analytics">
                <AnalyticsTab projectId={project.id} />
              </TabsContent>

              <TabsContent value="worklog">
                <WorkLogTab tasks={project.tasks} onTasksChange={handleTasksChange} />
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
                    <Button onClick={handleSaveSettings}>{t("project.settingsTab.save")}</Button>
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
