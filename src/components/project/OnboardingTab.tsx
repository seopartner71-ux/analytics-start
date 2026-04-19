import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, Globe, BarChart3, Users, CheckCircle2 } from "lucide-react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";

type ItemDef = { key: string; label: string };
type Section = { id: string; title: string; icon: React.ComponentType<{ className?: string }>; items: ItemDef[] };

const SECTIONS: Section[] = [
  {
    id: "docs",
    title: "Документы",
    icon: FileText,
    items: [
      { key: "doc_contract", label: "Договор подписан" },
      { key: "doc_invoice_paid", label: "Счёт выставлен и оплачен" },
      { key: "doc_site_access", label: "Доступы к сайту получены (FTP/хостинг/CMS)" },
      { key: "doc_yandex_webmaster", label: "Доступ к Яндекс Вебмастер получен" },
      { key: "doc_gsc", label: "Доступ к Google Search Console получен" },
      { key: "doc_metrika", label: "Доступ к Яндекс Метрике получен" },
      { key: "doc_ga", label: "Доступ к Google Analytics получен" },
    ],
  },
  {
    id: "tech",
    title: "Технические",
    icon: Globe,
    items: [
      { key: "tech_site_added", label: "Сайт добавлен в систему" },
      { key: "tech_audit_started", label: "Технический аудит запущен" },
      { key: "tech_counters_checked", label: "Счётчики аналитики проверены" },
      { key: "tech_robots", label: "Robots.txt проверен" },
      { key: "tech_sitemap", label: "Sitemap.xml проверен" },
    ],
  },
  {
    id: "analytics",
    title: "Аналитика",
    icon: BarChart3,
    items: [
      { key: "an_goals", label: "Цели в Метрике настроены" },
      { key: "an_baseline", label: "Базовые позиции зафиксированы" },
      { key: "an_semantic", label: "Семантическое ядро получено или собрано" },
      { key: "an_competitors", label: "Конкуренты определены" },
    ],
  },
  {
    id: "comm",
    title: "Коммуникация",
    icon: Users,
    items: [
      { key: "co_chat", label: "Клиент добавлен в чат проекта" },
      { key: "co_contact", label: "Контактное лицо клиента зафиксировано" },
      { key: "co_report_format", label: "Формат отчётности согласован" },
      { key: "co_calls", label: "Периодичность созвонов согласована" },
    ],
  },
];

const ALL_ITEMS = SECTIONS.flatMap((s) => s.items);

interface Row {
  id: string;
  item_key: string;
  checked: boolean;
  assignee_id: string | null;
  completed_by_name: string | null;
  completed_at: string | null;
}

interface TeamMember {
  id: string;
  full_name: string;
}

export function OnboardingTab({ projectId }: { projectId: string }) {
  const { user } = useAuth();
  const [rows, setRows] = useState<Record<string, Row>>({});
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const [{ data: rowData }, { data: teamData }] = await Promise.all([
      supabase.from("project_onboarding").select("id,item_key,checked,assignee_id,completed_by_name,completed_at").eq("project_id", projectId),
      supabase.from("team_members").select("id,full_name").order("full_name"),
    ]);
    const map: Record<string, Row> = {};
    (rowData || []).forEach((r: any) => { map[r.item_key] = r; });
    setRows(map);
    setTeam((teamData || []) as TeamMember[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, [projectId]);

  const upsert = async (item_key: string, patch: Partial<Row>) => {
    const existing = rows[item_key];
    const payload: any = { project_id: projectId, item_key, ...patch };
    if (existing) {
      const { error } = await supabase.from("project_onboarding").update(patch).eq("id", existing.id);
      if (error) { toast.error("Ошибка сохранения"); return; }
    } else {
      const { error } = await supabase.from("project_onboarding").insert(payload);
      if (error) { toast.error("Ошибка сохранения"); return; }
    }
    await load();
  };

  const toggleCheck = async (item_key: string, checked: boolean) => {
    const userName = user?.user_metadata?.full_name || user?.email || "Пользователь";
    await upsert(item_key, {
      checked,
      completed_by: checked ? user?.id ?? null : null,
      completed_by_name: checked ? userName : null,
      completed_at: checked ? new Date().toISOString() : null,
    } as any);
    if (checked) toast.success("Пункт выполнен");
  };

  const setAssignee = async (item_key: string, assignee_id: string | null) => {
    await upsert(item_key, { assignee_id } as any);
    if (assignee_id) toast.success("Задача создана и назначена");
  };

  const { done, total, percent } = useMemo(() => {
    const total = ALL_ITEMS.length;
    const done = ALL_ITEMS.filter((i) => rows[i.key]?.checked).length;
    return { done, total, percent: Math.round((done / total) * 100) };
  }, [rows]);

  return (
    <div className="space-y-5">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              Готовность проекта
            </CardTitle>
            <Badge variant="secondary" className="text-[12px]">
              {done}/{total} — {percent}%
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <Progress value={percent} className="h-2" />
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {SECTIONS.map((section) => {
          const Icon = section.icon;
          const sectionDone = section.items.filter((i) => rows[i.key]?.checked).length;
          return (
            <Card key={section.id}>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4 text-muted-foreground" />
                    {section.title}
                  </span>
                  <span className="text-[11px] text-muted-foreground font-normal">
                    {sectionDone}/{section.items.length}
                  </span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {section.items.map((item) => {
                  const row = rows[item.key];
                  const isChecked = !!row?.checked;
                  return (
                    <div
                      key={item.key}
                      className="flex items-start gap-3 p-2.5 rounded-md hover:bg-muted/40 transition-colors"
                    >
                      <Checkbox
                        checked={isChecked}
                        onCheckedChange={(v) => toggleCheck(item.key, !!v)}
                        disabled={loading}
                        className="mt-0.5"
                      />
                      <div className="flex-1 min-w-0">
                        <div className={`text-[13px] ${isChecked ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {item.label}
                        </div>
                        {isChecked && row?.completed_by_name && row?.completed_at && (
                          <div className="text-[11px] text-muted-foreground mt-0.5">
                            ✓ {row.completed_by_name} · {format(new Date(row.completed_at), "d MMM yyyy, HH:mm", { locale: ru })}
                          </div>
                        )}
                      </div>
                      <Select
                        value={row?.assignee_id || "none"}
                        onValueChange={(v) => setAssignee(item.key, v === "none" ? null : v)}
                      >
                        <SelectTrigger className="h-8 w-[160px] text-[12px]">
                          <SelectValue placeholder="Ответственный" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">— Не назначен —</SelectItem>
                          {team.map((m) => (
                            <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
