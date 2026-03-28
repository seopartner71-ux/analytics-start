import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Copy, Pencil, Upload, X, User, Link2, Calendar, Plug } from "lucide-react";
import { toast } from "sonner";
import { IntegrationsTab } from "@/components/project/IntegrationsTab";
import { WorkLogTab } from "@/components/project/WorkLogTab";
import { GoalsTab } from "@/components/project/GoalsTab";
import { SeoTab } from "@/components/project/SeoTab";
import { TrafficTab } from "@/components/project/TrafficTab";
import { SearchSystemsTab } from "@/components/project/SearchSystemsTab";
import { PagesTab } from "@/components/project/PagesTab";
import { SiteHealthTab } from "@/components/project/SiteHealthTab";
import { AiInsightsBlock } from "@/components/project/AiInsightsBlock";
import { AiAnalyticsTab } from "@/components/project/AiAnalyticsTab";
import { ReportBuilderTab } from "@/components/project/ReportBuilderTab";
import { DashboardTab } from "@/components/project/DashboardTab";
import { MobileBottomNav } from "@/components/MobileBottomNav";
import { supabase } from "@/integrations/supabase/client";
import { DateRangeProvider, useDateRange } from "@/contexts/DateRangeContext";
import { format } from "date-fns";

/** Inner component that can use DateRange context */
function ProjectDetailInner() {
  const { id } = useParams<{ id: string }>();
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");

  const {
    range, setRange, compRange, setCompRange,
    showComparison, setShowComparison, apply,
  } = useDateRange();

  const { data: project, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: integrations = [] } = useQuery({
    queryKey: ["integrations", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("integrations").select("*").eq("project_id", id!);
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: latestMetrikaStats } = useQuery({
    queryKey: ["metrika-stats-latest", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("metrika_stats").select("traffic_sources, fetched_at")
        .eq("project_id", id!).order("fetched_at", { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: workLogs = [] } = useQuery({
    queryKey: ["work_logs", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("work_logs").select("*").eq("project_id", id!).order("task_date", { ascending: false }).order("sort_order");
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").order("full_name");
      if (error) throw error;
      return data;
    },
  });

  const { data: cachedReport } = useQuery({
    queryKey: ["cached_report", id],
    queryFn: async () => {
      const now = new Date();
      const { data, error } = await supabase
        .from("cached_reports").select("*")
        .eq("project_id", id!)
        .eq("report_year", now.getFullYear())
        .eq("report_month", now.getMonth())
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  const [editName, setEditName] = useState("");
  const [editUrl, setEditUrl] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editSeoSpecialistId, setEditSeoSpecialistId] = useState("");
  const [editAccountManagerId, setEditAccountManagerId] = useState("");
  const [editClientEmail, setEditClientEmail] = useState("");
  const [editShareExpiry, setEditShareExpiry] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    if (project && !initialized) {
      setEditName(project.name);
      setEditUrl(project.url || "");
      setEditDescription(project.description || "");
      setEditSeoSpecialistId((project as any).seo_specialist_id || "");
      setEditAccountManagerId((project as any).account_manager_id || "");
      setEditClientEmail(project.client_email || "");
      setEditShareExpiry((project as any).share_link_expires_at ? new Date((project as any).share_link_expires_at).toISOString().slice(0, 10) : "");
      setLogoPreview(project.logo_url || null);
      setInitialized(true);
    }
  }, [project, initialized]);

  const updateProject = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("projects").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", id] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("project.settingsTab.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const saveAiSummary = useMutation({
    mutationFn: async (summary: any) => {
      const now = new Date();
      const existing = cachedReport;
      if (existing) {
        const merged = { ...(typeof existing.report_data === 'object' && existing.report_data ? existing.report_data : {}), ai_summary: summary };
        const { error } = await supabase.from("cached_reports").update({ report_data: merged as any }).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cached_reports").insert({
          project_id: id!,
          report_year: now.getFullYear(),
          report_month: now.getMonth(),
          report_data: { ai_summary: summary } as any,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cached_report", id] });
      toast.success(t("aiInsights.saved"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error(t("project.settingsTab.logoError")); return; }
    setUploading(true);
    const ext = file.name.split(".").pop();
    const filePath = `${id}/${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from("project-logos").upload(filePath, file, { upsert: true });
    if (uploadError) { toast.error(uploadError.message); setUploading(false); return; }
    const { data: publicUrl } = supabase.storage.from("project-logos").getPublicUrl(filePath);
    setLogoPreview(publicUrl.publicUrl);
    await supabase.from("projects").update({ logo_url: publicUrl.publicUrl }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
    toast.success(t("project.settingsTab.logoUploaded"));
    setUploading(false);
  };

  const handleRemoveLogo = async () => {
    setLogoPreview(null);
    await supabase.from("projects").update({ logo_url: null }).eq("id", id!);
    queryClient.invalidateQueries({ queryKey: ["project", id] });
  };

  const handleSaveSettings = () => {
    const seoMember = teamMembers.find(m => m.id === editSeoSpecialistId);
    const amMember = teamMembers.find(m => m.id === editAccountManagerId);
    updateProject.mutate({
      name: editName, url: editUrl, description: editDescription,
      seo_specialist: seoMember?.full_name || null,
      account_manager: amMember?.full_name || null,
      seo_specialist_id: editSeoSpecialistId || null,
      account_manager_id: editAccountManagerId || null,
      client_email: editClientEmail,
      share_link_expires_at: editShareExpiry ? new Date(editShareExpiry).toISOString() : null,
    });
  };

  const handleCopyShareLink = () => {
    if (project?.share_token) {
      navigator.clipboard.writeText(`${window.location.origin}/share/${project.share_token}`);
      toast.success(t("project.analytics.linkCopied"));
    }
  };

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ["metrika-stats-latest", id] });
    queryClient.invalidateQueries({ queryKey: ["work_logs", id] });
    queryClient.invalidateQueries({ queryKey: ["integrations", id] });
    toast.success(t("integrations.synced"));
  }, [queryClient, id, t]);

  const aiSummary = cachedReport?.report_data && typeof cachedReport.report_data === 'object' && 'ai_summary' in (cachedReport.report_data as any)
    ? (cachedReport.report_data as any).ai_summary
    : undefined;

  const lastUpdated = latestMetrikaStats?.fetched_at
    ? format(new Date(latestMetrikaStats.fetched_at), "dd.MM HH:mm")
    : null;

  if (isLoading || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const renderContent = () => {
    switch (activeTab) {
      case "overview":
        return (
          <div className="space-y-6">
            <AiInsightsBlock
              projectId={id}
              summary={aiSummary}
              isAdmin={true}
              onSave={(summary) => saveAiSummary.mutate(summary)}
              trafficSources={(latestMetrikaStats?.traffic_sources as any[]) || []}
            />
            <DashboardTab projectId={project.id} projectName={project.name} onSwitchTab={setActiveTab} />
          </div>
        );
      case "searchSystems":
        return <TrafficTab projectId={project.id} projectName={project.name} projectUrl={project.url || undefined} />;
      case "goals":
        return <GoalsTab projectId={project.id} projectName={project.name} />;
      case "seo":
        return <SeoTab projectId={project.id} />;
      case "pages":
        return <SiteHealthTab projectId={project.id} />;
      case "worklog":
        return <WorkLogTab projectId={project.id} tasks={workLogs} isAdmin={true} />;
      case "ai":
        return (
          <AiAnalyticsTab
            projectId={project.id}
            projectName={project.name}
            summary={aiSummary}
            isAdmin={true}
            onSaveSummary={(summary) => saveAiSummary.mutate(summary)}
            trafficSources={(latestMetrikaStats?.traffic_sources as any[]) || []}
          />
        );
      case "builder":
        return <ReportBuilderTab projectId={project.id} shareToken={project.share_token} />;
      case "integrations":
        return <IntegrationsTab projectId={project.id} integrations={integrations} />;
      case "settings":
        return (
          <div className="max-w-lg space-y-8">
            <h2 className="text-lg font-semibold text-foreground">{t("project.settingsTab.title")}</h2>
            {/* Logo */}
            <div className="space-y-3">
              <Label>{t("project.settingsTab.logoLabel")}</Label>
              <div className="flex items-center gap-4">
                {logoPreview ? (
                  <div className="relative">
                    <img src={logoPreview} alt="Logo" className="h-20 w-20 rounded-xl object-cover border border-border" />
                    <button onClick={handleRemoveLogo} className="absolute -top-2 -right-2 h-5 w-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center">
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div onClick={() => fileInputRef.current?.click()} className="h-20 w-20 rounded-xl border-2 border-dashed border-muted-foreground/25 flex items-center justify-center cursor-pointer hover:border-primary/40 transition-colors">
                    <Upload className="h-6 w-6 text-muted-foreground/50" />
                  </div>
                )}
                <div>
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                    {uploading ? t("common.loading") : t("project.settingsTab.uploadLogo")}
                  </Button>
                  <p className="text-xs text-muted-foreground mt-1">{t("project.settingsTab.logoHint")}</p>
                </div>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
            </div>
            {/* Basic info */}
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>{t("project.settingsTab.nameLabel")}</Label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>{t("project.settingsTab.urlLabel")}</Label>
                <Input value={editUrl} onChange={(e) => setEditUrl(e.target.value)} placeholder="https://example.com" />
              </div>
              <div className="space-y-2">
                <Label>{t("project.settingsTab.descriptionLabel")}</Label>
                <Textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={3} />
              </div>
            </div>
            {/* Team */}
            <div className="border-t border-border pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <User className="h-4 w-4" />
                {t("project.settingsTab.teamTitle")}
              </h3>
              <div className="space-y-2">
                <Label>{t("project.settingsTab.seoSpecialist")}</Label>
                <Select value={editSeoSpecialistId} onValueChange={setEditSeoSpecialistId}>
                  <SelectTrigger><SelectValue placeholder={t("team.selectSeo")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("team.notAssigned")}</SelectItem>
                    {teamMembers.filter(m => m.role === "seo").map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("project.settingsTab.accountManager")}</Label>
                <Select value={editAccountManagerId} onValueChange={setEditAccountManagerId}>
                  <SelectTrigger><SelectValue placeholder={t("team.selectAm")} /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">{t("team.notAssigned")}</SelectItem>
                    {teamMembers.filter(m => m.role === "account_manager").map(m => (
                      <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>{t("project.settingsTab.clientEmail")}</Label>
                <Input type="email" value={editClientEmail} onChange={(e) => setEditClientEmail(e.target.value)} placeholder="client@company.com" />
              </div>
            </div>
            <Button onClick={handleSaveSettings} disabled={updateProject.isPending}>
              {updateProject.isPending ? t("common.loading") : t("project.settingsTab.save")}
            </Button>
            {/* Share link */}
            <div className="border-t border-border pt-6 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Link2 className="h-4 w-4" />
                {t("project.shareLink")}
              </h3>
              <div className="flex gap-2">
                <Input readOnly value={project.share_token ? `${window.location.origin}/share/${project.share_token}` : ""} className="text-xs" />
                <Button variant="outline" size="icon" onClick={handleCopyShareLink}><Copy className="h-4 w-4" /></Button>
              </div>
              <div className="space-y-2">
                <Label className="flex items-center gap-1.5 text-xs">
                  <Calendar className="h-3.5 w-3.5" />
                  {t("project.shareLinkExpiry")}
                </Label>
                <Input type="date" value={editShareExpiry} onChange={(e) => setEditShareExpiry(e.target.value)} className="max-w-[200px] h-8 text-xs" min={new Date().toISOString().slice(0, 10)} />
                <p className="text-[11px] text-muted-foreground">{t("project.shareLinkExpiryHint")}</p>
              </div>
            </div>
            {/* Integrations inside settings */}
            <div className="border-t border-border pt-6">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
                <Plug className="h-4 w-4" />
                {t("project.tabs.integrations")}
              </h3>
              <IntegrationsTab projectId={project.id} integrations={integrations} />
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar
          activeTab={activeTab}
          onTabChange={setActiveTab}
          projectName={project.name}
          projectLogo={project.logo_url}
        />
        <div className="flex-1 flex flex-col">
          <PageHeader
            projectId={id}
            showDatePicker={!["settings", "integrations"].includes(activeTab)}
            dateRange={range}
            onDateRangeChange={setRange}
            compRange={compRange}
            onCompRangeChange={setCompRange}
            showComparison={showComparison}
            onShowComparisonChange={setShowComparison}
            onApply={apply}
            onRefresh={handleRefresh}
            lastUpdated={lastUpdated}
          />
          <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-20 md:pb-8">
            {renderContent()}
          </main>
        </div>
        <MobileBottomNav activeTab={activeTab} onTabChange={setActiveTab} />
      </div>
    </SidebarProvider>
  );
}

const ProjectDetail = () => (
  <DateRangeProvider>
    <ProjectDetailInner />
  </DateRangeProvider>
);

export default ProjectDetail;
