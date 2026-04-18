import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { PageSpeedBlock } from "./PageSpeedBlock";
import { Loader2 } from "lucide-react";

export function PageSpeedTab({ projectId }: { projectId: string }) {
  const { data: project, isLoading } = useQuery({
    queryKey: ["project-pagespeed-url", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("url")
        .eq("id", projectId)
        .single();
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!project?.url) {
    return (
      <div className="text-center py-20 text-muted-foreground text-sm">
        У проекта не указан URL сайта. Добавьте URL в настройках проекта.
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageSpeedBlock siteUrl={project.url} />
    </div>
  );
}
