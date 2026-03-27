import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { metrikaVisitsData, metrikaKpis } from "@/data/projects";
import { Clock, MousePointerClick, Layers } from "lucide-react";

export function MetrikaWidget() {
  const { t } = useTranslation();

  const miniCards = [
    { label: t("widgets.metrika.bounceRate"), value: `${metrikaKpis.bounceRate}%`, icon: <MousePointerClick className="h-4 w-4" /> },
    { label: t("widgets.metrika.pageDepth"), value: metrikaKpis.pageDepth.toFixed(1), icon: <Layers className="h-4 w-4" /> },
    { label: t("widgets.metrika.avgTime"), value: metrikaKpis.avgTime, icon: <Clock className="h-4 w-4" /> },
  ];

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">Я</span>
          </div>
          {t("widgets.metrika.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={metrikaVisitsData}>
            <defs>
              <linearGradient id="metrikaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.25} />
                <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} />
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Area type="monotone" dataKey="visits" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#metrikaGrad)" />
          </AreaChart>
        </ResponsiveContainer>
        <div className="grid grid-cols-3 gap-3">
          {miniCards.map((card) => (
            <div key={card.label} className="rounded-lg bg-muted/50 p-3 text-center">
              <div className="flex items-center justify-center gap-1.5 text-muted-foreground mb-1">
                {card.icon}
                <span className="text-xs">{card.label}</span>
              </div>
              <p className="text-lg font-bold text-foreground">{card.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
