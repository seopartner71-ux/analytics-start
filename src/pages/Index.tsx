import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectWizard } from "@/components/AddProjectWizard";
import { PageHeader } from "@/components/PageHeader";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const COLORS = [
  "hsl(239, 84%, 67%)",
  "hsl(160, 84%, 39%)",
  "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)",
  "hsl(190, 80%, 42%)",
  "hsl(340, 70%, 52%)",
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const Index = () => {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { user } = useAuth();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <PageHeader />
          <main className="flex-1 p-6 lg:p-8">
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-foreground">{t("dashboard.title")}</h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {t("dashboard.projectsCount", { count: projects.length })}
                </p>
              </div>
              <AddProjectWizard onCreated={(id) => navigate(`/project/${id}`)} />
            </div>
            {isLoading ? (
              <div className="flex justify-center py-20">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
              </div>
            ) : projects.length === 0 ? (
              <div className="text-center py-20 text-muted-foreground">{t("dashboard.noProjects")}</div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {projects.map((project, i) => (
                  <ProjectCard
                    key={project.id}
                    name={project.name}
                    url={project.url || ""}
                    initials={getInitials(project.name)}
                    color={COLORS[i % COLORS.length]}
                    logoUrl={project.logo_url}
                    description={project.description}
                    seoSpecialist={project.seo_specialist}
                    accountManager={project.account_manager}
                    reportStatus=""
                    reportReady={false}
                    onClick={() => navigate(`/project/${project.id}`)}
                  />
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

export default Index;
