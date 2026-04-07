import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, TrendingUp, Shield } from "lucide-react";

const LINKS = [
  { id: 1, url: "business-journal.ru/article/seo-2025", anchor: "SEO продвижение 2025", dr: 65, status: "Активна", date: "2025-03-15", project: "kat-lubricants.ru" },
  { id: 2, url: "habr.com/post/12345", anchor: "Технический аудит сайта", dr: 82, status: "Активна", date: "2025-02-20", project: "vertex-pro.ru" },
  { id: 3, url: "vc.ru/marketing/seo-tips", anchor: "Оптимизация скорости", dr: 78, status: "На модерации", date: "2025-04-01", project: "tehnostroy.ru" },
  { id: 4, url: "spark.ru/startup/seo-agency", anchor: "SEO для стартапов", dr: 55, status: "Удалена", date: "2025-01-10", project: "autologistic.ru" },
];

export default function LinksPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Ссылки</h1>
      <p className="text-sm text-muted-foreground">Управление ссылочной массой</p>

      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full min-w-[600px]">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Донор</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Анкор</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">DR</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Статус</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Проект</th>
              <th className="text-left text-xs font-medium text-muted-foreground p-3">Дата</th>
            </tr>
          </thead>
          <tbody>
            {LINKS.map(l => (
              <tr key={l.id} className="border-b border-border/50 hover:bg-muted/20 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-1.5">
                    <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm text-primary">{l.url}</span>
                  </div>
                </td>
                <td className="p-3 text-sm text-foreground">{l.anchor}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1">
                    <Shield className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-sm font-medium text-foreground">{l.dr}</span>
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={l.status === "Активна" ? "default" : l.status === "Удалена" ? "destructive" : "secondary"} className="text-[10px]">{l.status}</Badge>
                </td>
                <td className="p-3 text-sm text-muted-foreground">{l.project}</td>
                <td className="p-3 text-sm text-muted-foreground">{l.date}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
