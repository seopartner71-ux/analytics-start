import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { FileText, PenTool, CheckCircle2, Clock } from "lucide-react";

const CONTENT_ITEMS = [
  { id: 1, title: "Статья: Как выбрать промышленную смазку", status: "Опубликовано", date: "2025-03-28", author: "Елена Петрова", words: 2400 },
  { id: 2, title: "Лендинг: LLM-оптимизация для бизнеса", status: "На согласовании", date: "2025-04-02", author: "Елена Петрова", words: 1800 },
  { id: 3, title: "Карточка товара: Масло трансмиссионное 75W-90", status: "В работе", date: "2025-04-05", author: "Лейсан Шагинова", words: 600 },
  { id: 4, title: "Блог: Тренды SEO 2025", status: "Черновик", date: "2025-04-06", author: "Елена Петрова", words: 3200 },
];

const statusIcon = (s: string) => {
  switch (s) {
    case "Опубликовано": return <CheckCircle2 className="h-4 w-4 text-success" />;
    case "В работе": return <PenTool className="h-4 w-4 text-warning" />;
    default: return <Clock className="h-4 w-4 text-muted-foreground" />;
  }
};

export default function ContentPage() {
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold text-foreground">Контент</h1>
      <p className="text-sm text-muted-foreground">Управление контентом проектов</p>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CONTENT_ITEMS.map(item => (
          <Card key={item.id} className="hover:border-primary/30 transition-colors cursor-pointer">
            <CardContent className="p-4 space-y-3">
              <div className="flex items-start justify-between">
                <FileText className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="flex items-center gap-1.5">
                  {statusIcon(item.status)}
                  <Badge variant="secondary" className="text-[10px]">{item.status}</Badge>
                </div>
              </div>
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>{item.author}</span>
                <span>{item.words} слов</span>
              </div>
              <p className="text-xs text-muted-foreground">{item.date}</p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
