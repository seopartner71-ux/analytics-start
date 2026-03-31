import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileSearch, Globe, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface WebmasterWidgetProps {
  projectId?: string;
}

export function WebmasterWidget({ projectId }: WebmasterWidgetProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  // Check webmaster integration
  const { data: integration, isLoading } = useQuery({
    queryKey: ["integration-webmaster", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations").select("*")
        .eq("project_id", projectId!).eq("service_name", "yandexWebmaster").eq("connected", true).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  if (isLoading) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">Я</span>
            </div>
            {t("widgets.webmaster.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[120px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  if (!integration) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">Я</span>
            </div>
            {t("widgets.webmaster.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Globe className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {isRu
                ? "Подключите Яндекс.Вебмастер на вкладке «Интеграции» для данных об индексации."
                : "Connect Yandex.Webmaster on the Integrations tab for indexing data."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // Integration connected but real API data fetch not yet implemented
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">Я</span>
          </div>
          {t("widgets.webmaster.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <FileSearch className="h-8 w-8 text-emerald-500/50 mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs">
            {isRu
              ? "Вебмастер подключён. Данные появятся после синхронизации."
              : "Webmaster connected. Data will appear after sync."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
