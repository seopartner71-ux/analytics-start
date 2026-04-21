import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Calendar } from "@/components/ui/calendar";
import {
  User, Mail, Briefcase, Building2, Globe, Edit3, Save,
  X, Camera, ThumbsUp, Gift, Trophy, Crown, Star, Heart,
  Award, Smile, Flag, Hash, Bookmark, Target, Zap,
  Smartphone, Monitor, Loader2, Lock, Eye, EyeOff,
  CalendarDays, ListTodo, Newspaper, Pin, Clock,
} from "lucide-react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ru } from "date-fns/locale";
import { format, isSameDay, parseISO } from "date-fns";

const BADGE_ICONS = [
  ThumbsUp, Gift, Trophy, Crown, Star, Heart, Award, Smile,
  Flag, Bookmark, Hash, Target, Zap, Globe, Briefcase, Building2,
];

function getDefaultAvatar(name: string, size = 200) {
  const hash = name.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  return `https://i.pravatar.cc/${size}?u=${hash}`;
}

export default function ProfilePage() {
  const { user, profile, role, refreshProfile } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("profile");
  const [editing, setEditing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Editable fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [agencyName, setAgencyName] = useState("");

  useEffect(() => {
    if (profile) {
      setFullName(profile.full_name || "");
      setEmail(profile.email || "");
      setAgencyName(profile.agency_name || "");
    }
  }, [profile]);

  const avatarUrl = profile?.avatar_url || getDefaultAvatar(fullName || "User", 200);

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

  // My tasks
  const { data: myTasks = [] } = useQuery({
    queryKey: ["profile-my-tasks", user?.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("crm_tasks")
        .select("id, title, stage, priority, deadline, project_id")
        .eq("owner_id", user!.id)
        .order("deadline", { ascending: true, nullsFirst: false })
        .limit(50);
      return data || [];
    },
    enabled: !!user,
  });

  // Company news (feed)
  const { data: news = [] } = useQuery({
    queryKey: ["profile-news"],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_news")
        .select("id, title, body, type, pinned, created_at")
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(20);
      return data || [];
    },
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

  const handleAvatarUpload = async (file: File) => {
    if (!user) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Можно загружать только изображения");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Размер файла не должен превышать 5 МБ");
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/avatar-${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from("avatars").getPublicUrl(path);
      const { error: updErr } = await supabase
        .from("profiles")
        .update({ avatar_url: pub.publicUrl })
        .eq("user_id", user.id);
      if (updErr) throw updErr;
      await refreshProfile();
      toast.success("Аватар обновлён");
    } catch (e: any) {
      toast.error(e.message || "Не удалось загрузить");
    } finally {
      setUploadingAvatar(false);
    }
  };

  const nameParts = fullName.split(" ");
  const firstName = nameParts[0] || "";
  const lastName = nameParts.slice(1).join(" ") || "";

  const roleLabel = role === "admin" ? "Администратор" : role === "manager" ? "Менеджер" : "Наблюдатель";
  const efficiency = taskStats?.pct ?? 0;

  const profileTabs = [
    { key: "profile", label: "Профиль" },
    { key: "security", label: "Безопасность" },
    { key: "tasks", label: "Задачи", badge: myTasks.length ? String(myTasks.length) : undefined },
    { key: "calendar", label: "Календарь" },
    { key: "feed", label: "Лента" },
    { key: "efficiency", label: `Эффективность`, badge: `${efficiency}%` },
  ];

  return (
    <div className="space-y-0">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) handleAvatarUpload(f);
          e.target.value = "";
        }}
      />

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
        <div className="border-b border-border bg-card/50 px-6 overflow-x-auto">
          <TabsList className="h-auto bg-transparent p-0 gap-0">
            {profileTabs.map(tab => (
              <TabsTrigger
                key={tab.key}
                value={tab.key}
                className={cn(
                  "rounded-none border-b-2 border-transparent px-4 py-3 text-[13px] font-medium transition-colors whitespace-nowrap",
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
              <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm overflow-hidden">
                <CardContent className="p-6 flex flex-col items-center">
                  <div className="relative mb-4 group">
                    <img
                      src={avatarUrl}
                      alt={fullName}
                      className="h-32 w-32 rounded-full object-cover ring-4 ring-primary/20 shadow-lg"
                    />
                    <div className="absolute bottom-1 right-1 h-5 w-5 rounded-full bg-green-500 border-[3px] border-card" title="В сети" />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingAvatar}
                      className="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white"
                    >
                      {uploadingAvatar ? <Loader2 className="h-6 w-6 animate-spin" /> : (
                        <div className="flex flex-col items-center gap-1">
                          <Camera className="h-6 w-6" />
                          <span className="text-[10px]">Изменить фото</span>
                        </div>
                      )}
                    </button>
                  </div>
                  <span className="text-xs text-green-500 font-medium mb-2">● В сети</span>
                  <h2 className="text-lg font-bold text-foreground text-center">{fullName || "Имя не указано"}</h2>
                  <span className="text-sm text-muted-foreground">{roleLabel}</span>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-4 text-[12px] gap-1.5"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={uploadingAvatar}
                  >
                    {uploadingAvatar ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Camera className="h-3.5 w-3.5" />}
                    Загрузить фото
                  </Button>

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
                    <ProfileField label="Язык уведомлений" value="Русский" editing={false} icon={<Globe className="h-4 w-4" />} />
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </TabsContent>

        {/* Security Tab */}
        <TabsContent value="security" className="mt-0 p-6">
          <ChangePasswordCard email={email} />
        </TabsContent>

        {/* Tasks Tab */}
        <TabsContent value="tasks" className="mt-0 p-6">
          <TasksList tasks={myTasks} />
        </TabsContent>

        {/* Calendar Tab */}
        <TabsContent value="calendar" className="mt-0 p-6">
          <TaskCalendar tasks={myTasks} />
        </TabsContent>

        {/* Feed Tab */}
        <TabsContent value="feed" className="mt-0 p-6">
          <FeedList items={news} />
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
      </Tabs>
    </div>
  );
}

/* ─── Profile Field Row ─── */
function ProfileField({
  label, value, editing, onChange, icon,
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
          value={value}
          onChange={e => onChange(e.target.value)}
          className="h-8 text-sm flex-1"
        />
      ) : (
        <span className={cn("text-sm font-medium", value ? "text-foreground" : "text-muted-foreground/50")}>
          {value || "—"}
        </span>
      )}
    </div>
  );
}

