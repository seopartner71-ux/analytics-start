import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { ProjectCard } from "@/components/ProjectCard";
import { AddProjectDialog } from "@/components/AddProjectDialog";
import { Button } from "@/components/ui/button";
import { Globe, LogOut, Sun, Moon } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { toast } from "sonner";

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

const Index = () => {
  const navigate = useNavigate();
  const { t, i18n } = useTranslation();
  const { user, signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const addProject = useMutation({
    mutationFn: async (p: { name: string; url: string; description: string }) => {
      const { error } = await supabase.from("projects").insert({
        name: p.name,
        url: p.url,
        description: p.description,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("addProjectDialog.success"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

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
            <div className="flex items-center justify-between mb-8">
              <div>
                <h1 className="text-2xl font-bold tracking-tight text-foreground">{t("dashboard.title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">
                  {t("dashboard.projectsCount", { count: projects.length })}
                </p>
              </div>
              <AddProjectDialog onAdd={(p) => addProject.mutate(p)} />
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
