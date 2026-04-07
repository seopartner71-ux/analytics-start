import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ExternalLink, Shield, Plus } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const LINKS = [
  { id: 1, url: "business-journal.ru/article/seo-2025", anchor: "SEO продвижение 2025", dr: 65, status: "Активна", date: "2025-03-15", project: "kat-lubricants.ru" },
  { id: 2, url: "habr.com/post/12345", anchor: "Технический аудит сайта", dr: 82, status: "Активна", date: "2025-02-20", project: "vertex-pro.ru" },
  { id: 3, url: "vc.ru/marketing/seo-tips", anchor: "Оптимизация скорости", dr: 78, status: "На модерации", date: "2025-04-01", project: "tehnostroy.ru" },
  { id: 4, url: "spark.ru/startup/seo-agency", anchor: "SEO для стартапов", dr: 55, status: "Удалена", date: "2025-01-10", project: "autologistic.ru" },
];

function DrBadge({ dr }: { dr: number }) {
  const color = dr >= 70 ? "hsl(var(--success))" : dr >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  return (
    <div className="flex items-center gap-1.5">
      <Shield className="h-3.5 w-3.5" style={{ color }} />
      <span className="text-sm font-semibold" style={{ color }}>{dr}</span>
    </div>
  );
}

export default function LinksPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Ссылки</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление ссылочной массой</p>
        </div>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>

      <div className="overflow-x-auto rounded-xl border border-border/60 bg-card shadow-sm">
        <table className="crm-table min-w-[600px]">
          <thead>
            <tr>
              <th>Донор</th>
              <th>Анкор</th>
              <th>DR</th>
              <th>Статус</th>
              <th>Проект</th>
              <th>Дата</th>
            </tr>
          </thead>
          <tbody>
            <AnimatePresence>
              {LINKS.map((l, i) => (
                <motion.tr
                  key={l.id}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.03, duration: 0.2 }}
                >
                  <td>
                    <div className="flex items-center gap-1.5">
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-sm text-primary hover:underline cursor-pointer">{l.url}</span>
                    </div>
                  </td>
                  <td className="text-sm text-foreground font-medium">{l.anchor}</td>
                  <td><DrBadge dr={l.dr} /></td>
                  <td>
                    <Badge
                      variant={l.status === "Активна" ? "default" : l.status === "Удалена" ? "destructive" : "secondary"}
                      className="text-[10px] font-medium"
                    >
                      {l.status}
                    </Badge>
                  </td>
                  <td className="text-sm text-muted-foreground">{l.project}</td>
                  <td className="text-sm text-muted-foreground">
                    {new Date(l.date).toLocaleDateString("ru-RU", { day: "numeric", month: "short", year: "numeric" })}
                  </td>
                </motion.tr>
              ))}
            </AnimatePresence>
          </tbody>
        </table>
      </div>
    </div>
  );
}
