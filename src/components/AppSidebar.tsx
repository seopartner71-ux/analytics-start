import {
  BarChart3, LayoutDashboard, TrendingUp, ListOrdered,
  Building2, FolderKanban, ClipboardList, FileText, Link2,
  Users, Plug, ChevronLeft, ChevronDown, Settings,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

// CRM Navigation
const crmNav = [
  { title: "Компании", url: "/companies", icon: Building2 },
  { title: "Проекты", url: "/crm-projects", icon: FolderKanban },
];

// Analytics (project-context)
const analyticsNav = [
  { title: "Обзор", tab: "overview", icon: LayoutDashboard },
  { title: "Трафик", tab: "searchSystems", icon: TrendingUp },
  { title: "Позиции", tab: "positions", icon: ListOrdered },
];

// SEO Management
const seoNav = [
  { title: "Задачи", url: "/tasks", icon: ClipboardList },
  { title: "Контент", url: "/content", icon: FileText },
  { title: "Ссылки", url: "/links", icon: Link2 },
];

// Team
const teamNav = [
  { title: "Сотрудники", url: "/employees", icon: Users },
  { title: "Интеграции", tab: "integrations", icon: Plug },
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
  const { user } = useAuth();
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

  const renderGroupLabel = (label: string) => {
    if (collapsed) return null;
    return (
      <SidebarGroupLabel className="text-[10px] uppercase tracking-wider text-sidebar-foreground/40 font-semibold px-3">
        {label}
      </SidebarGroupLabel>
    );
  };

  const renderNavLink = (item: { title: string; url: string; icon: React.ElementType }) => (
    <SidebarMenuItem key={item.url}>
      <SidebarMenuButton asChild>
        <NavLink to={item.url} end={item.url === "/"} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md" activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium">
          <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
          {!collapsed && <span className="text-[13px]">{item.title}</span>}
        </NavLink>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  const renderTabButton = (item: { title: string; tab: string; icon: React.ElementType }) => (
    <SidebarMenuItem key={item.tab}>
      <SidebarMenuButton
        onClick={() => onTabChange?.(item.tab)}
        className={cn(
          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md cursor-pointer",
          activeTab === item.tab && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
        )}
      >
        <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
        {!collapsed && <span className="text-[13px]">{item.title}</span>}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );

  return (
    <Sidebar collapsible="icon">
      <SidebarContent>
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-4 py-5 border-b border-sidebar-border">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary shrink-0">
            <BarChart3 className="h-4.5 w-4.5 text-sidebar-primary-foreground" />
          </div>
          {!collapsed && (
            <span className="text-[15px] font-semibold tracking-tight text-sidebar-accent-foreground">
              StatPulse
            </span>
          )}
        </div>

        {isProjectPage ? (
          <>
            {/* Back */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton onClick={() => navigate("/")} className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md cursor-pointer">
                      <ChevronLeft className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-[13px]">Все проекты</span>}
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Project identity */}
            {!collapsed && projectName && (
              <div className="px-4 py-3 border-b border-sidebar-border">
                <div className="flex items-center gap-2.5">
                  {projectLogo ? (
                    <img src={projectLogo} alt={projectName} className="h-7 w-7 rounded-md object-cover" />
                  ) : (
                    <div className="h-7 w-7 rounded-md bg-sidebar-primary/20 flex items-center justify-center text-[11px] font-bold text-sidebar-primary">
                      {projectName.slice(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-[13px] font-medium text-sidebar-accent-foreground truncate">{projectName}</span>
                </div>
              </div>
            )}

            {/* Analytics tabs */}
            <SidebarGroup>
              {renderGroupLabel("АНАЛИТИКА")}
              <SidebarGroupContent>
                <SidebarMenu>
                  {analyticsNav.map(renderTabButton)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Project management tabs */}
            <SidebarGroup>
              {renderGroupLabel("УПРАВЛЕНИЕ")}
              <SidebarGroupContent>
                <SidebarMenu>
                  {[
                    { title: "Задачи", tab: "worklog", icon: ClipboardList },
                    { title: "Конструктор отчётов", tab: "builder", icon: FileText },
                    { title: "Интеграции", tab: "integrations", icon: Plug },
                    { title: "Настройки", tab: "settings", icon: Settings },
                  ].map(renderTabButton)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          <>
            {/* CRM */}
            <SidebarGroup>
              {renderGroupLabel("CRM")}
              <SidebarGroupContent>
                <SidebarMenu>
                  {crmNav.map(renderNavLink)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Project selector */}
            {!collapsed && projects.length > 0 && (
              <div className="px-3 py-2">
                <Select onValueChange={(v) => navigate(`/project/${v}`)}>
                  <SelectTrigger className="w-full h-8 text-xs bg-sidebar-accent/50 border-sidebar-border text-sidebar-foreground">
                    <SelectValue placeholder="Выбрать проект..." />
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

            {/* Analytics overview link */}
            <SidebarGroup>
              {renderGroupLabel("АНАЛИТИКА")}
              <SidebarGroupContent>
                <SidebarMenu>
                  {renderNavLink({ title: "Обзор проектов", url: "/", icon: LayoutDashboard })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* SEO Management */}
            <SidebarGroup>
              {renderGroupLabel("SEO УПРАВЛЕНИЕ")}
              <SidebarGroupContent>
                <SidebarMenu>
                  {seoNav.map(renderNavLink)}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Team */}
            <SidebarGroup>
              {renderGroupLabel("УПРАВЛЕНИЕ КОМАНДОЙ")}
              <SidebarGroupContent>
                <SidebarMenu>
                  {teamNav.filter(i => i.url).map(i => renderNavLink(i as any))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        )}
      </SidebarContent>

      {/* Footer */}
      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-sidebar-muted flex items-center justify-center text-xs font-medium text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
