import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { gscQueries } from "@/data/projects";

export function GSCWidget() {
  const { t } = useTranslation();

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
        <div className="rounded-lg border border-border/60 overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="text-xs">{t("widgets.gsc.query")}</TableHead>
                <TableHead className="text-xs text-right">{t("widgets.gsc.clicks")}</TableHead>
                <TableHead className="text-xs text-right">{t("widgets.gsc.impressions")}</TableHead>
                <TableHead className="text-xs text-right">{t("widgets.gsc.position")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {gscQueries.map((row, i) => (
                <TableRow key={i}>
                  <TableCell className="text-sm font-medium">{row.query}</TableCell>
                  <TableCell className="text-sm text-right">{row.clicks.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right">{row.impressions.toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-right">{row.position.toFixed(1)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </CardContent>
    </Card>
  );
}
