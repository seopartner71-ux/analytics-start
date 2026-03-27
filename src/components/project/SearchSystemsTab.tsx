import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { ChevronRight, ChevronDown, Search, Globe, ArrowUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface SearchSystemsTabProps {
  projectId: string;
  showComparison?: boolean;
}

/* ── Yandex / Google brand SVG icons ── */
const YandexIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0" fill="none">
    <rect width="24" height="24" rx="4" fill="#FC3F1D" />
    <path d="M13.64 18H15.6V6H13.17C10.47 6 9.04 7.47 9.04 9.63C9.04 11.45 9.93 12.47 11.52 13.56L9 18H11.13L13.93 13.11L12.74 12.31C11.39 11.39 10.73 10.68 10.73 9.5C10.73 8.26 11.56 7.56 13.17 7.56H13.64V18Z" fill="white" />
  </svg>
);
const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09a6.96 6.96 0 0 1 0-4.17V7.07H2.18a11.02 11.02 0 0 0 0 9.86l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
);

/* ── Demo data structure ── */
interface Phrase {
  name: string;
  visits: number;
  visitors: number;
  bounce: number;
  depth: number;
  duration: number; // seconds
  prevVisits?: number;
}
interface SubChannel {
  name: string;
  visits: number;
  visitors: number;
  bounce: number;
  depth: number;
  duration: number;
  prevVisits?: number;
  phrases: Phrase[];
}
interface EngineData {
  engine: string;
  icon: React.ReactNode;
  visits: number;
  visitors: number;
  bounce: number;
  depth: number;
  duration: number;
  prevVisits?: number;
  subChannels: SubChannel[];
}

function buildDemoData(comparison: boolean): EngineData[] {
  const rnd = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;
  const mkPhrases = (prefix: string, n: number): Phrase[] =>
    Array.from({ length: n }, (_, i) => ({
      name: `${prefix} запрос ${i + 1}`,
      visits: rnd(10, 800),
      visitors: rnd(8, 600),
      bounce: rnd(15, 65),
      depth: +(rnd(10, 50) / 10).toFixed(1),
      duration: rnd(20, 400),
      ...(comparison ? { prevVisits: rnd(10, 800) } : {}),
    }));
  const mkSub = (name: string, phrases: Phrase[]): SubChannel => {
    const visits = phrases.reduce((s, p) => s + p.visits, 0);
    return {
      name,
      visits,
      visitors: phrases.reduce((s, p) => s + p.visitors, 0),
      bounce: +(phrases.reduce((s, p) => s + p.bounce, 0) / phrases.length).toFixed(1),
      depth: +(phrases.reduce((s, p) => s + p.depth, 0) / phrases.length).toFixed(1),
      duration: Math.round(phrases.reduce((s, p) => s + p.duration, 0) / phrases.length),
      ...(comparison ? { prevVisits: Math.round(visits * (0.7 + Math.random() * 0.6)) } : {}),
      phrases,
    };
  };
  const mkEngine = (engine: string, icon: React.ReactNode, subs: SubChannel[]): EngineData => {
    const visits = subs.reduce((s, c) => s + c.visits, 0);
    return {
      engine,
      icon,
      visits,
      visitors: subs.reduce((s, c) => s + c.visitors, 0),
      bounce: +(subs.reduce((s, c) => s + c.bounce, 0) / subs.length).toFixed(1),
      depth: +(subs.reduce((s, c) => s + c.depth, 0) / subs.length).toFixed(1),
      duration: Math.round(subs.reduce((s, c) => s + c.duration, 0) / subs.length),
      ...(comparison ? { prevVisits: Math.round(visits * (0.7 + Math.random() * 0.6)) } : {}),
      subChannels: subs,
    };
  };

  return [
    mkEngine("Яндекс", <YandexIcon />, [
      mkSub("Яндекс: Поиск", mkPhrases("ya-search", 8)),
      mkSub("Яндекс: Картинки", mkPhrases("ya-img", 4)),
    ]),
    mkEngine("Google", <GoogleIcon />, [
      mkSub("Google: Поиск", mkPhrases("g-search", 10)),
      mkSub("Google: Картинки", mkPhrases("g-img", 3)),
    ]),
    mkEngine("Другие", <Globe className="h-4 w-4 text-muted-foreground" />, [
      mkSub("Bing", mkPhrases("bing", 3)),
      mkSub("DuckDuckGo", mkPhrases("ddg", 2)),
    ]),
  ];
}

const formatTime = (s: number) => {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
};

const bounceColor = (v: number) =>
  v > 50 ? "text-destructive" : v > 30 ? "text-orange-400" : "text-foreground";

const Delta = ({ current, prev }: { current: number; prev?: number }) => {
  if (prev === undefined) return null;
  const pct = prev === 0 ? 0 : Math.round(((current - prev) / prev) * 100);
  return (
    <span className={cn("text-[10px] ml-1", pct >= 0 ? "text-emerald-500" : "text-destructive")}>
      {pct >= 0 ? "+" : ""}{pct}%
    </span>
  );
};

type SortKey = "visits" | "visitors" | "bounce" | "depth" | "duration";

