import { ReactNode, useState, useCallback } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Globe, LogOut, Sun, Moon, RefreshCw, CalendarDays, ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
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
import { ru as ruLocale, enUS } from "date-fns/locale";
import { cn } from "@/lib/utils";
import { ChannelFilter } from "@/components/project/ChannelFilter";

interface PageHeaderProps {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
  /** Project-mode: show date picker and project selector */
  projectId?: string;
  /** Controlled date range */
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
  breadcrumbs,
  actions,
  projectId,
  dateRange,
  onDateRangeChange,
  compRange,
  onCompRangeChange,
  showComparison,
  onShowComparisonChange,
  onApply,
  onRefresh,
  lastUpdated,
  showDatePicker = false,
}: PageHeaderProps) {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const locale = i18n.language === "ru" ? ruLocale : enUS;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, logo_url").order("name");
      if (error) throw error;
      return data;
    },
    enabled: !!projectId,
  });

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const applyPreset = useCallback((type: "7d" | "30d" | "thisMonth" | "lastMonth") => {
    if (!onDateRangeChange) return;
    const today = new Date();
    switch (type) {
      case "7d":
        onDateRangeChange({ from: subDays(today, 7), to: today });
        break;
      case "30d":
        onDateRangeChange({ from: subDays(today, 30), to: today });
        break;
      case "thisMonth":
        onDateRangeChange({ from: startOfMonth(today), to: today });
        break;
      case "lastMonth": {
        const prev = subMonths(today, 1);
        onDateRangeChange({ from: startOfMonth(prev), to: endOfMonth(prev) });
        break;
      }
    }
  }, [onDateRangeChange]);

  const formatDate = (d: Date) => format(d, "dd.MM.yyyy");

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/95 backdrop-blur-sm">
      {/* Top row */}
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
            breadcrumbs || (
              <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
            )
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {actions}
          <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8 text-muted-foreground hover:text-foreground">
            {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8">
            <Globe className="h-3.5 w-3.5" />
            {i18n.language === "ru" ? "EN" : "RU"}
          </Button>
          <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs text-muted-foreground hover:text-foreground h-8">
            <LogOut className="h-3.5 w-3.5" />
            {t("auth.logout")}
          </Button>
        </div>
      </div>

      {/* Date controls row (project pages only) */}
      {showDatePicker && dateRange && onDateRangeChange && onApply && (
        <div className="h-11 flex items-center gap-2 px-4 border-t border-border/50 overflow-x-auto">
          {/* Presets */}
          <div className="flex items-center gap-1">
            {(["7d", "30d", "thisMonth", "lastMonth"] as const).map((p) => (
              <Button key={p} variant="ghost" size="sm" className="h-7 text-[11px] px-2 text-muted-foreground hover:text-foreground"
                onClick={() => applyPreset(p)}
              >
                {t(`datePresets.${p}`)}
              </Button>
            ))}
          </div>

          <div className="w-px h-5 bg-border mx-1" />

          {/* Period A picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 px-2.5">
                <CalendarDays className="h-3 w-3" />
                {formatDate(dateRange.from)} — {formatDate(dateRange.to)}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={{ from: dateRange.from, to: dateRange.to }}
                onSelect={(r) => {
                  if (r?.from && r?.to) onDateRangeChange({ from: r.from, to: r.to });
                  else if (r?.from) onDateRangeChange({ from: r.from, to: r.from });
                }}
                numberOfMonths={1}
                locale={locale}
                weekStartsOn={1}
                className="p-3 pointer-events-auto"
              />
            </PopoverContent>
          </Popover>

          {/* Comparison toggle */}
          {onShowComparisonChange && (
            <div className="flex items-center gap-1.5">
              <Switch
                checked={showComparison}
                onCheckedChange={onShowComparisonChange}
                className="scale-75"
              />
              <Label className="text-[11px] text-muted-foreground cursor-pointer" onClick={() => onShowComparisonChange?.(!showComparison)}>
                {t("comparison.enable")}
              </Label>
            </div>
          )}

          {/* Period B picker */}
          {showComparison && compRange && onCompRangeChange && (
            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 text-[11px] gap-1.5 px-2.5 border-dashed">
                  <CalendarDays className="h-3 w-3" />
                  {formatDate(compRange.from)} — {formatDate(compRange.to)}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="range"
                  selected={{ from: compRange.from, to: compRange.to }}
                  onSelect={(r) => {
                    if (r?.from && r?.to) onCompRangeChange({ from: r.from, to: r.to });
                    else if (r?.from) onCompRangeChange({ from: r.from, to: r.from });
                  }}
                  numberOfMonths={1}
                  locale={locale}
                  weekStartsOn={1}
                  className="p-3 pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
          )}

          {/* Channel filter */}
          <ChannelFilter />

          <div className="w-px h-5 bg-border mx-1" />

          {/* Apply */}
          <Button size="sm" className="h-7 text-[11px] px-3" onClick={onApply}>
            {t("datePicker.apply")}
          </Button>

          {/* Refresh */}
          {onRefresh && (
            <>
              <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground" onClick={onRefresh}>
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              {lastUpdated && (
                <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                  {t("portalNav.updated")}: {lastUpdated}
                </span>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