/* ─── Tasks List ─── */
function TasksList({ tasks }: { tasks: Array<{ id: string; title: string; stage: string; priority: string; deadline: string | null }> }) {
  if (!tasks.length) {
    return (
      <Card className="bg-card/80 border-border/60">
        <CardContent className="p-12 text-center">
          <ListTodo className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">У вас пока нет задач</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="bg-card/80 border-border/60">
      <CardContent className="p-4">
        <div className="space-y-2">
          {tasks.map(t => (
            <div key={t.id} className="flex items-center gap-3 p-3 rounded-lg border border-border/40 hover:bg-muted/30 transition-colors">
              <div className={cn(
                "h-2 w-2 rounded-full shrink-0",
                t.priority === "high" ? "bg-destructive" : t.priority === "low" ? "bg-muted-foreground" : "bg-primary"
              )} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{t.title}</p>
                <div className="flex items-center gap-3 mt-0.5">
                  <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{t.stage}</Badge>
                  {t.deadline && (
                    <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {format(parseISO(t.deadline), "d MMM yyyy", { locale: ru })}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

/* ─── Task Calendar ─── */
function TaskCalendar({ tasks }: { tasks: Array<{ id: string; title: string; deadline: string | null; stage: string }> }) {
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const tasksWithDeadline = tasks.filter(t => t.deadline);
  const deadlineDates = tasksWithDeadline.map(t => parseISO(t.deadline!));
  const tasksOnDay = selectedDate
    ? tasksWithDeadline.filter(t => isSameDay(parseISO(t.deadline!), selectedDate))
    : [];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="bg-card/80 border-border/60">
        <CardContent className="p-4 flex justify-center">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            locale={ru}
            modifiers={{ hasTask: deadlineDates }}
            modifiersClassNames={{ hasTask: "bg-primary/15 font-bold text-primary" }}
            className="rounded-md"
          />
        </CardContent>
      </Card>
      <Card className="bg-card/80 border-border/60">
        <CardContent className="p-5">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            {selectedDate ? format(selectedDate, "d MMMM yyyy", { locale: ru }) : "Выберите дату"}
          </h3>
          {tasksOnDay.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">На этот день задач нет</p>
          ) : (
            <div className="space-y-2">
              {tasksOnDay.map(t => (
                <div key={t.id} className="p-3 rounded-lg border border-border/40">
                  <p className="text-sm font-medium text-foreground">{t.title}</p>
                  <Badge variant="secondary" className="mt-1 text-[10px] h-4 px-1.5">{t.stage}</Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Feed (Company News) ─── */
function FeedList({ items }: { items: Array<{ id: string; title: string; body: string; type: string; pinned: boolean; created_at: string }> }) {
  if (!items.length) {
    return (
      <Card className="bg-card/80 border-border/60">
        <CardContent className="p-12 text-center">
          <Newspaper className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
          <p className="text-sm text-muted-foreground">Новостей пока нет</p>
        </CardContent>
      </Card>
    );
  }
  return (
    <div className="space-y-3 max-w-3xl">
      {items.map(item => (
        <Card key={item.id} className={cn("bg-card/80 border-border/60", item.pinned && "border-primary/40 bg-primary/[0.02]")}>
          <CardContent className="p-5">
            <div className="flex items-start gap-2 mb-2">
              {item.pinned && <Pin className="h-3.5 w-3.5 text-primary mt-1 shrink-0" />}
              <div className="flex-1">
                <h3 className="text-base font-bold text-foreground">{item.title}</h3>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {format(parseISO(item.created_at), "d MMMM yyyy 'в' HH:mm", { locale: ru })}
                </p>
              </div>
            </div>
            {item.body && <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed">{item.body}</p>}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

/* ─── Change Password Card ─── */
function ChangePasswordCard({ email }: { email: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);

  const passwordsMatch = newPassword.length > 0 && newPassword === confirmPassword;
  const passwordValid = newPassword.length >= 6;

  const handleSubmit = async () => {
    if (!passwordValid) {
      toast.error("Пароль должен содержать минимум 6 символов");
      return;
    }
    if (!passwordsMatch) {
      toast.error("Пароли не совпадают");
      return;
    }
    setLoading(true);
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: currentPassword,
      });
      if (signInError) {
        toast.error("Текущий пароль неверный");
        setLoading(false);
        return;
      }
      const { error: updateError } = await supabase.auth.updateUser({
        password: newPassword,
      });
      if (updateError) throw updateError;
      toast.success("Пароль успешно изменён");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (e: any) {
      toast.error(e.message || "Не удалось изменить пароль");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/60 shadow-sm max-w-2xl">
      <CardContent className="p-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
            <Lock className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Смена пароля</h3>
            <p className="text-xs text-muted-foreground">Минимум 6 символов</p>
          </div>
        </div>

        <div className="space-y-4 mt-6">
          <PasswordInput
            label="Текущий пароль"
            value={currentPassword}
            onChange={setCurrentPassword}
            show={showCurrent}
            onToggle={() => setShowCurrent(s => !s)}
          />
          <PasswordInput
            label="Новый пароль"
            value={newPassword}
            onChange={setNewPassword}
            show={showNew}
            onToggle={() => setShowNew(s => !s)}
            hint={newPassword.length > 0 && !passwordValid ? "Минимум 6 символов" : undefined}
          />
          <PasswordInput
            label="Подтвердите новый пароль"
            value={confirmPassword}
            onChange={setConfirmPassword}
            show={showConfirm}
            onToggle={() => setShowConfirm(s => !s)}
            hint={confirmPassword.length > 0 && !passwordsMatch ? "Пароли не совпадают" : undefined}
          />

          <Button
            onClick={handleSubmit}
            disabled={loading || !currentPassword || !passwordValid || !passwordsMatch}
            className="w-full sm:w-auto gap-2"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Lock className="h-4 w-4" />}
            Изменить пароль
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function PasswordInput({
  label, value, onChange, show, onToggle, hint,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  show: boolean;
  onToggle: () => void;
  hint?: string;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <div className="relative">
        <Input
          type={show ? "text" : "password"}
          value={value}
          onChange={e => onChange(e.target.value)}
          className="pr-10 h-10"
          autoComplete="new-password"
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
      {hint && <p className="text-xs text-destructive">{hint}</p>}
    </div>
  );
}
