import {
  FolderKanban, Users, Shield, BarChart3, LayoutDashboard,
  TrendingUp, Target, KeyRound, FileSearch, ClipboardList,
  Sparkles, GitCompare, Settings, Plug, FileText, ChevronLeft,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useQuery } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { useParams, useNavigate } from "react-router-dom";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";

const mainNav = [
  { titleKey: "nav.projects", url: "/", icon: FolderKanban },
  { titleKey: "nav.team", url: "/team", icon: Users },
];

interface ProjectSection {
  titleKey: string;
  tab: string;
  icon: React.ElementType;
}

const projectSections: ProjectSection[] = [
  { titleKey: "portalNav.overview", tab: "overview", icon: LayoutDashboard },
  { titleKey: "portalNav.traffic", tab: "searchSystems", icon: TrendingUp },
  { titleKey: "portalNav.conversions", tab: "goals", icon: Target },
  { titleKey: "portalNav.keywords", tab: "seo", icon: KeyRound },
  { titleKey: "portalNav.indexing", tab: "pages", icon: FileSearch },
  { titleKey: "portalNav.workLog", tab: "worklog", icon: ClipboardList },
  { titleKey: "portalNav.aiAnalytics", tab: "ai", icon: Sparkles },
  { titleKey: "portalNav.comparison", tab: "builder", icon: FileText },
];

const projectUtilSections: ProjectSection[] = [
  { titleKey: "portalNav.integrations", tab: "integrations", icon: Plug },
  { titleKey: "portalNav.settings", tab: "settings", icon: Settings },
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
  const { t } = useTranslation();
  const { user } = useAuth();
  const { id: projectId } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const isProjectPage = !!projectId && !!onTabChange;

  const { data: isAdmin } = useQuery({
    queryKey: ["user-role", user?.id],
    queryFn: async () => {
      const { data } = await supabase.rpc("has_role", { _user_id: user!.id, _role: "admin" });
      return data === true;
    },
    enabled: !!user,
  });

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
            {/* Back to projects */}
            <SidebarGroup>
              <SidebarGroupContent>
                <SidebarMenu>
                  <SidebarMenuItem>
                    <SidebarMenuButton
                      onClick={() => navigate("/")}
                      className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md cursor-pointer"
                    >
                      <ChevronLeft className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span className="text-[13px]">{t("nav.projects")}</span>}
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

            {/* Project analytics nav */}
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-medium px-3">
                  {t("portalNav.analytics")}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectSections.map((item) => (
                    <SidebarMenuItem key={item.tab}>
                      <SidebarMenuButton
                        onClick={() => onTabChange(item.tab)}
                        className={cn(
                          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md cursor-pointer",
                          activeTab === item.tab && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                      >
                        <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-[13px]">{t(item.titleKey)}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>

            {/* Project utils */}
            <SidebarGroup>
              {!collapsed && (
                <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-medium px-3">
                  {t("portalNav.manage")}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu>
                  {projectUtilSections.map((item) => (
                    <SidebarMenuItem key={item.tab}>
                      <SidebarMenuButton
                        onClick={() => onTabChange(item.tab)}
                        className={cn(
                          "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md cursor-pointer",
                          activeTab === item.tab && "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                        )}
                      >
                        <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-[13px]">{t(item.titleKey)}</span>}
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </>
        ) : (
          /* Main Navigation (non-project pages) */
          <SidebarGroup>
            {!collapsed && (
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-sidebar-foreground/50 font-medium px-3">
                {t("nav.projects")}
              </SidebarGroupLabel>
            )}
            <SidebarGroupContent>
              <SidebarMenu>
                {mainNav.map((item) => (
                  <SidebarMenuItem key={item.titleKey}>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to={item.url}
                        end={item.url === "/"}
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <item.icon className="mr-2.5 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-[13px]">{t(item.titleKey)}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
                {isAdmin && (
                  <SidebarMenuItem>
                    <SidebarMenuButton asChild>
                      <NavLink
                        to="/admin"
                        className="text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors rounded-md"
                        activeClassName="bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                      >
                        <Shield className="mr-2.5 h-4 w-4 shrink-0" />
                        {!collapsed && <span className="text-[13px]">{t("nav.admin")}</span>}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}
      </SidebarContent>

      {/* Footer with user info */}
      {!collapsed && (
        <SidebarFooter className="border-t border-sidebar-border p-4">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-full bg-sidebar-muted flex items-center justify-center text-xs font-medium text-sidebar-foreground">
              {user?.email?.charAt(0).toUpperCase() || "U"}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[12px] font-medium text-sidebar-accent-foreground truncate">
                {user?.email}
              </p>
            </div>
          </div>
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
