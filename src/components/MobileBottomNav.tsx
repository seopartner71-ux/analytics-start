import { useTranslation } from "react-i18next";
import { LayoutDashboard, BarChart3, ListChecks } from "lucide-react";

interface MobileBottomNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
  notificationCount?: number;
}

export function MobileBottomNav({ activeTab, onTabChange, notificationCount = 0 }: MobileBottomNavProps) {
  const { t } = useTranslation();

  const items = [
    { id: "overview", icon: LayoutDashboard, label: t("mobileNav.overview") },
    { id: "analytics", icon: BarChart3, label: t("mobileNav.charts") },
    { id: "worklog", icon: ListChecks, label: t("mobileNav.tasks") },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-md md:hidden safe-area-bottom">
      <nav className="flex items-center justify-around h-14 max-w-lg mx-auto">
        {items.map((item) => {
          const active = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={`flex flex-col items-center justify-center flex-1 h-full gap-0.5 transition-colors relative ${
                active ? "text-primary" : "text-muted-foreground"
              }`}
            >
              <div className="relative">
                <item.icon className="h-5 w-5" />
                {item.id === "overview" && notificationCount > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 h-4 min-w-4 px-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold flex items-center justify-center">
                    {notificationCount}
                  </span>
                )}
              </div>
              <span className="text-[10px] font-medium">{item.label}</span>
              {active && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary" />
              )}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
