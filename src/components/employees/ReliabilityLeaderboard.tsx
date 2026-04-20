import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  Shield,
  AlertTriangle,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  ChevronDown,
  Loader2,
  Award,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import type { Tables } from "@/integrations/supabase/types";

type Trend = "up" | "down" | "stable";

interface EmployeeStats {
  id: string;
  name: string;
  role: string;
  totalTasks: number;
  onTimeRate: number; // %
  overdueCount: number;
  reliabilityScore: number; // 0..100
  trend: Trend;
  penalties: { title: string; days: number; points: number }[];
}

const ROLE_LABELS: Record<string, string> = {
  seo: "SEO-специалист",
  manager: "Менеджер",
  content: "Копирайтер",
  linkbuilder: "Линкбилдер",
  analyst: "Аналитик",
  director: "Директор",
};

function getInitials(name: string) {
  return name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
}

function ScoreBadge({ score }: { score: number }) {
  if (score >= 90) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-500/15 border border-emerald-500/30">
        <Trophy className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-sm font-bold text-emerald-300 tabular-nums">{score}</span>
      </div>
    );
  }
  if (score >= 70) {
    return (
      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-500/15 border border-amber-500/30">
        <Shield className="h-3.5 w-3.5 text-amber-400" />
        <span className="text-sm font-bold text-amber-300 tabular-nums">{score}</span>
      </div>
    );
  }
  return (
    <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-500/15 border border-rose-500/30">
      <AlertTriangle className="h-3.5 w-3.5 text-rose-400" />
      <span className="text-sm font-bold text-rose-300 tabular-nums">{score}</span>
    </div>
  );
}

function TrendIndicator({ trend }: { trend: Trend }) {
  if (trend === "up")
    return <ArrowUpRight className="h-4 w-4 text-emerald-400" aria-label="Тренд вверх" />;
  if (trend === "down")
    return <ArrowDownRight className="h-4 w-4 text-rose-400" aria-label="Тренд вниз" />;
  return <Minus className="h-4 w-4 text-muted-foreground" aria-label="Без изменений" />;
}

function computeStats(
  members: Tables<"team_members">[],
  tasks: Tables<"crm_tasks">[],
): EmployeeStats[] {
  const now = Date.now();
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const prevMonthStart = new Date(monthStart);
  prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

  return members.map((m) => {
    const myTasks = tasks.filter(
      (t) => t.assignee_id === m.id && new Date(t.created_at).getTime() >= monthStart.getTime(),
    );
    const prevTasks = tasks.filter(
      (t) =>
        t.assignee_id === m.id &&
        new Date(t.created_at).getTime() >= prevMonthStart.getTime() &&
        new Date(t.created_at).getTime() < monthStart.getTime(),
    );

    const isDone = (s: string) => /выполн|готов|закры|done|complet/i.test(s);

    let overduePoints = 0;
    const penalties: EmployeeStats["penalties"] = [];

    let onTime = 0;
    let overdue = 0;

    for (const t of myTasks) {
      const dl = t.deadline ? new Date(t.deadline).getTime() : null;
      if (!dl) continue;
      const done = isDone(t.stage);
      // Reference time = now for open tasks, updated_at for closed
      const ref = done ? new Date(t.updated_at).getTime() : now;
      if (ref > dl) {
        overdue += 1;
        const days = Math.max(1, Math.ceil((ref - dl) / 86400000));
        const pts = days * 5;
        overduePoints += pts;
        penalties.push({ title: t.title, days, points: pts });
      } else {
        onTime += 1;
      }
    }

    const evaluated = onTime + overdue;
    const onTimeRate = evaluated > 0 ? Math.round((onTime / evaluated) * 100) : 100;
    const reliabilityScore = Math.max(0, Math.min(100, 100 - overduePoints));

    // Trend: compare current vs previous month overdue ratio
    const prevOverdue = prevTasks.filter((t) => {
      const dl = t.deadline ? new Date(t.deadline).getTime() : null;
      if (!dl) return false;
      const done = isDone(t.stage);
      const ref = done ? new Date(t.updated_at).getTime() : monthStart.getTime();
      return ref > dl;
    }).length;

    let trend: Trend = "stable";
    if (overdue < prevOverdue) trend = "up";
    else if (overdue > prevOverdue) trend = "down";

    penalties.sort((a, b) => b.points - a.points);

    return {
      id: m.id,
      name: m.full_name,
      role: ROLE_LABELS[m.role] || m.role,
      totalTasks: myTasks.length,
      onTimeRate,
      overdueCount: overdue,
      reliabilityScore,
      trend,
      penalties: penalties.slice(0, 2),
    };
  });
}

