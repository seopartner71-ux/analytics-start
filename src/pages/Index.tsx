import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectWizard } from "@/components/AddProjectWizard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useProjectsStats } from "@/hooks/useProjectsStats";

const COLORS = [
  "hsl(239, 84%, 67%)", "hsl(160, 84%, 39%)", "hsl(38, 92%, 50%)",
  "hsl(280, 65%, 60%)", "hsl(190, 80%, 42%)", "hsl(340, 70%, 52%)",
];

function getInitials(name: string) {
  return name.slice(0, 2).toUpperCase();
}

const Index = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: statsMap = {} } = useProjectsStats(projects);

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Обзор проектов</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Всего проектов: {projects.length}
          </p>
        </div>
        <AddProjectWizard onCreated={(id) => navigate(`/project/${id}`)} />
      </div>
      {isLoading ? (
        <div className="flex justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">Нет проектов. Создайте первый!</div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {projects.map((project, i) => {
            const stats = statsMap[project.id];
            return (
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
                stats={stats}
                onClick={() => navigate(`/project/${project.id}`)}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

export default Index;
