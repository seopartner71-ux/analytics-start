import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  User, Mail, Briefcase, Building2, Globe, Phone, Edit3, Save,
  X, Camera, ThumbsUp, Gift, Trophy, Crown, Star, Heart,
  Award, Smile, Flag, Hash, Bookmark, Target, Zap,
  Smartphone, Monitor, Loader2, Lock, Eye, EyeOff,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const BADGE_ICONS = [
  ThumbsUp, Gift, Trophy, Crown, Star, Heart, Award, Smile,
  Flag, Bookmark, Hash, Target, Zap, Globe, Briefcase, Building2,
];

function getAvatarUrl(name: string, size = 200) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://i.pravatar.cc/${size}?u=${hash}`;
}

export default function ProfilePage() {
  const { user, profile, isAdmin, role, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");
  const [bio, setBio] = useState("");
  const [phone, setPhone] = useState("");
  const [patronymic, setPatronymic] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [newInterest, setNewInterest] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setAgencyName(profile.agency_name || "");
    }
  }, [profile]);

  // Task stats for efficiency
  const { data: taskStats } = useQuery({
    queryKey: ["profile-task-stats", user?.id],
    queryFn: async () => {
      const { data: tasks } = await supabase
        .from("crm_tasks")
        .select("stage")
        .eq("owner_id", user!.id);
      if (!tasks) return { total: 0, completed: 0, pct: 0 };
      const total = tasks.length;
      const completed = tasks.filter(t => t.stage === "Завершена").length;
      return { total, completed, pct: total > 0 ? Math.round((completed / total) * 100) : 0 };
    },
    enabled: !!user,
  });

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: fullName,
          agency_name: agencyName,
        })
        .eq("user_id", user!.id);
      if (error) throw error;
    },
    onSuccess: async () => {
      await refreshProfile();
      setEditing(false);
      toast.success("Профиль сохранён");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const roleLabel = role === "admin" ? "Администратор" : role === "manager" ? "Менеджер" : "Наблюдатель";
  const efficiency = taskStats?.pct ?? 0;

  const profileTabs = [
    { key: "profile", label: "Профиль" },
    { key: "security", label: "Безопасность" },
    { key: "tasks", label: "Задачи" },
    { key: "calendar", label: "Календарь" },
    { key: "feed", label: "Лента" },
    { key: "efficiency", label: `Эффективность`, badge: `${efficiency}%` },
  ];

  return (
    <div className="space-y-0">
      {/* Profile Header */}
      <div className="relative overflow-hidden rounded-t-xl mb-0">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 via-primary/10 to-primary/5" />
        <div className="relative px-6 py-5 flex items-center justify-between">
          <h1 className="text-xl font-bold text-foreground">{fullName || "Мой профиль"}</h1>
          <div className="flex items-center gap-2">
            {!editing ? (
              <Button size="sm" variant="outline" className="h-8 text-[13px] gap-1.5" onClick={() => setEditing(true)}>
                <Edit3 className="h-3.5 w-3.5" /> Редактировать
              </Button>
            ) : (
              <>
                <Button size="sm" className="h-8 text-[13px] gap-1.5" onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
                  {saveProfile.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />} Сохранить
                </Button>
                <Button size="sm" variant="ghost" className="h-8 text-[13px] gap-1.5" onClick={() => setEditing(false)}>
                  <X className="h-3.5 w-3.5" /> Отмена
                </Button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Profile Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <div className="border-b border-border bg-card/50 px-6">
          <TabsList className="h-auto bg-transparent p-0 gap-0">
            {profileTabs.map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={cn(
                  "rounded-none border-b-2 border-transparent px-4 py-3 text-[13px] font-medium transition-colors",
                  "data-[state=active]:border-primary data-[state=active]:text-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none",
                  "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab.label}
                {tab.badge && (
                  <Badge variant="secondary" className="ml-1.5 h-5 text-[10px] px-1.5 bg-primary/10 text-primary border-0">
                    {tab.badge}
                  </Badge>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="profile" className="mt-0 p-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT COLUMN */}
            <div className="space-y-5">
              {/* Identity Card */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-4">
                    <img
                      src={getAvatarUrl(fullName || "User", 200)}
                      alt={fullName}
                      className="h-32 w-32 rounded-full object-cover ring-4 ring-primary/20 shadow-lg"
                    />
                    <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-green-500 border-[3px] border-card" title="В сети" />
                    {editing && (
                      <button className="absolute bottom-0 left-0 h-8 w-8 rounded-full bg-card/90 border border-border flex items-center justify-center hover:bg-muted transition-colors">
                        <Camera className="h-4 w-4 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                  <span className="text-xs text-green-500 font-medium mb-2">● В сети</span>
                  <h2 className="text-lg font-bold text-foreground text-center">{fullName || "Имя не указано"}</h2>
                  <span className="text-sm text-muted-foreground">{roleLabel}</span>

                  {/* Download apps */}
                  <div className="mt-5 pt-4 border-t border-border/40 w-full">
                    <div className="flex items-center justify-center gap-6 text-muted-foreground">
                      <div className="flex flex-col items-center gap-1.5">
                        <Smartphone className="h-5 w-5" />
                        <span className="text-[10px]">Для телефона</span>
                      </div>
                      <div className="flex flex-col items-center gap-1.5">
                        <Monitor className="h-5 w-5" />
                        <span className="text-[10px]">Для компьютера</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Badges / Gratitude */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Благодарности</h3>
                  <div className="grid grid-cols-4 gap-3">
                    {BADGE_ICONS.map((Icon, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-center h-11 w-11 mx-auto rounded-full bg-muted/40 border border-border/40 text-muted-foreground/60 hover:text-primary hover:border-primary/30 hover:bg-primary/5 transition-all cursor-pointer"
                      >
                        <Icon className="h-5 w-5" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* RIGHT COLUMN */}
            <div className="lg:col-span-2 space-y-5">
              {/* Contact Information */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-5">Контактная информация</h3>
                  <div className="space-y-0 divide-y divide-border/30">
                    <ProfileField
                      label="Имя"
                      value={firstName}
                      editing={editing}
                      onChange={(v) => setFullName(v + (lastName ? ` ${lastName}` : ""))}
                    />
                    <ProfileField
                      label="Фамилия"
                      value={lastName}
                      editing={editing}
                      onChange={(v) => setFullName(firstName + (v ? ` ${v}` : ""))}
                    />
                    <ProfileField label="Почта" value={email} editing={false} icon={<Mail className="h-4 w-4" />} />
                    <ProfileField label="Должность" value={roleLabel} editing={false} icon={<Briefcase className="h-4 w-4" />} />
                    <ProfileField
                      label="Компания"
                      value={agencyName}
                      editing={editing}
                      onChange={setAgencyName}
                      icon={<Building2 className="h-4 w-4" />}
                    />
                    <ProfileField label="Отчество" value={patronymic || "не заполнено"} editing={editing} onChange={setPatronymic} />
                    <ProfileField label="Язык уведомлений" value="Русский" editing={false} icon={<Globe className="h-4 w-4" />} />
                  </div>
                </CardContent>
              </Card>

              {/* About Me */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Обо мне</h3>
                  {editing ? (
                    <Textarea
                      value={bio}
                      onChange={e => setBio(e.target.value)}
                      placeholder="Расскажите о себе..."
                      className="min-h-[100px] text-sm"
                    />
                  ) : bio ? (
                    <p className="text-sm text-foreground leading-relaxed">{bio}</p>
                  ) : (
                    <div className="flex flex-col items-center py-8 text-center">
                      <div className="h-16 w-16 rounded-2xl bg-muted/40 flex items-center justify-center mb-3">
                        <FileIcon className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                      <p className="text-sm text-muted-foreground mb-3">
                        Делитесь интересными историями, загружайте фотографии памятных событий
                      </p>
                      <Button variant="outline" size="sm" className="text-[13px]" onClick={() => setEditing(true)}>
                        Рассказать о себе
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Interests */}
              <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
                <CardContent className="p-5">
                  <h3 className="text-sm font-semibold text-foreground mb-4">Мои интересы</h3>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {interests.length === 0 && !editing && (
                      <p className="text-sm text-muted-foreground">Не указаны</p>
                    )}
                    {interests.map((tag, i) => (
                      <Badge key={i} variant="secondary" className="text-xs px-3 py-1 bg-primary/10 text-primary border-0">
                        {tag}
                        {editing && (
                          <button
                            className="ml-1.5 hover:text-destructive"
                            onClick={() => setInterests(interests.filter((_, idx) => idx !== i))}
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </Badge>
                    ))}
                  </div>
                  {editing && (
                    <div className="flex gap-2">
                      <Input
                        value={newInterest}
                        onChange={e => setNewInterest(e.target.value)}
                        placeholder="Добавить интерес..."
                        className="h-8 text-sm"
                        onKeyDown={e => {
                          if (e.key === "Enter" && newInterest.trim()) {
                            setInterests([...interests, newInterest.trim()]);
                            setNewInterest("");
                          }
                        }}
                      />
                      <Button
                        size="sm"
                        className="h-8 text-xs"
                        disabled={!newInterest.trim()}
                        onClick={() => {
                          setInterests([...interests, newInterest.trim()]);
                          setNewInterest("");
                        }}
                      >
                        Добавить
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Efficiency Tab */}
        <TabsContent value="efficiency" className="mt-0 p-6">
          <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
            <CardContent className="p-6">
              <h3 className="text-lg font-bold text-foreground mb-6">Эффективность</h3>
              <div className="max-w-md space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Выполнение задач</span>
                  <span className="text-2xl font-bold text-primary">{efficiency}%</span>
                </div>
                <Progress value={efficiency} className="h-3" />
                <div className="grid grid-cols-2 gap-4 pt-4">
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <span className="text-2xl font-bold text-foreground">{taskStats?.total ?? 0}</span>
                    <p className="text-xs text-muted-foreground mt-1">Всего задач</p>
                  </div>
                  <div className="bg-muted/30 rounded-xl p-4 text-center">
                    <span className="text-2xl font-bold text-green-500">{taskStats?.completed ?? 0}</span>
                    <p className="text-xs text-muted-foreground mt-1">Завершено</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Placeholder tabs */}
        {["tasks", "calendar", "feed"].map(tab => (
          <TabsContent key={tab} value={tab} className="mt-0 p-6">
            <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm">
              <CardContent className="p-12 text-center">
                <p className="text-sm text-muted-foreground">Раздел в разработке</p>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

/* ─── Profile Field Row ─── */
function ProfileField({
  label,
  value,
  editing,
  onChange,
  icon,
}: {
  label: string;
  value: string;
  editing: boolean;
  onChange?: (v: string) => void;
  icon?: React.ReactNode;
}) {
  return (
    <div className="flex items-center gap-4 py-3.5">
      {icon && <span className="text-muted-foreground shrink-0">{icon}</span>}
      <span className="text-xs text-muted-foreground w-32 shrink-0">{label}</span>
      {editing && onChange ? (
        <Input
          value={value === "не заполнено" ? "" : value}
          onChange={e => onChange(e.target.value)}
          className="h-8 text-sm flex-1"
        />
      ) : (
        <span className={cn("text-sm font-medium", value && value !== "не заполнено" ? "text-foreground" : "text-muted-foreground/50")}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

/* ─── Placeholder icon for bio ─── */
function FileIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
      <path d="M14 2v6h6" />
      <path d="M12 18v-6" />
      <path d="m9 15 3-3 3 3" />
    </svg>
  );
}
