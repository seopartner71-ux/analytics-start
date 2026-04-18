import { ReactNode, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { LogOut, Sun, Moon, Search, RefreshCw, CalendarDays } from "lucide-react";
import { NotificationBell } from "@/components/NotificationBell";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";
import { useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { format, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru as ruLocale } from "date-fns/locale";
import { ChannelFilter } from "@/components/project/ChannelFilter";

const PAGE_TITLES: Record<string, string> = {
  "/": "Дашборд",
  "/companies": "Клиенты",
  "/crm-projects": "SEO Проекты",
  "/tasks": "Задачи",
  "/my-tasks": "Мои задачи",
  "/director": "Дашборд директора",
  "/employees": "Сотрудники",
  "/content": "Календарь",
  "/links": "Ссылки",
  "/team": "Команда",
  "/admin": "Администрирование",
};

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
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const pageTitle = PAGE_TITLES[location.pathname] || breadcrumbs || "StatPulse";

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

  const initials = user?.email ? user.email.slice(0, 2).toUpperCase() : "U";

  return (
    <header className="sticky top-0 z-30 bg-card border-b border-border">
      {/* Main header row - 56px */}
      <div className="h-14 flex items-center justify-between px-4 gap-4">
        {/* Left: trigger + title */}
        <div className="flex items-center gap-3 min-w-0">
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
            <h1 className="text-sm font-semibold text-foreground truncate">{pageTitle}</h1>
          )}
        </div>

        {/* Center: search */}
        <div className="hidden md:flex flex-1 max-w-md">
          <div className="relative w-full">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Поиск..."
              className="pl-9 h-8 text-[13px] bg-muted/50 border-border"
            />
          </div>
        </div>

        {/* Right: actions */}
        <div className="flex items-center gap-1">
          {actions}
          <NotificationBell />
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8">
            <LogOut className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Выход</span>
          </Button>
          <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center text-[11px] font-semibold text-primary-foreground ml-1 cursor-default">
            {initials}
          </div>
        </div>
      </div>

      {/* Date picker row */}
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
