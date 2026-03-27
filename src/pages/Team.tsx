import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/AppSidebar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Globe, LogOut, Sun, Moon, Plus, Pencil, Trash2, User, Search, FolderKanban } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "@/contexts/ThemeContext";

interface TeamMember {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  role: string;
  owner_id: string;
}

const Team = () => {
  const { t, i18n } = useTranslation();
  const { signOut, user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formRole, setFormRole] = useState("seo");

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const { data: members = [], isLoading } = useQuery({
    queryKey: ["team_members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("team_members").select("*").order("full_name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects"],
    queryFn: async () => {
      const { data, error } = await supabase.from("projects").select("id, name, seo_specialist_id, account_manager_id");
      if (error) throw error;
      return data;
    },
  });

  const saveMember = useMutation({
    mutationFn: async () => {
      if (editingMember) {
        const { error } = await supabase.from("team_members").update({
          full_name: formName,
          email: formEmail || null,
          phone: formPhone || null,
          role: formRole,
        }).eq("id", editingMember.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("team_members").insert({
          full_name: formName,
          email: formEmail || null,
          phone: formPhone || null,
          role: formRole,
          owner_id: user!.id,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      toast.success(editingMember ? t("team.updated") : t("team.added"));
      closeDialog();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMember = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("team_members").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["team_members"] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      toast.success(t("team.deleted"));
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openCreate = () => {
    setEditingMember(null);
    setFormName("");
    setFormEmail("");
    setFormPhone("");
    setFormRole("seo");
    setDialogOpen(true);
  };

  const openEdit = (member: TeamMember) => {
    setEditingMember(member);
    setFormName(member.full_name);
    setFormEmail(member.email || "");
    setFormPhone(member.phone || "");
    setFormRole(member.role);
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setEditingMember(null);
  };

  const getLinkedProjects = (memberId: string) => {
    return projects.filter(
      (p) => p.seo_specialist_id === memberId || p.account_manager_id === memberId
    );
  };

  const seoMembers = members.filter((m) => m.role === "seo");
  const amMembers = members.filter((m) => m.role === "account_manager");

  return (
    <SidebarProvider>
      <div className="min-h-screen flex w-full">
        <AppSidebar />
        <div className="flex-1 flex flex-col">
          <header className="h-14 flex items-center justify-between border-b border-border/60 px-4 bg-card">
            <div className="flex items-center">
              <SidebarTrigger className="mr-4" />
              <span className="text-sm font-medium text-muted-foreground">StatPulse</span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="icon" onClick={toggleTheme} className="h-8 w-8">
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </Button>
              <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5 text-xs">
                <Globe className="h-3.5 w-3.5" />
                {i18n.language === "ru" ? "EN" : "RU"}
              </Button>
              <Button variant="ghost" size="sm" onClick={signOut} className="gap-1.5 text-xs text-muted-foreground">
                <LogOut className="h-3.5 w-3.5" />
                {t("auth.logout")}
              </Button>
            </div>
          </header>

          <main className="flex-1 p-6 lg:p-8">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold text-foreground">{t("team.title")}</h1>
                <p className="text-sm text-muted-foreground mt-1">{t("team.subtitle")}</p>
              </div>
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button onClick={openCreate} className="gap-1.5">
                    <Plus className="h-4 w-4" />
                    {t("team.addMember")}
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>
                      {editingMember ? t("team.editMember") : t("team.addMember")}
                    </DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4 pt-2">
                    <div className="space-y-2">
                      <Label>{t("team.nameLabel")}</Label>
                      <Input value={formName} onChange={(e) => setFormName(e.target.value)} placeholder={t("team.namePlaceholder")} />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("team.roleLabel")}</Label>
                      <Select value={formRole} onValueChange={setFormRole}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="seo">{t("team.roleSeo")}</SelectItem>
                          <SelectItem value="account_manager">{t("team.roleAm")}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Email</Label>
                      <Input type="email" value={formEmail} onChange={(e) => setFormEmail(e.target.value)} placeholder="email@example.com" />
                    </div>
                    <div className="space-y-2">
                      <Label>{t("team.phoneLabel")}</Label>
                      <Input value={formPhone} onChange={(e) => setFormPhone(e.target.value)} placeholder="+7 999 123-45-67" />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button variant="outline" onClick={closeDialog}>{t("common.cancel")}</Button>
                      <Button onClick={() => saveMember.mutate()} disabled={!formName.trim() || saveMember.isPending}>
                        {saveMember.isPending ? t("common.loading") : t("common.save")}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            {/* SEO Specialists */}
            {seoMembers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("team.roleSeo")}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {seoMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      linkedProjects={getLinkedProjects(member.id)}
                      onEdit={() => openEdit(member)}
                      onDelete={() => deleteMember.mutate(member.id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* Account Managers */}
            {amMembers.length > 0 && (
              <div className="mb-8">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                  {t("team.roleAm")}
                </h2>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {amMembers.map((member) => (
                    <MemberCard
                      key={member.id}
                      member={member}
                      linkedProjects={getLinkedProjects(member.id)}
                      onEdit={() => openEdit(member)}
                      onDelete={() => deleteMember.mutate(member.id)}
                      t={t}
                    />
                  ))}
                </div>
              </div>
            )}

            {members.length === 0 && !isLoading && (
              <div className="text-center py-16">
                <User className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
                <p className="text-muted-foreground">{t("team.noMembers")}</p>
              </div>
            )}
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
};

function MemberCard({
  member,
  linkedProjects,
  onEdit,
  onDelete,
  t,
}: {
  member: TeamMember;
  linkedProjects: { id: string; name: string }[];
  onEdit: () => void;
  onDelete: () => void;
  t: (key: string) => string;
}) {
  return (
    <Card className="border-border/60">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground">{member.full_name}</h3>
              <Badge variant="secondary" className="text-xs mt-0.5">
                {member.role === "seo" ? t("team.roleSeo") : t("team.roleAm")}
              </Badge>
            </div>
          </div>
          <div className="flex gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={onEdit}>
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={onDelete}>
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>

        {(member.email || member.phone) && (
          <div className="mt-3 space-y-1 text-xs text-muted-foreground">
            {member.email && <p>{member.email}</p>}
            {member.phone && <p>{member.phone}</p>}
          </div>
        )}

        {linkedProjects.length > 0 && (
          <div className="mt-3 pt-3 border-t border-border/60">
            <p className="text-xs text-muted-foreground mb-1.5 flex items-center gap-1">
              <FolderKanban className="h-3 w-3" />
              {t("team.linkedProjects")}
            </p>
            <div className="flex flex-wrap gap-1">
              {linkedProjects.map((p) => (
                <Badge key={p.id} variant="outline" className="text-xs">
                  {p.name}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default Team;
