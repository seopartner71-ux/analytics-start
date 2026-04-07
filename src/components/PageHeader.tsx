import { ReactNode, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon, RefreshCw, CalendarDays, Palette } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ChannelFilter } from "@/components/project/ChannelFilter";
import { useWorkspaceColor } from "@/contexts/WorkspaceColorContext";
import { WORKSPACE_COLORS } from "@/data/crm-mock";

interface PageHeaderProps {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  projectId?: string;
  dateRange?: { from: Date; to: Date };
  onDateRangeChange?: (range: { from: Date; to: Date }) => void;
  compRange?: { from: Date; to: Date };
  onCompRangeChange?: (range: { from: Date; to: Date }) => void;
  showComparison?: boolean;
  onShowComparisonChange?: (v: boolean) => void;
  onApply?: () => void;
  onRefresh?: () => void;
  lastUpdated?: string | null;
  showDatePicker?: boolean;
}

export function PageHeader({
  breadcrumbs, actions, projectId,
  dateRange, onDateRangeChange,
  compRange, onCompRangeChange,
  showComparison, onShowComparisonChange,
  onApply, onRefresh, lastUpdated,
  showDatePicker = false,
}: PageHeaderProps) {
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const { colorHsl, setColorHsl } = useWorkspaceColor();

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, logo_url").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const applyPreset = useCallback((type: "7d" | "30d" | "thisMonth" | "lastMonth") => {
    if (!onDateRangeChange) return;
    const today = new Date();
    switch (type) {
      case "7d": onDateRangeChange({ from: subDays(today, 7), to: today }); break;
      case "30d": onDateRangeChange({ from: subDays(today, 30), to: today }); break;
      case "thisMonth": onDateRangeChange({ from: startOfMonth(today), to: today }); break;
      case "lastMonth": { const prev = subMonths(today, 1); onDateRangeChange({ from: startOfMonth(prev), to: endOfMonth(prev) }); break; }
    }
  }, [onDateRangeChange]);

  const formatDate = (d: Date) => format(d, "dd.MM.yyyy");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
      <div className="h-14 flex items-center justify-between px-4">
        <div className="flex items-center gap-3">
          <SidebarTrigger className="text-muted-foreground" />
          {projectId && projects.length > 0 ? (
            <Select value={projectId} onValueChange={(v) => navigate(`/project/${v}`)}>
              <SelectTrigger className="w-[200px] h-8 text-xs border-none bg-muted/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.logo_url ? (
                        <img src={p.logo_url} alt="" className="h-4 w-4 rounded object-cover" />
                      ) : (
                        <div className="h-4 w-4 rounded bg-primary/20 text-[8px] flex items-center justify-center font-bold text-primary">
                          {p.name.slice(0, 2).toUpperCase()}
                        </div>
                      )}
                      <span>{p.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            breadcrumbs || <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {actions}
          {/* Workspace color picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground">
                <Palette className="h-4 w-4" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3" align="end">
              <p className="text-xs font-medium text-muted-foreground mb-2">Цвет рабочего пространства</p>
              <div className="flex gap-2">
                {WORKSPACE_COLORS.map(c => (
                  <button
                    key={c.hsl}
                    onClick={() => setColorHsl(c.hsl)}
                    className={`h-7 w-7 rounded-full border-2 transition-all ${colorHsl === c.hsl ? "border-foreground scale-110" : "border-transparent"}`}
                    style={{ backgroundColor: `hsl(${c.hsl})` }}
                    title={c.name}
                  />
                ))}
              </div>
            </PopoverContent>
          </Popover>
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Выход</span>
          </Button>
        </div>
      </div>

      {showDatePicker && dateRange && onDateRangeChange && onApply && (
        <div className="h-11 flex items-center gap-2 px-4 border-t border-border/50 overflow-x-auto">
          <div className="flex items-center gap-1">
            {(["7d", "30d", "thisMonth", "lastMonth"] as const).map((p) => {
              const labels: Record<string, string> = { "7d": "7 дней", "30d": "30 дней", "thisMonth": "Этот месяц", "lastMonth": "Прошлый месяц" };
              return (
                <Button key={p} variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground" onClick={() => applyPreset(p)}>
                  {labels[p]}
                </Button>
              );
            })}
          </div>
          <div className="w-px h-5 bg-border mx-1" />
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 px-2.5">
                <CalendarDays className="h-3 w-3" />
                {formatDate(dateRange.from)} — {formatDate(dateRange.to)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar mode="range" selected={{ from: dateRange.from, to: dateRange.to }} onSelect={(r) => { if (r?.from && r?.to) onDateRangeChange({ from: r.from, to: r.to }); else if (r?.from) onDateRangeChange({ from: r.from, to: r.from }); }} numberOfMonths={1} locale={ruLocale} weekStartsOn={1} className="p-3 pointer-events-auto" />
            </PopoverContent>
          </Popover>
          {onShowComparisonChange && (
            <div className="flex items-center gap-1.5">
              <Switch checked={showComparison} onCheckedChange={onShowComparisonChange} className="scale-75" />
              <Label className="text-[11px] text-muted-foreground cursor-pointer" onClick={() => onShowComparisonChange?.(!showComparison)}>Сравнение</Label>
            </div>
          )}
          {showComparison && compRange && onCompRangeChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 px-2.5 border-dashed">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(compRange.from)} — {formatDate(compRange.to)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar mode="range" selected={{ from: compRange.from, to: compRange.to }} onSelect={(r) => { if (r?.from && r?.to) onCompRangeChange({ from: r.from, to: r.to }); else if (r?.from) onCompRangeChange({ from: r.from, to: r.from }); }} numberOfMonths={1} locale={ruLocale} weekStartsOn={1} className="p-3 pointer-events-auto" />
              </PopoverContent>
            </Popover>
          )}
          <ChannelFilter />
          <div className="w-px h-5 bg-border mx-1" />
          <Button size="sm" className="h-7 text-[11px] px-3" onClick={onApply}>Применить</Button>
          {onRefresh && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onRefresh}><RefreshCw className="h-3.5 w-3.5" /></Button>
              {lastUpdated && <span className="text-[10px] text-muted-foreground whitespace-nowrap">Обновлено: {lastUpdated}</span>}
            </>
          )}
        </div>
      )}
    </header>
  );
}
