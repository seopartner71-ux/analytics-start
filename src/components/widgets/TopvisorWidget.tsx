import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from "recharts";
import { TrendingUp, Target, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const COLORS = [
  "hsl(230, 80%, 56%)",
  "hsl(210, 70%, 55%)",
  "hsl(200, 60%, 50%)",
  "hsl(220, 15%, 70%)",
];

interface TopvisorWidgetProps {
  projectId?: string;
}

export function TopvisorWidget({ projectId }: TopvisorWidgetProps) {
  const { t, i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  // Load Topvisor credentials: prefer integrations table, fallback to project columns
  const { data: creds, isLoading } = useQuery({
    queryKey: ["topvisor-creds", projectId],
    queryFn: async () => {
      const [{ data: integ }, { data: proj }] = await Promise.all([
        supabase
          .from("integrations").select("api_key, external_project_id, counter_id, connected")
          .eq("project_id", projectId!).eq("service_name", "topvisor").maybeSingle(),
        supabase
          .from("projects").select("topvisor_project_id, topvisor_api_key, topvisor_user_id")
          .eq("id", projectId!).maybeSingle(),
      ]);

      const api_key = integ?.api_key || proj?.topvisor_api_key || null;
      const project_id = integ?.external_project_id || proj?.topvisor_project_id || null;
      const user_id = integ?.counter_id || proj?.topvisor_user_id || null;
      const connected = integ?.connected ?? false;
      return { api_key, project_id, user_id, connected };
    },
    enabled: !!projectId,
  });

  // Fetch real position summary from Topvisor API
  const { data: posData } = useQuery({
    queryKey: ["topvisor-summary-widget", projectId, creds?.project_id],
    queryFn: async () => {
      if (!creds?.api_key || !creds?.project_id) return null;
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return null;

      const r = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/topvisor-api`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            api_key: creds.api_key,
            user_id: creds.user_id,
            project_id: creds.project_id,
            action: "summary",
          }),
        }
      );
      if (!r.ok) return null;
      return r.json();
    },
    enabled: !!creds?.api_key && !!creds?.project_id,
    staleTime: 10 * 60_000,
  });

  const integration = creds?.connected ? creds : null;

  if (isLoading) {
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
        <CardContent>
          <div className="flex items-center justify-center h-[220px]">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const hasData = posData?.top3 !== undefined || posData?.top10 !== undefined;

  if (!integration && !hasData) {
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
        <CardContent>
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <Target className="h-8 w-8 text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground max-w-xs">
              {isRu
                ? "Подключите Topvisor на вкладке «Интеграции» для данных о позициях."
                : "Connect Topvisor on the Integrations tab for ranking data."}
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const labelMap: Record<string, string> = {
    top3: t("widgets.topvisor.top3"),
    top10: t("widgets.topvisor.top10"),
    top30: t("widgets.topvisor.top30"),
    outside: t("widgets.topvisor.outside"),
  };

  const positions = [
    { name: "top3", value: posData?.top3 || 0 },
    { name: "top10", value: posData?.top10 || 0 },
    { name: "top30", value: posData?.top30 || 0 },
    { name: "outside", value: posData?.outside || 0 },
  ];

  const labeledData = positions.map((d) => ({
    ...d,
    label: labelMap[d.name] || d.name,
  }));

  const topGrowth = posData?.topGrowth || [];

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

        {topGrowth.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-foreground mb-2 flex items-center gap-1.5">
              <TrendingUp className="h-4 w-4 text-[hsl(var(--success))]" />
              {t("widgets.topvisor.topGrowth")}
            </h4>
            <div className="space-y-1.5">
              {topGrowth.slice(0, 5).map((item: any, i: number) => (
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
        )}
      </CardContent>
    </Card>
  );
}
