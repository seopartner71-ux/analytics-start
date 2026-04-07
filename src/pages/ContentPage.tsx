import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, PenTool, CheckCircle2, Clock, Plus } from "lucide-react";
import { motion } from "framer-motion";

const CONTENT_ITEMS = [
  { id: 1, title: "Статья: Как выбрать промышленную смазку", status: "Опубликовано", date: "2025-03-28", author: "Елена Петрова", words: 2400 },
  { id: 2, title: "Лендинг: LLM-оптимизация для бизнеса", status: "На согласовании", date: "2025-04-02", author: "Елена Петрова", words: 1800 },
  { id: 3, title: "Карточка товара: Масло трансмиссионное 75W-90", status: "В работе", date: "2025-04-05", author: "Лейсан Шагинова", words: 600 },
  { id: 4, title: "Блог: Тренды SEO 2025", status: "Черновик", date: "2025-04-06", author: "Елена Петрова", words: 3200 },
];

const statusConfig: Record<string, { icon: React.ReactNode; color: string }> = {
  "Опубликовано": { icon: <CheckCircle2 className="h-4 w-4" />, color: "hsl(var(--success))" },
  "В работе": { icon: <PenTool className="h-4 w-4" />, color: "hsl(var(--warning))" },
  "На согласовании": { icon: <Clock className="h-4 w-4" />, color: "hsl(var(--primary))" },
  "Черновик": { icon: <Clock className="h-4 w-4" />, color: "hsl(var(--muted-foreground))" },
};

export default function ContentPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight page-heading">Контент</h1>
          <p className="text-sm text-muted-foreground mt-1">Управление контентом проектов</p>
        </div>
        <Button size="sm" className="gap-1.5 shadow-sm">
          <Plus className="h-4 w-4" /> Добавить
        </Button>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_ITEMS.map((item, i) => {
          const cfg = statusConfig[item.status] || statusConfig["Черновик"];
          return (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.25 }}
            >
              <Card className="card-glow cursor-pointer border-border/60">
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                    <div className="flex items-center gap-1.5">
                      <span style={{ color: cfg.color }}>{cfg.icon}</span>
                      <Badge variant="secondary" className="text-[10px] font-medium">{item.status}</Badge>
                    </div>
                  </div>
                  <p className="text-sm font-semibold text-foreground leading-snug">{item.title}</p>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>{item.author}</span>
                    <span className="font-medium">{item.words.toLocaleString()} слов</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">{new Date(item.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}</p>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
