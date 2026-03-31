import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Link2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface GSCWidgetProps {
  projectId?: string;
}

export function GSCWidget({ projectId }: GSCWidgetProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  // Check if GSC integration is connected
  const { data: integration } = useQuery({
    queryKey: ["integration-gsc", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations").select("*")
        .eq("project_id", projectId!).eq("service_name", "googleSearchConsole").eq("connected", true).maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  // No integration — show empty state
  if (!integration) {
    return (
      <Card className="border-border/60">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
              <span className="text-xs font-bold text-primary">G</span>
            </div>
            {t("widgets.gsc.title")}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Search className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {isRu
                ? "Подключите Google Search Console на вкладке «Интеграции» для отображения поисковых запросов."
                : "Connect Google Search Console on the Integrations tab to see search queries."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  // TODO: When GSC API integration is implemented, fetch real data here
  // For now show placeholder that integration is connected but no data fetched yet
  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">G</span>
          </div>
          {t("widgets.gsc.title")}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <Link2 className="h-8 w-8 text-emerald-500/50 mb-3" />
          <p className="text-sm text-muted-foreground max-w-xs">
            {isRu
              ? "GSC подключён. Данные появятся после настройки OAuth и синхронизации."
              : "GSC connected. Data will appear after OAuth setup and sync."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
