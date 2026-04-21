import {
  BarChart3, LayoutDashboard, FolderKanban, ClipboardList,
  Building2, CalendarDays, Users, ChevronLeft, Settings, Plug,
  TrendingUp, ListOrdered, FileText, Link2, MessageSquare, Wallet, UserCheck, Briefcase, Clock, Activity, Trophy, Scale, Rocket, BookOpen, Shield, History,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const allNav = [
  { title: "Дашборд", url: "/", icon: LayoutDashboard, minRole: "viewer" as const },
  { title: "Дашборд директора", url: "/director", icon: Briefcase, minRole: "admin" as const },
  { title: "Проекты", url: "/crm-projects", icon: FolderKanban, minRole: "viewer" as const },
  { title: "Онбординг", url: "/onboarding", icon: Rocket, minRole: "admin" as const },
  { title: "Задачи", url: "/tasks", icon: ClipboardList, minRole: "manager" as const },
  { title: "Мои задачи", url: "/my-tasks", icon: UserCheck, minRole: "viewer" as const },
  { title: "Тайм-трекинг", url: "/time-tracking", icon: Clock, minRole: "viewer" as const },
  { title: "Загрузка команды", url: "/workload", icon: Activity, minRole: "manager" as const },
  { title: "KPI сотрудников", url: "/kpi", icon: Trophy, minRole: "manager" as const },
  { title: "План-факт", url: "/plan-fact", icon: Scale, minRole: "manager" as const },
  { title: "Клиенты", url: "/companies", icon: Building2, minRole: "admin" as const },
  { title: "Календарь", url: "/content", icon: CalendarDays, minRole: "manager" as const },
  { title: "Сотрудники", url: "/employees", icon: Users, minRole: "manager" as const, managerPlus: true },
  { title: "Отчёты", url: "/reports", icon: FileText, minRole: "manager" as const },
  { title: "База знаний", url: "/knowledge", icon: BookOpen, minRole: "viewer" as const },
  { title: "📚 Книги для AI", url: "/knowledge-books", icon: BookOpen, minRole: "admin" as const },
  { title: "Чат", url: "/chat", icon: MessageSquare, minRole: "viewer" as const },
  { title: "Финансы", url: "/finance", icon: Wallet, minRole: "viewer" as const, requireFinance: true },
  { title: "Интеграции", url: "/admin?tab=keys", icon: Plug, minRole: "admin" as const },
  { title: "Журнал удалений", url: "/admin/deletion-log", icon: History, minRole: "manager" as const, managerPlus: true },
];

const analyticsNav = [
  { title: "Обзор", tab: "overview", icon: LayoutDashboard },
  { title: "Трафик", tab: "searchSystems", icon: TrendingUp },
  { title: "Позиции", tab: "positions", icon: ListOrdered },
];

interface AppSidebarProps {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  projectName?: string;
  projectLogo?: string | null;
}

export function AppSidebar({ activeTab, onTabChange, projectName, projectLogo }: AppSidebarProps) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const { user, role, isAdmin, isManager, hasFinanceAccess } = useAuth();
  const ROLE_LEVELS = { viewer: 0, junior: 0, seo: 1, manager: 1, director: 2, admin: 2 } as const;
  const userLevel = ROLE_LEVELS[role as keyof typeof ROLE_LEVELS] ?? 0;
  const isDirector = role === "director";
  const mainNav = allNav.filter(item => {
    if (userLevel < ROLE_LEVELS[item.minRole]) return false;
    if ((item as any).requireFinance && !hasFinanceAccess) return false;
    if ((item as any).adminOnly && !isAdmin) return false;
    if ((item as any).managerPlus && !(isAdmin || isDirector)) return false;
    return true;
  });
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();

  const isProjectPage = !!projectId && !!onTabChange;

  const { data: projects = [] } = useQuery({
    queryKey: ["projects-sidebar"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, logo_url").order("name");
      if (error) throw error;
      return data;
    },
  });

  // Unread chat messages for current project
  const { data: chatUnread = 0 } = useQuery({
    queryKey: ["project-chat-unread", projectId, user?.id],
    enabled: !!projectId && !!user?.id,
    refetchInterval: 30000,
    queryFn: async () => {
      const { data: read } = await supabase
        .from("project_message_reads")
        .select("last_read_at")
        .eq("project_id", projectId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      const since = read?.last_read_at || "1970-01-01";
      const { count } = await supabase
        .from("project_messages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId!)
        .gt("created_at", since)
        .neq("user_id", user!.id);
      return count || 0;
    },
  });

  const isActive = (url: string) => {
    if (url === "/") return location.pathname === "/";
    return location.pathname.startsWith(url);
  };

  const renderNavItem = (item: { title: string; url: string; icon: React.ElementType }) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild className="p-0">
        <NavLink
          to={item.url}
          end={item.url === "/"}
          className={cn(
            "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-none transition-colors",
            "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          )}
          activeClassName="bg-primary/[0.08] text-primary font-medium border-l-[3px] border-primary"
        >
          <item.icon className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderTabButton = (item: { title: string; tab: string; icon: React.ElementType; badge?: number }) => (
    <SidebarMenuItem key={item.tab}>
      <SidebarMenuButton
        onClick={() => onTabChange?.(item.tab)}
        className={cn(
          "flex items-center gap-2.5 px-3 py-2 text-[13px] rounded-none transition-colors cursor-pointer",
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
          activeTab === item.tab && "bg-primary/[0.08] text-primary font-medium border-l-[3px] border-primary"
        )}
      >
        <item.icon className="h-4 w-4 shrink-0" />
        {!collapsed && <span className="flex-1">{item.title}</span>}
        {!collapsed && item.badge && item.badge > 0 ? (
          <span className="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-semibold">
            {item.badge > 99 ? "99+" : item.badge}
          </span>
        ) : null}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon" className="border-r-0" style={{ width: collapsed ? undefined : '220px' }}>
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-4 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary shrink-0">
            <BarChart3 className="h-4 w-4 text-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">
              StatPulse
            </span>
          )}
        </div>

        {isProjectPage ? (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/")} className="flex items-center gap-2.5 px-3 py-2 text-[13px] text-sidebar-foreground hover:bg-sidebar-accent cursor-pointer rounded-none">
                      <ChevronLeft className="h-4 w-4 shrink-0" />
                      {!collapsed && <span>Все проекты</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {!collapsed && projectName && (
              <div className="px-4 py-3 border-b border-sidebar-border">
                <div className="flex items-center gap-2.5">
                  {projectLogo ? (
                    <img src={projectLogo} alt={projectName} className="h-7 w-7 rounded object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded bg-primary/20 flex items-center justify-center text-[11px] font-bold text-primary">
                      {projectName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[13px] font-medium text-sidebar-accent-foreground truncate">{projectName}</span>
                </div>
              </div>
            )}

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {analyticsNav.map(renderTabButton)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { title: "Задачи", tab: "worklog", icon: ClipboardList },
                    { title: "Чат", tab: "chat", icon: MessageSquare, badge: chatUnread },
                    { title: "Ссылочный профиль", tab: "links", icon: Link2 },
                    { title: "Отчёты", tab: "builder", icon: FileText },
                    { title: "Интеграции", tab: "integrations", icon: Plug },
                    { title: "Настройки", tab: "settings", icon: Settings },
                  ].map(renderTabButton)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  {mainNav.map(renderNavItem)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {!collapsed && projects.length > 0 && (
              <div className="px-3 py-2 border-t border-sidebar-border">
                <Select onValueChange={(v) => navigate(`/crm-projects/${v}?tab=analytics`)}>
                  <SelectTrigger className="w-full h-8 text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Аналитика проекта..." />
                  </SelectTrigger>
                  <SelectContent>
                    {projects.map(p => (
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
              </div>
            )}
          </>
        )}
      </SidebarContent>

      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-3">
          <div
            className="flex items-center gap-2.5 cursor-pointer hover:bg-sidebar-accent/50 rounded-lg p-1.5 -m-1.5 transition-colors"
            onClick={() => navigate("/profile")}
          >
            <div className="h-8 w-8 rounded-full bg-sidebar-muted flex items-center justify-center text-xs font-medium text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
              <p className="text-[10px] text-sidebar-foreground/50">Мой профиль</p>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