export default function ReliabilityLeaderboard() {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: members = [], isLoading: loadingMembers } = useQuery({
    queryKey: ["team-members-reliability"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("*")
        .order("full_name");
      if (error) throw error;
      return data as Tables<"team_members">[];
    },
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["crm-tasks-reliability"],
    queryFn: async () => {
      // Limit to last 90 days to keep payload small
      const since = new Date();
      since.setDate(since.getDate() - 90);
      const { data, error } = await supabase
        .from("crm_tasks")
        .select("id, title, stage, deadline, assignee_id, created_at, updated_at")
        .gte("created_at", since.toISOString());
      if (error) throw error;
      return data as Tables<"crm_tasks">[];
    },
  });

  const stats = useMemo(() => {
    if (!members.length) return [];
    return computeStats(members, tasks)
      .filter((s) => s.totalTasks > 0)
      .sort((a, b) => b.reliabilityScore - a.reliabilityScore);
  }, [members, tasks]);

  const isLoading = loadingMembers || loadingTasks;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="rounded-xl border border-border/60 bg-gradient-to-br from-primary/[0.06] via-card to-card p-5">
        <div className="flex items-start gap-4">
          <div className="h-11 w-11 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
            <Award className="h-6 w-6 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-xl font-bold text-foreground tracking-tight">
              Рейтинг надежности команды
            </h2>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              Аналитика соблюдения дедлайнов. Базовый индекс:{" "}
              <span className="text-foreground font-medium">100 баллов</span>. Штраф за просрочку:{" "}
              <span className="text-rose-400 font-medium">−5 баллов/день</span>.
            </p>
          </div>
          {!isLoading && stats.length > 0 && (
            <div className="hidden md:flex items-center gap-4 shrink-0">
              <Stat label="Средний балл" value={Math.round(stats.reduce((a, s) => a + s.reliabilityScore, 0) / stats.length)} accent="primary" />
              <Stat label="В топе (≥90)" value={stats.filter((s) => s.reliabilityScore >= 90).length} accent="emerald" />
              <Stat label="В зоне риска" value={stats.filter((s) => s.reliabilityScore < 70).length} accent="rose" />
            </div>
          )}
        </div>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : stats.length === 0 ? (
        <div className="text-center py-20 rounded-xl border border-border/60 bg-card">
          <Trophy className="h-12 w-12 mx-auto mb-3 text-muted-foreground/30" />
          <p className="text-muted-foreground">Пока нет задач для расчёта надёжности</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border/60 bg-card shadow-sm overflow-hidden">
          {/* Table head */}
          <div className="hidden md:grid grid-cols-[2fr_1fr_1.4fr_1fr_1.2fr_40px] gap-4 px-5 py-3 border-b border-border/60 bg-muted/30 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <div>Сотрудник</div>
            <div className="text-center">Всего задач</div>
            <div>Сдано в срок</div>
            <div className="text-center">Просрочено</div>
            <div>Индекс надежности</div>
            <div></div>
          </div>

          <div className="divide-y divide-border/40">
            {stats.map((s, i) => {
              const expanded = expandedId === s.id;
              return (
                <div key={s.id}>
                  <motion.button
                    type="button"
                    onClick={() => setExpandedId(expanded ? null : s.id)}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03, duration: 0.2 }}
                    className={cn(
                      "w-full grid grid-cols-1 md:grid-cols-[2fr_1fr_1.4fr_1fr_1.2fr_40px] gap-4 px-5 py-4 text-left",
                      "hover:bg-muted/20 transition-colors items-center",
                      expanded && "bg-muted/20",
                    )}
                  >
                    {/* Сотрудник */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative shrink-0">
                        <div className="h-10 w-10 rounded-full bg-primary/15 flex items-center justify-center text-xs font-bold text-primary">
                          {getInitials(s.name)}
                        </div>
                        {i < 3 && (
                          <div
                            className={cn(
                              "absolute -top-1 -right-1 h-4 w-4 rounded-full flex items-center justify-center text-[9px] font-bold border-2 border-card",
                              i === 0 && "bg-amber-500 text-amber-950",
                              i === 1 && "bg-slate-400 text-slate-900",
                              i === 2 && "bg-orange-700 text-orange-50",
                            )}
                          >
                            {i + 1}
                          </div>
                        )}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{s.role}</p>
                      </div>
                    </div>

                    {/* Всего задач */}
                    <div className="md:text-center">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Задач:</span>
                      <span className="text-sm font-semibold text-foreground tabular-nums">{s.totalTasks}</span>
                    </div>

                    {/* Сдано в срок */}
                    <div className="space-y-1.5 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="md:hidden text-xs text-muted-foreground">В срок:</span>
                        <span
                          className={cn(
                            "text-xs font-semibold tabular-nums",
                            s.onTimeRate >= 90
                              ? "text-emerald-400"
                              : s.onTimeRate >= 70
                                ? "text-amber-400"
                                : "text-rose-400",
                          )}
                        >
                          {s.onTimeRate}%
                        </span>
                      </div>
                      <Progress
                        value={s.onTimeRate}
                        className={cn(
                          "h-1.5",
                          s.onTimeRate >= 90 && "[&>div]:bg-emerald-500",
                          s.onTimeRate >= 70 && s.onTimeRate < 90 && "[&>div]:bg-amber-500",
                          s.onTimeRate < 70 && "[&>div]:bg-rose-500",
                        )}
                      />
                    </div>

                    {/* Просрочено */}
                    <div className="md:text-center">
                      <span className="md:hidden text-xs text-muted-foreground mr-1">Просрочено:</span>
                      <span
                        className={cn(
                          "text-sm font-semibold tabular-nums",
                          s.overdueCount > 0 ? "text-rose-400" : "text-muted-foreground",
                        )}
                      >
                        {s.overdueCount}
                      </span>
                    </div>

                    {/* Индекс */}
                    <div className="flex items-center gap-2">
                      <ScoreBadge score={s.reliabilityScore} />
                      <TrendIndicator trend={s.trend} />
                    </div>

                    {/* Chevron */}
                    <div className="hidden md:flex justify-end">
                      <ChevronDown
                        className={cn(
                          "h-4 w-4 text-muted-foreground transition-transform",
                          expanded && "rotate-180",
                        )}
                      />
                    </div>
                  </motion.button>

                  {/* Expansion */}
                  <AnimatePresence initial={false}>
                    {expanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2, ease: "easeOut" }}
                        className="overflow-hidden"
                      >
                        <div className="px-5 py-4 bg-muted/15 border-t border-border/40">
                          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">
                            Последние штрафы
                          </p>
                          {s.penalties.length === 0 ? (
                            <div className="flex items-center gap-2 text-sm text-emerald-400">
                              <Trophy className="h-4 w-4" />
                              Без просрочек — образцовая работа
                            </div>
                          ) : (
                            <ul className="space-y-2">
                              {s.penalties.map((p, idx) => (
                                <li
                                  key={idx}
                                  className="flex items-center justify-between gap-3 px-3 py-2 rounded-md bg-rose-500/5 border border-rose-500/20"
                                >
                                  <div className="flex items-center gap-2 min-w-0">
                                    <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0" />
                                    <span className="text-sm text-foreground truncate">
                                      {p.title}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-3 shrink-0">
                                    <span className="text-xs text-muted-foreground">
                                      Просрочка {p.days} {p.days === 1 ? "день" : p.days < 5 ? "дня" : "дней"}
                                    </span>
                                    <span className="text-sm font-bold text-rose-400 tabular-nums">
                                      −{p.points}
                                    </span>
                                  </div>
                                </li>
                              ))}
                            </ul>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  accent,
}: {
  label: string;
  value: number;
  accent: "primary" | "emerald" | "rose";
}) {
  const colorMap = {
    primary: "text-primary",
    emerald: "text-emerald-400",
    rose: "text-rose-400",
  };
  return (
    <div className="text-right">
      <div className={cn("text-2xl font-bold tabular-nums leading-none", colorMap[accent])}>
        {value}
      </div>
      <div className="text-[11px] text-muted-foreground mt-1 uppercase tracking-wider">
        {label}
      </div>
    </div>
  );
}
