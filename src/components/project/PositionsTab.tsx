import { useState, useMemo, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Search, TrendingUp, TrendingDown,
  Minus, Trophy, RefreshCw, Loader2,
  KeyRound, CheckCircle2, AlertCircle, Link as LinkIcon,
  ArrowUp, ArrowDown, Filter, ExternalLink,
} from "lucide-react";
import { GlassCard, StandardKpiCard, useTabRefresh, TabLoadingOverlay } from "./shared-ui";
import { useDateRange } from "@/contexts/DateRangeContext";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";

/* ═══════════════════════════════════════════════════════
   Types
   ═══════════════════════════════════════════════════════ */
interface PositionsTabProps {
  projectId: string;
  projectName?: string;
  projectUrl?: string | null;
  hasTopvisor?: boolean;
  topvisorApiKey?: string | null;
  topvisorUserId?: string | null;
  topvisorExternalProjectId?: string | null;
  integrationId?: string | null;
  onNavigateSettings?: () => void;
}

interface TvRegion {
  index: string;
  name: string;
  areaName?: string;
  device_name?: string;
  searcher_key: number;
  key: number;          // region key (e.g. 213 for Moscow)
  countryCode?: string; // "RU"
}

interface TvSearcher {
  key: number;
  name: string;
  regions: TvRegion[];
}

interface TvProject {
  id: number;
  name: string;
  site: string;
  searchers?: TvSearcher[];
}

interface KeywordRow {
  keyword: string;
  group?: string;
  isBrand: boolean;
  positions: Record<string, number | null>;
}

interface SearcherTab {
  key: string;
  name: string;
  regionIndexes: string[];
  regionKey: number;      // lr for Yandex
  countryCode: string;    // country for Google
  regionName: string;     // display name
}

/* ═══════════════════════════════════════════════════════
   API helper
   ═══════════════════════════════════════════════════════ */
async function callTopvisor(action: string, apiKey: string, userId: string, payload?: Record<string, unknown>) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Вы не авторизованы");

  const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID;
  const resp = await fetch(`https://${projectRef}.supabase.co/functions/v1/topvisor-api`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ action, api_key: apiKey, user_id: userId, payload }),
  });
  const data = await resp.json();
  if (!resp.ok || data.error) throw new Error(data.error || "API error");
  return data;
}

/* ═══════════════════════════════════════════════════════
   Topvisor User ID validator (numeric ID or account email)
   ═══════════════════════════════════════════════════════ */
type UidValidation =
  | { state: "empty"; message: string }
  | { state: "valid"; kind: "numeric" | "email"; message: string }
  | { state: "invalid"; message: string };

function validateTopvisorUserId(raw: string, isRu: boolean): UidValidation {
  const v = raw.trim();
  if (!v) {
    return {
      state: "empty",
      message: isRu
        ? "Введите числовой User ID (например, 123456) или email аккаунта Topvisor"
        : "Enter numeric User ID (e.g. 123456) or Topvisor account email",
    };
  }
  if (/^\d+$/.test(v)) {
    if (v.length < 3) {
      return {
        state: "invalid",
        message: isRu
          ? "Числовой User ID слишком короткий — проверьте значение в настройках профиля Topvisor"
          : "Numeric User ID is too short — check your Topvisor profile settings",
      };
    }
    return {
      state: "valid",
      kind: "numeric",
      message: isRu ? `Числовой User ID распознан (${v.length} цифр)` : `Numeric User ID detected (${v.length} digits)`,
    };
  }
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) {
    return {
      state: "valid",
      kind: "email",
      message: isRu ? "Email аккаунта распознан" : "Account email detected",
    };
  }
  // Common mistakes
  if (v.includes(" ")) {
    return { state: "invalid", message: isRu ? "Уберите пробелы" : "Remove spaces" };
  }
  if (v.includes("@") && !/\.[^\s@]+$/.test(v)) {
    return {
      state: "invalid",
      message: isRu ? "Email указан не полностью (нет домена после точки)" : "Email is incomplete (missing domain)",
    };
  }
  if (/^[A-Za-z]/.test(v) && !v.includes("@")) {
    return {
      state: "invalid",
      message: isRu
        ? "Похоже, это логин. Нужен числовой User ID из настроек профиля или полный email"
        : "Looks like a login. Use the numeric User ID from profile settings or a full email",
    };
  }
  return {
    state: "invalid",
    message: isRu
      ? "Неверный формат. Допустимы: число (User ID) или email"
      : "Invalid format. Allowed: number (User ID) or email",
  };
}

