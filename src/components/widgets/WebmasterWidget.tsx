import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, FileSearch } from "lucide-react";
import { webmasterErrors, webmasterPagesInSearch } from "@/data/projects";

export function WebmasterWidget() {
  const { t } = useTranslation();

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
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3 rounded-lg bg-muted/50 p-4">
          <FileSearch className="h-8 w-8 text-primary shrink-0" />
          <div>
            <p className="text-sm text-muted-foreground">{t("widgets.webmaster.pagesInSearch")}</p>
            <p className="text-2xl font-bold text-foreground">{webmasterPagesInSearch.toLocaleString()}</p>
          </div>
        </div>

        <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            {t("widgets.webmaster.criticalErrors")}
          </h4>
          <div className="space-y-2">
            {webmasterErrors.map((err) => (
              <div key={err.id} className="rounded-lg border border-destructive/20 bg-destructive/5 px-3 py-2.5">
                <p className="text-sm text-foreground">{err.message}</p>
                <p className="text-xs text-muted-foreground mt-1">{err.date}</p>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
