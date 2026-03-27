import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectDialog } from "@/components/AddProjectDialog";

const COLORS = [
  "hsl(230, 80%, 56%)",
  "hsl(340, 70%, 52%)",
  "hsl(160, 65%, 40%)",
  "hsl(30, 85%, 52%)",
  "hsl(270, 60%, 55%)",
  "hsl(190, 75%, 42%)",
];

const initialProjects = [
  { id: "1", name: "TechStart", url: "techstart.io", description: "", reportStatus: "Отчет за октябрь: Готов", reportReady: true },
  { id: "2", name: "GreenShop", url: "greenshop.ru", description: "", reportStatus: "Отчет за октябрь: Готов", reportReady: true },
  { id: "3", name: "MediaFlow", url: "mediaflow.com", description: "", reportStatus: "Отчет за сентябрь: В работе", reportReady: false },
  { id: "4", name: "FinTrack", url: "fintrack.app", description: "", reportStatus: "Отчет за октябрь: Готов", reportReady: true },
  { id: "5", name: "EduPlatform", url: "eduplatform.org", description: "", reportStatus: "Нет отчетов", reportReady: false },
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const Index = () => {
  const [projects, setProjects] = useState(initialProjects);
  const navigate = useNavigate();

  const handleAdd = (p: { name: string; url: string; description: string }) => {
    setProjects((prev) => [
      ...prev,
      {
        id: String(Date.now()),
        name: p.name,
        url: p.url,
        description: p.description,
        reportStatus: "Нет отчетов",
        reportReady: false,
      },
    ]);
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center border-b border-border/60 px-4 bg-card">
            <SidebarTrigger className="mr-4" />
            <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
          </header>
          <main className="flex-1 p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">Мои проекты</h1>
                <p className="text-sm text-muted-foreground mt-1">{projects.length} проектов</p>
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
                  reportStatus={project.reportStatus}
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