export function SearchSystemsTab({ projectId, showComparison = false }: SearchSystemsTabProps) {
  const { t } = useTranslation();
  const [data] = useState<EngineData[]>(() => buildDemoData(showComparison));
  const [expandedEngines, setExpandedEngines] = useState<Set<string>>(new Set());
  const [expandedSubs, setExpandedSubs] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("visits");
  const [sortAsc, setSortAsc] = useState(false);

  const toggleEngine = (e: string) => setExpandedEngines((p) => { const n = new Set(p); n.has(e) ? n.delete(e) : n.add(e); return n; });
  const toggleSub = (s: string) => setExpandedSubs((p) => { const n = new Set(p); n.has(s) ? n.delete(s) : n.add(s); return n; });

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const filteredData = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return data;
    return data.map((eng) => ({
      ...eng,
      subChannels: eng.subChannels.map((sub) => ({
        ...sub,
        phrases: sub.phrases.filter((p) => p.name.toLowerCase().includes(q)),
      })).filter((sub) => sub.phrases.length > 0),
    })).filter((eng) => eng.subChannels.length > 0);
  }, [data, search]);

  const sortFn = (a: any, b: any) => (sortAsc ? a[sortKey] - b[sortKey] : b[sortKey] - a[sortKey]);

  const SortBtn = ({ k, label }: { k: SortKey; label: string }) => (
    <Button variant="ghost" size="sm" className="h-auto p-0 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground" onClick={() => handleSort(k)}>
      {label}
      <ArrowUpDown className="h-3 w-3" />
    </Button>
  );

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t("searchSystems.searchPlaceholder")}
          className="pl-9 h-9 text-sm"
        />
      </div>

      <Card className="border-border bg-card overflow-hidden">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow className="border-border">
                <TableHead className="w-[280px] text-xs">{t("searchSystems.name")}</TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="visits" label={t("searchSystems.visits")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="visitors" label={t("searchSystems.visitors")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="bounce" label={t("searchSystems.bounce")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="depth" label={t("searchSystems.depth")} /></TableHead>
                <TableHead className="text-right text-xs"><SortBtn k="duration" label={t("searchSystems.duration")} /></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {[...filteredData].sort(sortFn).map((eng) => {
                const engOpen = expandedEngines.has(eng.engine);
                return (
                  <> 
                    {/* Level 1: Engine */}
                    <TableRow key={eng.engine} className="cursor-pointer hover:bg-muted/40 border-border" onClick={() => toggleEngine(eng.engine)}>
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2">
                          {engOpen ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
                          {eng.icon}
                          {eng.engine}
                        </div>
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold">{eng.visits.toLocaleString()}<Delta current={eng.visits} prev={eng.prevVisits} /></TableCell>
                      <TableCell className="text-right text-sm">{eng.visitors.toLocaleString()}</TableCell>
                      <TableCell className={cn("text-right text-sm", bounceColor(eng.bounce))}>{eng.bounce}%</TableCell>
                      <TableCell className="text-right text-sm">{eng.depth}</TableCell>
                      <TableCell className="text-right text-sm">{formatTime(eng.duration)}</TableCell>
                    </TableRow>

                    {/* Level 2: Sub-channels */}
                    {engOpen && [...eng.subChannels].sort(sortFn).map((sub) => {
                      const subKey = `${eng.engine}::${sub.name}`;
                      const subOpen = expandedSubs.has(subKey);
                      return (
                        <>
                          <TableRow key={subKey} className="cursor-pointer hover:bg-muted/30 border-border bg-muted/10" onClick={() => toggleSub(subKey)}>
                            <TableCell className="text-sm pl-10">
                              <div className="flex items-center gap-2">
                                {subOpen ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                                {sub.name}
                              </div>
                            </TableCell>
                            <TableCell className="text-right text-sm">{sub.visits.toLocaleString()}<Delta current={sub.visits} prev={sub.prevVisits} /></TableCell>
                            <TableCell className="text-right text-sm">{sub.visitors.toLocaleString()}</TableCell>
                            <TableCell className={cn("text-right text-sm", bounceColor(sub.bounce))}>{sub.bounce}%</TableCell>
                            <TableCell className="text-right text-sm">{sub.depth}</TableCell>
                            <TableCell className="text-right text-sm">{formatTime(sub.duration)}</TableCell>
                          </TableRow>

                          {/* Level 3: Phrases */}
                          {subOpen && [...sub.phrases].sort(sortFn).map((phrase) => (
                            <TableRow key={`${subKey}::${phrase.name}`} className="border-border bg-muted/5">
                              <TableCell className="text-xs text-muted-foreground pl-16">{phrase.name}</TableCell>
                              <TableCell className="text-right text-xs">{phrase.visits.toLocaleString()}<Delta current={phrase.visits} prev={phrase.prevVisits} /></TableCell>
                              <TableCell className="text-right text-xs">{phrase.visitors.toLocaleString()}</TableCell>
                              <TableCell className={cn("text-right text-xs", bounceColor(phrase.bounce))}>{phrase.bounce}%</TableCell>
                              <TableCell className="text-right text-xs">{phrase.depth}</TableCell>
                              <TableCell className="text-right text-xs">{formatTime(phrase.duration)}</TableCell>
                            </TableRow>
                          ))}
                        </>
                      );
                    })}
                  </>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
