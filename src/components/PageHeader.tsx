import { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Globe, LogOut, Sun, Moon } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface PageHeaderProps {
  breadcrumbs?: ReactNode;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumbs, actions }: PageHeaderProps) {
  const { t, i18n } = useTranslation();
  const { signOut } = useAuth();
  const { theme, toggleTheme } = useTheme();

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  return (
    <header className="sticky top-0 z-30 h-14 flex items-center justify-between border-b border-border bg-card/95 backdrop-blur-sm px-4">
      <div className="flex items-center gap-3">
        <SidebarTrigger className="text-muted-foreground" />
        {breadcrumbs || (
          <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
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
    </header>
  );
}
