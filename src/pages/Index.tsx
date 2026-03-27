import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { Button } from "@/components/ui/button";
import { Globe } from "lucide-react";

const COLORS = [
  "hsl(230, 80%, 56%)",
  "hsl(340, 70%, 52%)",
  "hsl(160, 65%, 40%)",
  "hsl(30, 85%, 52%)",
  "hsl(270, 60%, 55%)",
  "hsl(190, 75%, 42%)",
];

const initialProjects = [
  { id: "1", name: "TechStart", url: "techstart.io", description: "", reportStatusKey: "oct_ready", reportReady: true },
  { id: "2", name: "GreenShop", url: "greenshop.ru", description: "", reportStatusKey: "oct_ready", reportReady: true },
  { id: "3", name: "MediaFlow", url: "mediaflow.com", description: "", reportStatusKey: "sep_progress", reportReady: false },
  { id: "4", name: "FinTrack", url: "fintrack.app", description: "", reportStatusKey: "oct_ready", reportReady: true },
  { id: "5", name: "EduPlatform", url: "eduplatform.org", description: "", reportStatusKey: "none", reportReady: false },
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

function getReportLabel(key: string, t: (k: string) => string) {
  switch (key) {
    case "oct_ready": return `${t("reports.ready")} — Oct`;
    case "sep_progress": return `${t("reports.inProgress")} — Sep`;
    default: return t("reports.none");
  }
}

const Index = () => {
  const [projects, setProjects] = useState(initialProjects);
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
        reportStatusKey: "none",
        reportReady: false,
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
              {projects.map((project, i) => (
                <ProjectCard
                  key={project.id}
                  name={project.name}
                  url={project.url}
                  initials={getInitials(project.name)}
                  color={COLORS[i % COLORS.length]}
                  reportStatus={getReportLabel(project.reportStatusKey, t)}
                  reportReady={project.reportReady}
                  onClick={() => navigate(`/project/${project.id}`)}
                />
              ))}
            </div>
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