function validateTopvisorApiKey(raw: string, isRu: boolean): UidValidation {
  const v = raw.trim();
  if (!v) {
    return { state: "empty", message: isRu ? "Введите API Key из раздела «API» в Topvisor" : "Enter API Key from Topvisor «API» section" };
  }
  if (v.length < 20) {
    return {
      state: "invalid",
      message: isRu
        ? `API Key подозрительно короткий (${v.length} симв.) — должен быть 30+ символов`
        : `API Key looks too short (${v.length} chars) — usually 30+`,
    };
  }
  if (/\s/.test(v)) {
    return { state: "invalid", message: isRu ? "В API Key не должно быть пробелов" : "API Key must not contain spaces" };
  }
  return { state: "valid", kind: "numeric", message: isRu ? "Формат API Key корректный" : "API Key format looks valid" };
}

function FieldHint({ v }: { v: UidValidation }) {
  if (v.state === "empty") {
    return <p className="text-xs text-muted-foreground">{v.message}</p>;
  }
  if (v.state === "valid") {
    return (
      <p className="text-xs text-emerald-500 flex items-center gap-1">
        <CheckCircle2 className="h-3 w-3" />
        {v.message}
      </p>
    );
  }
  return (
    <p className="text-xs text-destructive flex items-center gap-1">
      <AlertCircle className="h-3 w-3" />
      {v.message}
    </p>
  );
}

/* ═══════════════════════════════════════════════════════
   Setup Form (Empty State)
   ═══════════════════════════════════════════════════════ */
