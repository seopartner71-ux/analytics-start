import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Plus, Rocket, Lock } from "lucide-react";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";

type OnbRow = {
  id: string;
  project_id: string;
  tariff_code: string;
  contract_budget: number;
  status: string;
  progress: number;
  start_date: string;
  projects?: { id: string; name: string; logo_url: string | null } | null;
  tariffs?: { name: string } | null;
};

const STATUS_LABEL: Record<string, { label: string; color: string }> = {
  new: { label: "🔴 Новый", color: "bg-red-500/10 text-red-500" },
  in_progress: { label: "🟡 В работе", color: "bg-amber-500/10 text-amber-500" },
  completed: { label: "🟢 Готов", color: "bg-emerald-500/10 text-emerald-500" },
  archived: { label: "⚪ Архив", color: "bg-muted text-muted-foreground" },
};

export default function OnboardingPage() {
  const { isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const [rows, setRows] = useState<OnbRow[]>([]);
  const [fetching, setFetching] = useState(true);
  const [wizardOpen, setWizardOpen] = useState(false);

  const load = async () => {
    setFetching(true);
    const { data } = await supabase
      .from("onboarding_projects")
      .select("id,project_id,tariff_code,contract_budget,status,progress,start_date,projects(id,name,logo_url),tariffs(name)")
      .order("created_at", { ascending: false });
    setRows((data || []) as any);
    setFetching(false);
  };

  useEffect(() => {
    if (isAdmin) load();
  }, [isAdmin]);

  if (loading) return null;

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <Lock className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-xl font-semibold mb-2">Доступ ограничен</h2>
        <p className="text-sm text-muted-foreground">Раздел доступен только администраторам.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5 p-4">
      <div className="flex justify-end">
        <Button size="sm" onClick={() => setWizardOpen(true)} className="gap-1.5 h-8">
          <Plus className="h-4 w-4" /> Новый клиент
        </Button>
      </div>

      <Card>
        <CardContent className="p-0">
          {fetching ? (
            <div className="p-8 text-center text-sm text-muted-foreground">Загрузка…</div>
          ) : rows.length === 0 ? (
            <div className="p-12 text-center">
              <Rocket className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground mb-4">Пока нет онбордингов</p>
              <Button size="sm" onClick={() => setWizardOpen(true)} className="gap-1.5">
                <Plus className="h-4 w-4" /> Создать первый
              </Button>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Клиент</TableHead>
                  <TableHead>Тариф</TableHead>
                  <TableHead>Бюджет</TableHead>
                  <TableHead className="w-[200px]">Прогресс</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((r) => {
                  const st = STATUS_LABEL[r.status] || STATUS_LABEL.new;
                  return (
                    <TableRow key={r.id} className="cursor-pointer" onClick={() => navigate(`/crm-projects/${r.project_id}`)}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          {r.projects?.logo_url ? (
                            <img src={r.projects.logo_url} className="h-7 w-7 rounded object-cover" alt="" />
                          ) : (
                            <div className="h-7 w-7 rounded bg-primary/15 text-[11px] flex items-center justify-center font-bold text-primary">
                              {(r.projects?.name || "?").slice(0, 2).toUpperCase()}
                            </div>
                          )}
                          <span>{r.projects?.name || "—"}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-[13px]">{r.tariffs?.name || r.tariff_code}</TableCell>
                      <TableCell className="text-[13px] tabular-nums">{Number(r.contract_budget).toLocaleString("ru-RU")} ₽</TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Progress value={r.progress} className="h-2 flex-1" />
                          <span className="text-[11px] text-muted-foreground tabular-nums w-10 text-right">{r.progress}%</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={`text-[11px] ${st.color} border-0`}>{st.label}</Badge>
                      </TableCell>
                      <TableCell></TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
      </div>

      <OnboardingWizard open={wizardOpen} onOpenChange={setWizardOpen} onCreated={load} />
    </div>
  );
}
