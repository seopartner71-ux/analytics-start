import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Target, TrendingUp, TrendingDown, ChevronRight, Loader2 } from "lucide-react";
import { LineChart, Line, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";

interface GoalsPerformanceProps {
  projectId: string;
  dateFrom: string;
  dateTo: string;
  onShowAllGoals?: () => void;
}

interface GoalStat {
  id: number;
  name: string;
  type: string;
  reaches: number;
  conversionRate: number;
  change: number;
  daily: number[];
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (!data.length) return null;
  const chartData = data.map((v, i) => ({ v, i }));
  return (
    <ResponsiveContainer width={80} height={28}>
      <LineChart data={chartData}>
        <Line type="monotone" dataKey="v" stroke={color} strokeWidth={1.5} dot={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ChangeIndicator({ value }: { value: number }) {
  if (value === 0) return <span className="text-xs text-muted-foreground">—</span>;
  const positive = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${positive ? "text-emerald-500" : "text-red-500"}`}>
      {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {positive ? "+" : ""}{value}%
    </span>
  );
}

export function GoalsPerformance({ projectId, dateFrom, dateTo, onShowAllGoals }: GoalsPerformanceProps) {
  const { t } = useTranslation();
  const [showAll, setShowAll] = useState(false);

  const { data: integration } = useQuery({
    queryKey: ["integration-metrika", projectId],
    queryFn: async () => {
      const { data } = await supabase
        .from("integrations")
        .select("*")
        .eq("project_id", projectId)
        .eq("service_name", "yandexMetrika")
        .eq("connected", true)
        .maybeSingle();
      return data;
    },
    enabled: !!projectId,
  });

  const { data: goals = [], isLoading } = useQuery({
    queryKey: ["metrika-goals", projectId, dateFrom, dateTo],
    queryFn: async () => {
      if (!integration?.access_token || !integration?.counter_id) return [];

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return [];

      const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const resp = await fetch(
        `https://${projectRef}.supabase.co/functions/v1/yandex-metrika-auth?action=fetch-goals`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            access_token: integration.access_token,
            counter_id: integration.counter_id,
            date1: dateFrom,
            date2: dateTo,
          }),
        }
      );
      const data = await resp.json();
      return (data.goals || []) as GoalStat[];
    },
    enabled: !!integration?.access_token && !!integration?.counter_id,
    staleTime: 30 * 60 * 1000, // Cache 30 min
  });

  const top5 = useMemo(() => goals.slice(0, 5), [goals]);

  const GoalRow = ({ goal, idx }: { goal: GoalStat; idx: number }) => (
    <TableRow key={goal.id}>
      <TableCell className="font-medium text-sm max-w-[200px] truncate">{goal.name}</TableCell>
      <TableCell className="text-sm tabular-nums">{goal.reaches.toLocaleString()}</TableCell>
      <TableCell className="text-sm tabular-nums">{goal.conversionRate}%</TableCell>
      <TableCell><ChangeIndicator value={goal.change} /></TableCell>
      <TableCell>
        <Sparkline
          data={goal.daily}
          color={goal.change >= 0 ? "hsl(var(--chart-1))" : "hsl(var(--destructive))"}
        />
      </TableCell>
    </TableRow>
  );

  return (
    <>
      <Card className="border-border bg-card">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Target className="h-4 w-4" />
              {t("goals.title", "Эффективность целей")}
            </CardTitle>
            {goals.length > 0 && (
              <Button variant="ghost" size="sm" className="h-7 text-xs gap-1"
                onClick={() => onShowAllGoals ? onShowAllGoals() : setShowAll(true)}>
                {t("goals.showAll", "Показать все цели")}
                <ChevronRight className="h-3 w-3" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : goals.length === 0 ? (
            <div className="text-center py-8">
              <Target className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
              <p className="text-sm text-muted-foreground">
                {t("goals.empty", "В Яндекс.Метрике не настроены цели. Добавьте их для отслеживания конверсий.")}
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{t("goals.goalName", "Название цели")}</TableHead>
                  <TableHead className="text-xs">{t("goals.reaches", "Достижения")}</TableHead>
                  <TableHead className="text-xs">{t("goals.conversion", "Конверсия (%)")}</TableHead>
                  <TableHead className="text-xs">{t("goals.change", "Изменение")}</TableHead>
                  <TableHead className="text-xs">{t("goals.trend", "Тренд")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {top5.map((g, i) => <GoalRow key={g.id} goal={g} idx={i} />)}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Full goals modal */}
      <Dialog open={showAll} onOpenChange={setShowAll}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              {t("goals.allGoals", "Все цели")}
            </DialogTitle>
          </DialogHeader>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-xs">{t("goals.goalName", "Название цели")}</TableHead>
                <TableHead className="text-xs">{t("goals.reaches", "Достижения")}</TableHead>
                <TableHead className="text-xs">{t("goals.conversion", "Конверсия (%)")}</TableHead>
                <TableHead className="text-xs">{t("goals.change", "Изменение")}</TableHead>
                <TableHead className="text-xs">{t("goals.trend", "Тренд")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {goals.map((g, i) => <GoalRow key={g.id} goal={g} idx={i} />)}
            </TableBody>
          </Table>
        </DialogContent>
      </Dialog>
    </>
  );
}
