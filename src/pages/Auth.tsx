import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { BarChart3, Globe, Mail, Lock, User, Sparkles, TrendingUp, Shield, Zap } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

const Auth = () => {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { session } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (session) navigate("/", { replace: true });
  }, [session, navigate]);

  const toggleLang = () => i18n.changeLanguage(i18n.language === "ru" ? "en" : "ru");

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        emailRedirectTo: window.location.origin,
      },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success(t("auth.checkEmail"));
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) toast.error(error.message);
  };

  const handleMagicLink = async () => {
    if (!email) {
      toast.error(t("auth.enterEmail"));
      return;
    }
    setLoading(true);
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    setLoading(false);
    if (error) toast.error(error.message);
    else toast.success(t("auth.magicLinkSent"));
  };

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Animated gradient orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 h-[500px] w-[500px] rounded-full bg-accent/10 blur-3xl animate-pulse" />
        <div className="absolute -bottom-40 -left-40 h-[500px] w-[500px] rounded-full bg-primary/10 blur-3xl animate-pulse" style={{ animationDelay: "1s" }} />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[600px] w-[600px] rounded-full bg-accent/5 blur-3xl" />
      </div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)`,
          backgroundSize: "48px 48px",
        }}
      />

      {/* Lang toggle */}
      <div className="fixed top-6 right-6 z-20">
        <Button variant="ghost" size="sm" onClick={toggleLang} className="gap-1.5 text-xs backdrop-blur-md bg-card/40 border border-border/40">
          <Globe className="h-3.5 w-3.5" />
          {i18n.language === "ru" ? "EN" : "RU"}
        </Button>
      </div>

      <div className="relative z-10 min-h-screen grid lg:grid-cols-2">
        {/* Left side — branding */}
        <div className="hidden lg:flex flex-col justify-between p-12 xl:p-16 border-r border-border/40">
          <div className="flex items-center gap-2.5">
            <div className="relative">
              <div className="absolute inset-0 bg-accent/30 blur-xl rounded-full" />
              <div className="relative h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-accent-foreground" />
              </div>
            </div>
            <span className="text-xl font-bold tracking-tight">StatPulse</span>
          </div>

          <div className="space-y-8 max-w-lg">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-6">
                <Sparkles className="h-3 w-3 text-accent" />
                <span className="text-[11px] font-medium text-accent uppercase tracking-wider">SEO Analytics Platform</span>
              </div>
              <h1 className="text-5xl xl:text-6xl font-bold tracking-tight leading-[1.05] text-foreground">
                Управляйте SEO<br />
                <span className="bg-gradient-to-r from-accent via-accent to-accent/60 bg-clip-text text-transparent">
                  как профи
                </span>
              </h1>
              <p className="text-base text-muted-foreground mt-6 leading-relaxed">
                Единая платформа для агентств: проекты, отчёты клиентам, контроль команды и интеграции с Яндекс.Метрикой, GSC и Топвизором.
              </p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {[
                { icon: TrendingUp, title: "Аналитика в реальном времени", desc: "Метрика, GSC, Вебмастер, Топвизор" },
                { icon: Shield, title: "Безопасность данных", desc: "Шифрование и разделение ролей" },
                { icon: Zap, title: "Быстрые отчёты", desc: "PDF и публичные ссылки за секунды" },
              ].map((f, i) => (
                <div key={i} className="flex items-start gap-3 p-4 rounded-xl bg-card/40 backdrop-blur-sm border border-border/40 hover:border-accent/30 transition-colors">
                  <div className="h-9 w-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <f.icon className="h-4 w-4 text-accent" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">{f.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-6 text-xs text-muted-foreground">
            <span>© 2026 StatPulse</span>
            <span>•</span>
            <span>Сделано для агентств</span>
          </div>
        </div>

        {/* Right side — form */}
        <div className="flex flex-col items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            {/* Mobile branding */}
            <div className="lg:hidden flex items-center justify-center gap-2.5 mb-8">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center shadow-lg">
                <BarChart3 className="h-5 w-5 text-accent-foreground" />
              </div>
              <span className="text-xl font-bold tracking-tight">StatPulse</span>
            </div>

            <div className="relative">
              {/* Glass card */}
              <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-primary/5 rounded-2xl blur-xl" />
              <div className="relative bg-card/60 backdrop-blur-xl border border-border/60 rounded-2xl p-8 shadow-2xl">
                <div className="mb-6">
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Добро пожаловать</h2>
                  <p className="text-sm text-muted-foreground mt-1">Войдите в свой аккаунт или создайте новый</p>
                </div>

                <Tabs defaultValue="signin" className="space-y-5">
                  <TabsList className="w-full bg-muted/50 p-1 h-10">
                    <TabsTrigger value="signin" className="flex-1 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">{t("auth.signIn")}</TabsTrigger>
                    <TabsTrigger value="signup" className="flex-1 text-sm data-[state=active]:bg-card data-[state=active]:shadow-sm">{t("auth.signUp")}</TabsTrigger>
                  </TabsList>

                  <TabsContent value="signin" className="space-y-4 mt-0">
                    <form onSubmit={handleSignIn} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="signin-email" className="text-xs font-medium text-muted-foreground">{t("auth.email")}</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                          <Input id="signin-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="pl-9 h-11 bg-background/60 border-border/60 focus-visible:ring-accent/30 focus-visible:border-accent" required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signin-password" className="text-xs font-medium text-muted-foreground">{t("auth.password")}</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                          <Input id="signin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 h-11 bg-background/60 border-border/60 focus-visible:ring-accent/30 focus-visible:border-accent" required />
                        </div>
                      </div>
                      <Button type="submit" className="w-full h-11 bg-gradient-to-r from-accent to-accent/85 hover:from-accent/90 hover:to-accent/75 text-accent-foreground font-semibold shadow-lg shadow-accent/20" disabled={loading}>
                        {loading ? t("common.loading") : t("auth.signIn")}
                      </Button>
                      <div className="relative py-1">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/60" /></div>
                        <div className="relative flex justify-center text-[10px] uppercase tracking-wider"><span className="bg-card px-3 text-muted-foreground">{t("auth.or")}</span></div>
                      </div>
                      <Button type="button" variant="outline" className="w-full h-11 gap-2 border-border/60 bg-background/40 hover:bg-background/80" onClick={handleMagicLink} disabled={loading}>
                        <Mail className="h-4 w-4" />
                        {t("auth.magicLink")}
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="signup" className="space-y-4 mt-0">
                    <form onSubmit={handleSignUp} className="space-y-4">
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-name" className="text-xs font-medium text-muted-foreground">{t("auth.fullName")}</Label>
                        <div className="relative group">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                          <Input id="signup-name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t("auth.fullNamePlaceholder")} className="pl-9 h-11 bg-background/60 border-border/60 focus-visible:ring-accent/30 focus-visible:border-accent" />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-email" className="text-xs font-medium text-muted-foreground">{t("auth.email")}</Label>
                        <div className="relative group">
                          <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                          <Input id="signup-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@company.com" className="pl-9 h-11 bg-background/60 border-border/60 focus-visible:ring-accent/30 focus-visible:border-accent" required />
                        </div>
                      </div>
                      <div className="space-y-1.5">
                        <Label htmlFor="signup-password" className="text-xs font-medium text-muted-foreground">{t("auth.password")}</Label>
                        <div className="relative group">
                          <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
                          <Input id="signup-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="pl-9 h-11 bg-background/60 border-border/60 focus-visible:ring-accent/30 focus-visible:border-accent" required minLength={6} />
                        </div>
                        <p className="text-[11px] text-muted-foreground pt-0.5">Минимум 6 символов</p>
                      </div>
                      <Button type="submit" className="w-full h-11 bg-gradient-to-r from-accent to-accent/85 hover:from-accent/90 hover:to-accent/75 text-accent-foreground font-semibold shadow-lg shadow-accent/20" disabled={loading}>
                        {loading ? t("common.loading") : t("auth.signUp")}
                      </Button>
                    </form>
                  </TabsContent>
                </Tabs>

                <p className="text-[11px] text-center text-muted-foreground mt-6 leading-relaxed">
                  Регистрируясь, вы соглашаетесь с условиями использования<br />и политикой конфиденциальности
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
