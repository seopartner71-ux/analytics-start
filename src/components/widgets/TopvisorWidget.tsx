import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TrendingUp } from "lucide-react";
import { topvisorPositions, topvisorGrowth } from "@/data/projects";

const COLORS = [
  "hsl(230, 80%, 56%)",
  "hsl(210, 70%, 55%)",
  "hsl(200, 60%, 50%)",
  "hsl(220, 15%, 70%)",
];

export function TopvisorWidget() {
  const { t } = useTranslation();

  const labelMap: Record<string, string> = {
    top3: t("widgets.topvisor.top3"),
    top10: t("widgets.topvisor.top10"),
    top30: t("widgets.topvisor.top30"),
    outside: t("widgets.topvisor.outside"),
  };

  const labeledData = topvisorPositions.map((d) => ({
    ...d,
    label: labelMap[d.name] || d.name,
  }));

  return (
    <Card className="border-border/60">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <div className="h-6 w-6 rounded bg-primary/10 flex items-center justify-center">
            <span className="text-xs font-bold text-primary">T</span>
          </div>
          {t("widgets.topvisor.title")}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <ResponsiveContainer width="100%" height={220}>
          <PieChart>
            <Pie
              data={labeledData}
              dataKey="value"
              nameKey="label"
              cx="50%"
              cy="50%"
              outerRadius={85}
              innerRadius={45}
              strokeWidth={2}
              stroke="hsl(var(--card))"
            >
              {labeledData.map((_, idx) => (
                <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px", fontSize: "12px" }} />
            <Legend wrapperStyle={{ fontSize: "12px" }} />
          </PieChart>
        </ResponsiveContainer>

        <div>
          <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
            <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" />
            {t("widgets.topvisor.topGrowth")}
          </h4>
          <div className="space-y-1.5">
            {topvisorGrowth.map((item, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-muted/40 px-3 py-2">
                <span className="text-sm text-foreground truncate flex-1 mr-3">{item.keyword}</span>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs text-muted-foreground">{item.from}</span>
                  <span className="text-xs text-muted-foreground">→</span>
                  <span className="text-sm font-semibold text-[hsl(var(--success))]">{item.to}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
