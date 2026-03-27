import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";
import { demoProjects, defaultIntegrations } from "@/data/projects";
import type { ProjectData } from "@/data/projects";

const COLORS = [
  "hsl(230, 80%, 56%)",
  "hsl(340, 70%, 52%)",
  "hsl(160, 65%, 40%)",
  "hsl(30, 85%, 52%)",
  "hsl(270, 60%, 55%)",
  "hsl(190, 75%, 42%)",
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getReportLabel(project: ProjectData, t: (k: string) => string): { label: string; ready: boolean } {
  const doneTasks = project.tasks.filter((task) => task.done).length;
  if (doneTasks > 0) return { label: `${t("reports.ready")} — ${doneTasks} ✓`, ready: true };
  if (project.tasks.length > 0) return { label: t("reports.inProgress"), ready: false };
  return { label: t("reports.none"), ready: false };
}

const Index = () => {
  const [projects, setProjects] = useState<ProjectData[]>(demoProjects);
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();

  const toggleLang = () => {
    i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");
  };

  const handleAdd = (p: { name: string; url: string; description: string }) => {
    setProjects((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: p.name,
        url: p.url,
        description: p.description,
        integrations: [...defaultIntegrations],
        tasks: [],
      },
    ]);
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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("dashboard.title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("dashboard.projectsCount", { count: projects.length })}
                </p>
              </div>
              <AddProjectDialog onAdd={handleAdd} />
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {projects.map((project, i) => {
                const report = getReportLabel(project, t);
                return (
                  <ProjectCard
                    key={project.id}
                    name={project.name}
                    url={project.url}
                    initials={getInitials(project.name)}
                    color={COLORS[i % COLORS.length]}
                    reportStatus={report.label}
                    reportReady={report.ready}
                    onClick={() => navigate(`/project/${project.id}`)}
                  />
                );
              })}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