function TopvisorSetupForm({ projectId, onConnected }: { projectId: string; onConnected: () => void }) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const [apiKey, setApiKey] = useState("");
  const [userId, setUserId] = useState("");
  const [testing, setTesting] = useState(false);

  const uidValidation = useMemo(() => validateTopvisorUserId(userId, isRu), [userId, isRu]);
  const keyValidation = useMemo(() => validateTopvisorApiKey(apiKey, isRu), [apiKey, isRu]);
  const canSubmit = uidValidation.state === "valid" && keyValidation.state === "valid" && !testing;

  const handleTest = async () => {
    if (uidValidation.state !== "valid") {
      toast.error(uidValidation.message);
      return;
    }
    if (keyValidation.state !== "valid") {
      toast.error(keyValidation.message);
      return;
    }
    const normalizedUserId = userId.trim();
    setTesting(true);
    try {
      await callTopvisor("test-connection", apiKey.trim(), normalizedUserId);
      await supabase.from("projects").update({
        topvisor_api_key: apiKey.trim(),
        topvisor_user_id: normalizedUserId,
      } as any).eq("id", projectId);
      const existing = await supabase.from("integrations").select("id, external_project_id").eq("project_id", projectId).eq("service_name", "topvisor").maybeSingle();
      if (existing.data) {
        await supabase.from("integrations").update({
          api_key: apiKey.trim(), counter_id: normalizedUserId, connected: true, last_sync: new Date().toISOString(),
        }).eq("id", existing.data.id);
      } else {
        await supabase.from("integrations").insert({
          project_id: projectId, service_name: "topvisor", api_key: apiKey.trim(),
          counter_id: normalizedUserId, connected: true, last_sync: new Date().toISOString(),
        });
      }
      const tvPid = existing.data?.external_project_id;
      if (tvPid) {
        try {
          await callTopvisor("run-check", apiKey.trim(), normalizedUserId, { project_id: tvPid });
          toast.success(isRu
            ? "Topvisor подключен! Запущен съём позиций — данные появятся через 1–5 мин."
            : "Topvisor connected! Position check started — data in 1–5 min.");
        } catch {
          toast.success(isRu ? "Topvisor подключен!" : "Topvisor connected!");
        }
      } else {
        toast.success(isRu ? "Topvisor подключен!" : "Topvisor connected!");
      }
      onConnected();
    } catch (err: any) {
      toast.error(err.message || "Connection failed");
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="flex flex-col items-center justify-center py-16 px-4">
      <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-6">
        <Trophy className="h-10 w-10 text-primary" />
      </div>
      <h2 className="text-xl font-bold text-foreground mb-2">
        {isRu ? "Подключите Topvisor" : "Connect Topvisor"}
      </h2>
      <p className="text-sm text-muted-foreground text-center max-w-md mb-8">
        {isRu
          ? "Введите User ID и API Key из личного кабинета Topvisor для автоматического отслеживания позиций."
          : "Enter your User ID and API Key from Topvisor to automatically track keyword positions."}
      </p>
      <GlassCard className="w-full max-w-md">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-2">
            <Label>User ID Topvisor *</Label>
            <Input
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="123456 или user@example.com"
              aria-invalid={uidValidation.state === "invalid"}
              className={cn(
                uidValidation.state === "invalid" && "border-destructive focus-visible:ring-destructive",
                uidValidation.state === "valid" && "border-emerald-500/60",
              )}
            />
            <FieldHint v={uidValidation} />
          </div>
          <div className="space-y-2">
            <Label>API Key *</Label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="tv_xxxxxxxxxxxxxxxx"
              type="password"
              aria-invalid={keyValidation.state === "invalid"}
              className={cn(
                keyValidation.state === "invalid" && "border-destructive focus-visible:ring-destructive",
                keyValidation.state === "valid" && "border-emerald-500/60",
              )}
            />
            <FieldHint v={keyValidation} />
          </div>
          <a href="https://topvisor.com/ru/support/api/getting-started/" target="_blank" rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <LinkIcon className="h-3 w-3" />
            {isRu ? "Где взять ключи в Topvisor?" : "Where to get Topvisor keys?"}
          </a>
          <Button onClick={handleTest} disabled={!canSubmit} className="w-full gap-2">
            {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {isRu ? "Проверить подключение" : "Test Connection"}
          </Button>
        </CardContent>
      </GlassCard>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Position color helpers
   ═══════════════════════════════════════════════════════ */
function positionColor(pos: number | null) {
  if (pos === null || pos <= 0) return "text-muted-foreground";
  if (pos <= 3) return "text-amber-400 font-bold";
  if (pos <= 10) return "text-emerald-500 font-bold";
  if (pos <= 30) return "text-primary font-bold";
  return "text-muted-foreground font-bold";
}

function positionBg(pos: number | null) {
  if (pos === null || pos <= 0) return "";
  if (pos <= 3) return "bg-amber-400/10";
  if (pos <= 10) return "bg-emerald-500/10";
  if (pos <= 30) return "bg-primary/10";
  return "";
}

/* ═══════════════════════════════════════════════════════
   Brand detection
   ═══════════════════════════════════════════════════════ */
function isBrandKeyword(keyword: string, projectUrl?: string | null): boolean {
  const lower = keyword.toLowerCase();
  if (projectUrl) {
    const domain = projectUrl.replace(/^https?:\/\//, "").replace(/\/$/, "").split(".")[0];
    if (domain && domain.length > 2 && lower.includes(domain.toLowerCase())) return true;
  }
  return false;
}

/* ═══════════════════════════════════════════════════════
   Search URL builder
   ═══════════════════════════════════════════════════════ */
function buildSearchUrl(query: string, searcherName: string, regionKey: number, countryCode: string): string {
  const encoded = encodeURIComponent(query);
  if (searcherName === "Yandex") {
    return `https://yandex.ru/search/?text=${encoded}&lr=${regionKey}`;
  }
  return `https://www.google.com/search?q=${encoded}&gl=${countryCode.toLowerCase()}&hl=ru`;
}

/* ═══════════════════════════════════════════════════════
   Main PositionsTab
   ═══════════════════════════════════════════════════════ */
export function PositionsTab({
  projectId, projectName, projectUrl,
  hasTopvisor = false, topvisorApiKey, topvisorUserId,
  topvisorExternalProjectId, integrationId, onNavigateSettings,
}: PositionsTabProps) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";
  const isRefreshing = useTabRefresh();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [showReconnect, setShowReconnect] = useState(false);
  const [brandFilter, setBrandFilter] = useState<"all" | "brand" | "nonbrand">("all");

  const tvProjectId = topvisorExternalProjectId;
  const apiKey = topvisorApiKey;
  const userId = topvisorUserId;

  if (!hasTopvisor || !apiKey || !userId || showReconnect) {
    return (
      <TopvisorSetupForm
        projectId={projectId}
        onConnected={() => {
          setShowReconnect(false);
          queryClient.invalidateQueries({ queryKey: ["integrations", projectId] });
        }}
      />
    );
  }

  if (!tvProjectId) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-semibold text-foreground mb-2">
          {isRu ? "Проект Topvisor не привязан" : "Topvisor project not linked"}
        </h3>
        <p className="text-sm text-muted-foreground text-center max-w-md">
          {isRu
            ? "Привяжите проект Topvisor в настройках интеграции."
            : "Link a Topvisor project in integration settings."}
        </p>
      </div>
    );
  }

  return (
    <PositionsDashboard
      apiKey={apiKey}
      userId={userId}
      tvProjectId={tvProjectId}
      projectId={projectId}
      projectName={projectName}
      projectUrl={projectUrl}
      integrationId={integrationId!}
      searchQuery={searchQuery}
      setSearchQuery={setSearchQuery}
      brandFilter={brandFilter}
      setBrandFilter={setBrandFilter}
      isRefreshing={isRefreshing}
      onReconnect={() => setShowReconnect(true)}
    />
  );
}

/* ═══════════════════════════════════════════════════════
   Dashboard with Google/Yandex tabs & date columns
   ═══════════════════════════════════════════════════════ */
function PositionsDashboard({
  apiKey, userId, tvProjectId, projectId, projectName, projectUrl, integrationId,
  searchQuery, setSearchQuery, brandFilter, setBrandFilter, isRefreshing, onReconnect,
}: {
  apiKey: string; userId: string; tvProjectId: string; projectId: string;
  projectName?: string; projectUrl?: string | null; integrationId: string;
  searchQuery: string; setSearchQuery: (v: string) => void;
  brandFilter: "all" | "brand" | "nonbrand"; setBrandFilter: (v: "all" | "brand" | "nonbrand") => void;
  isRefreshing: boolean; onReconnect?: () => void;
}) {
  const { i18n } = useTranslation();
  const isRu = i18n.language === "ru";

  const dateFrom = format(subDays(new Date(), 30), "yyyy-MM-dd");
  const dateTo = format(new Date(), "yyyy-MM-dd");

  // ── Load project info with searchers/regions ──
  const { data: projectInfo } = useQuery({
    queryKey: ["topvisor-project-info", tvProjectId, apiKey, userId],
    queryFn: async () => {
      const data = await callTopvisor("get-projects", apiKey, userId);
      const projects = (data?.result || []) as TvProject[];
      const found = projects.find((p) => String(p.id) === tvProjectId);
      if (!found?.searchers) return null;
      return found;
    },
  });

  // ── Build searcher tabs with region info ──
  const searcherTabs = useMemo((): SearcherTab[] => {
    if (!projectInfo?.searchers) return [];
    return projectInfo.searchers
      .map((s) => {
        const firstRegion = s.regions?.[0];
        if (!firstRegion) return null;
        return {
          key: String(s.key),
          name: s.name || (s.key === 0 ? "Yandex" : s.key === 1 ? "Google" : `SE ${s.key}`),
          regionIndexes: (s.regions || []).map((r) => String(r.index)),
          regionKey: firstRegion.key || 0,
          countryCode: firstRegion.countryCode || "RU",
          regionName: firstRegion.name || "",
        } as SearcherTab;
      })
      .filter(Boolean) as SearcherTab[];
  }, [projectInfo]);

  // ── Collect ALL region indexes for the API call ──
  const allRegionIndexes = useMemo(() => {
    if (!projectInfo?.searchers) return [];
    return projectInfo.searchers
      .flatMap((s) => (s.regions || []).map((r) => Number(r.index)))
      .filter((n) => Number.isFinite(n) && n > 0);
  }, [projectInfo]);

  // ── Fetch rankings history ──
  // refetchInterval: пока вкладка открыта, обновляем позиции каждые 10 минут.
  const { data: rankingsData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["topvisor-rankings-history", tvProjectId, dateFrom, dateTo, allRegionIndexes.join(",")],
    queryFn: async () => {
      return await callTopvisor("get-rankings-history", apiKey, userId, {
        project_id: tvProjectId,
        regions_indexes: allRegionIndexes,
        date_from: dateFrom,
        date_to: dateTo,
      });
    },
    enabled: allRegionIndexes.length > 0,
    retry: 1,
    refetchInterval: 10 * 60 * 1000,
    refetchIntervalInBackground: false,
  });

  // ── Parse response ──
  const { allDates, keywordRows } = useMemo(() => {
    if (!rankingsData?.result) return { allDates: [] as string[], keywordRows: [] as KeywordRow[] };

    const result = rankingsData.result;
    const headerDates: string[] = Array.isArray(result?.headers?.dates) ? result.headers.dates : [];
    const existsDates: string[] = Array.isArray(result?.exists_dates) ? result.exists_dates : headerDates;
    const rows = Array.isArray(result?.keywords) ? result.keywords : [];

    const allDates = (existsDates.length > 0 ? existsDates : headerDates).sort();

    const kwRows: KeywordRow[] = rows.map((row: any) => {
      const positionsObj = row.positionsData && typeof row.positionsData === "object" ? row.positionsData : {};
      const positions: Record<string, number | null> = {};

      for (const [key, val] of Object.entries(positionsObj)) {
        const parts = key.split(":");
        const date = parts[0];
        const regionIdx = parts[2] || parts[1];

        const posVal = (val as any)?.position;
        let numPos: number | null = null;
        if (posVal !== null && posVal !== undefined && posVal !== "--" && posVal !== "" && posVal !== "0") {
          const n = Number(posVal);
          numPos = Number.isFinite(n) && n > 0 ? n : null;
        }

        positions[`${date}:${regionIdx}`] = numPos;
      }

      return {
        keyword: row.name || "",
        group: row.group_name || undefined,
        isBrand: isBrandKeyword(row.name || "", projectUrl),
        positions,
      };
    });

    return { allDates, keywordRows: kwRows };
  }, [rankingsData, projectUrl]);

  // ── Filter keywords ──
  const filtered = useMemo(() => {
    let result = keywordRows;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter((k) => k.keyword.toLowerCase().includes(q));
    }
    if (brandFilter === "brand") result = result.filter((k) => k.isBrand);
    if (brandFilter === "nonbrand") result = result.filter((k) => !k.isBrand);
    return result;
  }, [keywordRows, searchQuery, brandFilter]);

  const [isRunningCheck, setIsRunningCheck] = useState(false);

  const handleSync = () => {
    refetch();
    toast.success(isRu ? "Данные обновлены" : "Data refreshed");
  };

  const handleRunCheck = async () => {
    if (isRunningCheck) return;
    setIsRunningCheck(true);
    try {
      await callTopvisor("run-check", apiKey, userId, { project_id: tvProjectId });
      toast.success(
        isRu
          ? "Съём позиций запущен в Topvisor. Данные появятся через 1–5 мин."
          : "Position check started in Topvisor. Data will arrive in 1–5 min."
      );
      // Несколько повторных попыток подтянуть данные после запуска съёма
      [60_000, 120_000, 240_000].forEach((ms) => setTimeout(() => refetch(), ms));
    } catch (e: any) {
      toast.error(e?.message || (isRu ? "Не удалось запустить съём" : "Failed to start check"));
    } finally {
      setIsRunningCheck(false);
    }
  };

  /* ── Compute dates with data for a specific searcher ── */
  const getDatesForSearcher = useCallback((regionIndexes: string[]) => {
    const datesWithData = new Set<string>();
    for (const kw of keywordRows) {
      for (const date of allDates) {
        for (const ri of regionIndexes) {
          const pos = kw.positions[`${date}:${ri}`];
          if (pos !== null && pos !== undefined) {
            datesWithData.add(date);
          }
        }
      }
    }
    // Sort newest first, take last 7
    return [...datesWithData].sort().slice(-7).reverse();
  }, [keywordRows, allDates]);

  /* ── Render table for a specific searcher ── */
  const renderTable = (tab: SearcherTab) => {
    const { regionIndexes, name: searcherName, regionKey, countryCode, regionName } = tab;
    const dates = getDatesForSearcher(regionIndexes);

    if (dates.length === 0 && !isLoading) {
      return (
        <div className="flex flex-col items-center justify-center py-12">
          <AlertCircle className="h-10 w-10 text-muted-foreground mb-3" />
          <p className="text-sm text-muted-foreground">
            {isRu ? "Нет данных о проверках за выбранный период" : "No ranking data for selected period"}
          </p>
        </div>
      );
    }

    // KPI
    const allPositions: number[] = [];
    const prevPositions: number[] = [];
    filtered.forEach((kw) => {
      const latestDate = dates[0];
      const prevDate = dates[1];
      regionIndexes.forEach((ri) => {
        const cur = kw.positions[`${latestDate}:${ri}`];
        const prev = kw.positions[`${prevDate}:${ri}`];
        if (cur !== null && cur !== undefined) allPositions.push(cur);
        if (prev !== null && prev !== undefined) prevPositions.push(prev);
      });
    });

    const avgPos = allPositions.length > 0 ? allPositions.reduce((a, b) => a + b, 0) / allPositions.length : 0;
    const prevAvgPos = prevPositions.length > 0 ? prevPositions.reduce((a, b) => a + b, 0) / prevPositions.length : 0;
    const posChange = prevAvgPos > 0 ? prevAvgPos - avgPos : 0;

    const top3 = allPositions.filter((p) => p <= 3).length;
    const top10 = allPositions.filter((p) => p <= 10).length;
    const top30 = allPositions.filter((p) => p <= 30).length;
    const outside = allPositions.length - top30;
    const total = allPositions.length || 1;
    const visibility = Math.round((top10 / total) * 100);

    return (
      <div className="space-y-4">
        {/* KPI row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <StandardKpiCard
            label={isRu ? "Средняя позиция" : "Avg Position"}
            value={avgPos > 0 ? avgPos.toFixed(1) : "—"}
            change={posChange}
            invertChange
            tooltipKey="avgPosition"
            loading={isRefreshing}
          />
          <StandardKpiCard
            label={isRu ? "Видимость" : "Visibility"}
            value={`${visibility}%`}
            change={0}
            loading={isRefreshing}
          />
          <GlassCard>
            <CardContent className="p-4 space-y-2">
              <span className="text-xs text-muted-foreground font-medium">
                {isRu ? "Распределение" : "Distribution"}
              </span>
              <div className="flex h-3 rounded-full overflow-hidden bg-muted">
                {top3 > 0 && <div className="bg-amber-400" style={{ width: `${(top3 / total) * 100}%` }} />}
                {(top10 - top3) > 0 && <div className="bg-emerald-500" style={{ width: `${((top10 - top3) / total) * 100}%` }} />}
                {(top30 - top10) > 0 && <div className="bg-primary" style={{ width: `${((top30 - top10) / total) * 100}%` }} />}
                {outside > 0 && <div className="bg-muted-foreground/30" style={{ width: `${(outside / total) * 100}%` }} />}
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] text-muted-foreground">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-400" />Top 3: {top3}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" />Top 10: {top10 - top3}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-primary" />Top 30: {top30 - top10}</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-muted-foreground/30" />{isRu ? "Вне" : "Out"}: {outside}</span>
              </div>
            </CardContent>
          </GlassCard>
          <GlassCard>
            <CardContent className="p-4 space-y-2">
              <span className="text-xs text-muted-foreground font-medium">
                {isRu ? "Запросов" : "Keywords"}
              </span>
              <p className="text-2xl font-bold text-foreground">{filtered.length}</p>
              <p className="text-[10px] text-muted-foreground">
                {searcherName} • {regionName}
              </p>
            </CardContent>
          </GlassCard>
        </div>

        {/* Rankings table */}
        <GlassCard>
          <CardContent className="p-0">
            <div className="px-5 pt-4 pb-2 flex items-center justify-between flex-wrap gap-2">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">
                    {isRu ? "Запросы и позиции" : "Keywords & Positions"}
                  </h3>
                  <PositionsLiveStatus
                    isLoading={isLoading}
                    isError={isError}
                    errorMessage={(error as Error | null)?.message}
                    rowCount={keywordRows.length}
                    dateCount={allDates.length}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {filtered.length} {isRu ? "запросов" : "keywords"} • {searcherName} • {regionName}
                </p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <TooltipProvider delayDuration={200}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="text-left p-3 font-medium text-muted-foreground sticky left-0 bg-muted/30 z-10 min-w-[240px]">
                        {isRu ? "Запрос" : "Keyword"}
                      </th>
                      <th className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[60px]">
                        {isRu ? "Группа" : "Group"}
                      </th>
                      {dates.map((date) => (
                        <th key={date} className="text-center p-2 font-medium text-muted-foreground text-xs min-w-[70px]">
                          {date.slice(5).replace("-", ".")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map((kw, i) => (
                      <tr key={i} className="border-b border-border/50 hover:bg-muted/20 transition-colors group">
                        <td className="p-3 sticky left-0 bg-background z-10">
                          <div className="flex items-center gap-2">
                            <span className="text-foreground font-medium text-sm truncate max-w-[200px]">
                              {kw.keyword}
                            </span>
                            {kw.isBrand && (
                              <Badge variant="outline" className="text-[9px] px-1.5 py-0 border-amber-400/50 text-amber-400 shrink-0">
                                Brand
                              </Badge>
                            )}
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <a
                                  href={buildSearchUrl(kw.keyword, searcherName, regionKey, countryCode)}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="shrink-0 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground/40 hover:text-primary"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              </TooltipTrigger>
                              <TooltipContent side="right" className="text-xs">
                                {isRu
                                  ? `Проверить в ${searcherName} (${regionName})`
                                  : `Check in ${searcherName} (${regionName})`}
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </td>
                        <td className="p-2 text-center text-xs text-muted-foreground truncate max-w-[80px]">
                          {kw.group || "—"}
                        </td>
                        {dates.map((date, dateIdx) => {
                          let pos: number | null = null;
                          for (const ri of regionIndexes) {
                            const p = kw.positions[`${date}:${ri}`];
                            if (p !== null && p !== undefined) { pos = p; break; }
                          }

                          let prevPos: number | null = null;
                          const prevDate = dates[dateIdx + 1];
                          if (prevDate) {
                            for (const ri of regionIndexes) {
                              const p = kw.positions[`${prevDate}:${ri}`];
                              if (p !== null && p !== undefined) { prevPos = p; break; }
                            }
                          }

                          const delta = prevPos !== null && pos !== null ? prevPos - pos : null;

                          return (
                            <td key={date} className={cn("p-2 text-center", positionBg(pos))}>
                              <div className="flex flex-col items-center">
                                <span className={cn("text-sm", positionColor(pos))}>
                                  {pos ?? "—"}
                                </span>
                                {delta !== null && delta !== 0 && (
                                  <span className={cn(
                                    "text-[9px] flex items-center gap-0.5",
                                    delta > 0 ? "text-emerald-500" : "text-destructive"
                                  )}>
                                    {delta > 0 ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                                    {Math.abs(delta)}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    {filtered.length === 0 && (
                      <tr>
                        <td colSpan={dates.length + 2} className="p-8 text-center text-muted-foreground">
                          {isRu ? "Ничего не найдено" : "Nothing found"}
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </TooltipProvider>
            </div>
          </CardContent>
        </GlassCard>
      </div>
    );
  };

  /* ── Loading skeleton ── */
  const renderSkeleton = () => (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <GlassCard key={i}><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></GlassCard>
        ))}
      </div>
      <GlassCard>
        <CardContent className="p-5 space-y-3">
          <Skeleton className="h-8 w-full" />
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </CardContent>
      </GlassCard>
    </div>
  );

  return (
    <div className="space-y-5 relative">
      {isRefreshing && <TabLoadingOverlay show={isRefreshing} />}

      {/* Header bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60">
          <span className="text-xs font-medium text-foreground">{projectName || "—"}</span>
          {projectUrl && (
            <>
              <span className="text-xs text-muted-foreground">—</span>
              <span className="text-xs text-primary font-medium">{projectUrl.replace(/^https?:\/\//, "")}</span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/50 border border-border/60 text-xs text-muted-foreground">
          {dateFrom.slice(5).replace("-", ".")} — {dateTo.slice(5).replace("-", ".")}
        </div>

        <Button variant="outline" size="sm" className="gap-1.5" onClick={handleSync}>
          <RefreshCw className={cn("h-3.5 w-3.5", isLoading && "animate-spin")} />
          {isRu ? "Обновить" : "Refresh"}
        </Button>

        <Button
          variant="default"
          size="sm"
          className="gap-1.5"
          onClick={handleRunCheck}
          disabled={isRunningCheck}
        >
          {isRunningCheck ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <RefreshCw className="h-3.5 w-3.5" />
          )}
          {isRu ? "Обновить позиции в Topvisor" : "Run Topvisor check"}
        </Button>

        {/* Brand filter */}
        <div className="flex items-center gap-1 ml-auto">
          <Button
            variant={brandFilter === "all" ? "secondary" : "ghost"}
            size="sm" className="text-xs h-7 px-2"
            onClick={() => setBrandFilter("all")}
          >
            {isRu ? "Все" : "All"}
          </Button>
          <Button
            variant={brandFilter === "brand" ? "secondary" : "ghost"}
            size="sm" className="text-xs h-7 px-2"
            onClick={() => setBrandFilter("brand")}
          >
            Brand
          </Button>
          <Button
            variant={brandFilter === "nonbrand" ? "secondary" : "ghost"}
            size="sm" className="text-xs h-7 px-2"
            onClick={() => setBrandFilter("nonbrand")}
          >
            Non-brand
          </Button>
        </div>
      </div>

      {/* Topvisor summary panel — horizontal */}
      {!isError && !isLoading && keywordRows.length > 0 && (() => {
        const latestDate = allDates[allDates.length - 1];
        const prevDate = allDates.length > 1 ? allDates[allDates.length - 2] : null;
        const cur: number[] = [];
        const prev: number[] = [];
        for (const kw of filtered) {
          for (const ri of allRegionIndexes) {
            const c = kw.positions[`${latestDate}:${ri}`];
            if (c !== null && c !== undefined) cur.push(c);
            if (prevDate) {
              const p = kw.positions[`${prevDate}:${ri}`];
              if (p !== null && p !== undefined) prev.push(p);
            }
          }
        }
        const total = cur.length || 1;
        const top1 = cur.filter((p) => p === 1).length;
        const top3 = cur.filter((p) => p <= 3).length;
        const top10 = cur.filter((p) => p <= 10).length;
        const top30 = cur.filter((p) => p <= 30).length;
        const outside = cur.length - top30;
        const avg = cur.length ? cur.reduce((a, b) => a + b, 0) / cur.length : 0;
        const prevAvg = prev.length ? prev.reduce((a, b) => a + b, 0) / prev.length : 0;
        const avgDelta = prevAvg > 0 ? +(prevAvg - avg).toFixed(1) : 0;
        const visibility = Math.round((top10 / total) * 100);
        const prevTop10 = prev.filter((p) => p <= 10).length;
        const top10Delta = top10 - prevTop10;

        const stats = [
          { label: isRu ? "TOP-1" : "TOP-1", value: top1, color: "text-amber-400", bg: "bg-amber-400/10" },
          { label: isRu ? "TOP-3" : "TOP-3", value: top3, color: "text-amber-400", bg: "bg-amber-400/10" },
          { label: isRu ? "TOP-10" : "TOP-10", value: top10, delta: top10Delta, color: "text-emerald-500", bg: "bg-emerald-500/10" },
          { label: isRu ? "TOP-30" : "TOP-30", value: top30, color: "text-primary", bg: "bg-primary/10" },
          { label: isRu ? "Вне ТОП" : "Out", value: outside, color: "text-muted-foreground", bg: "bg-muted/40" },
          { label: isRu ? "Ср. позиция" : "Avg pos", value: avg > 0 ? avg.toFixed(1) : "—", delta: avgDelta, invertDelta: true, color: "text-foreground", bg: "bg-muted/40" },
          { label: isRu ? "Видимость" : "Visibility", value: `${visibility}%`, color: "text-foreground", bg: "bg-muted/40" },
          { label: isRu ? "Запросов" : "Keywords", value: filtered.length, color: "text-foreground", bg: "bg-muted/40" },
        ];

        return (
          <GlassCard>
            <CardContent className="p-3">
              <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
                {stats.map((s, i) => {
                  const d = (s as any).delta;
                  const invert = (s as any).invertDelta;
                  const positive = invert ? d > 0 : d > 0;
                  return (
                    <div key={i} className={cn("rounded-lg px-3 py-2 flex flex-col items-start gap-0.5", s.bg)}>
                      <span className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">{s.label}</span>
                      <div className="flex items-baseline gap-1.5">
                        <span className={cn("text-lg font-bold leading-none", s.color)}>{s.value}</span>
                        {d !== undefined && d !== 0 && (
                          <span className={cn(
                            "text-[10px] font-medium flex items-center gap-0.5",
                            positive ? "text-emerald-500" : "text-destructive"
                          )}>
                            {positive ? <ArrowUp className="h-2.5 w-2.5" /> : <ArrowDown className="h-2.5 w-2.5" />}
                            {Math.abs(d)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </GlassCard>
        );
      })()}

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={isRu ? "Поиск по запросу…" : "Search keywords…"}
          className="pl-9 h-9 text-sm"
        />
      </div>

      {/* Error */}
      {isError && (
        <GlassCard>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3 text-destructive">
              <AlertCircle className="h-5 w-5" />
              <p className="text-sm font-medium">{(error as Error)?.message || "Error loading data"}</p>
            </div>
            {onReconnect && (
              <Button variant="outline" size="sm" className="gap-1.5" onClick={onReconnect}>
                <KeyRound className="h-3.5 w-3.5" />
                {isRu ? "Переподключить" : "Reconnect"}
              </Button>
            )}
          </CardContent>
        </GlassCard>
      )}

      {/* Searcher tabs */}
      {!isError && (
        searcherTabs.length > 0 ? (
          <Tabs defaultValue={searcherTabs[0]?.key} className="space-y-4">
            <TabsList className="bg-muted/50">
              {searcherTabs.map((tab) => (
                <TabsTrigger key={tab.key} value={tab.key} className="text-xs gap-1.5">
                  {tab.name} — {tab.regionName}
                </TabsTrigger>
              ))}
            </TabsList>
            {searcherTabs.map((tab) => (
              <TabsContent key={tab.key} value={tab.key}>
                {isLoading ? renderSkeleton() : renderTable(tab)}
              </TabsContent>
            ))}
          </Tabs>
        ) : isLoading ? (
          renderSkeleton()
        ) : (
          <div className="flex flex-col items-center justify-center py-16">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-sm text-muted-foreground">
              {isRu ? "Нет данных о регионах" : "No regions found"}
            </p>
          </div>
        )
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════
   Inline status badge for live Topvisor positions
   ═══════════════════════════════════════════════════════ */
function PositionsLiveStatus({
  isLoading,
  isError,
  errorMessage,
  rowCount,
  dateCount,
}: {
  isLoading: boolean;
  isError: boolean;
  errorMessage?: string;
  rowCount: number;
  dateCount: number;
}) {
  let cls = "border-muted-foreground/30 text-muted-foreground bg-muted/30";
  let icon = <Loader2 className="h-3 w-3 animate-spin" />;
  let short = "проверка…";
  let tooltip = "Загружаем позиции из Topvisor…";

  if (!isLoading) {
    if (isError) {
      cls = "border-destructive/40 text-destructive bg-destructive/10";
      icon = <AlertCircle className="h-3 w-3" />;
      short = "ошибка";
      tooltip = errorMessage
        ? `Не удалось получить данные из Topvisor: ${errorMessage}`
        : "Не удалось получить данные из Topvisor.";
    } else if (rowCount > 0 && dateCount > 0) {
      cls = "border-emerald-500/40 text-emerald-500 bg-emerald-500/10";
      icon = <CheckCircle2 className="h-3 w-3" />;
      short = "есть данные";
      tooltip = `Получено ${rowCount} запросов и ${dateCount} замеров из Topvisor.`;
    } else {
      cls = "border-amber-500/40 text-amber-500 bg-amber-500/10";
      icon = <AlertCircle className="h-3 w-3" />;
      short = "пусто";
      tooltip =
        "В проекте Topvisor нет ключевых слов или ещё ни разу не делался съём позиций. Нажмите «Обновить позиции в Topvisor».";
    }
  }

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge variant="outline" className={cn("gap-1.5 text-[10.5px] font-medium px-2 py-0.5 h-6 cursor-help", cls)}>
            {icon}
            <span>Позиции: {short}</span>
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="bottom" className="max-w-[280px] text-xs">
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
