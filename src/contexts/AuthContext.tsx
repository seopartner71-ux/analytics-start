import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { waitForEdgeProxyReady, isProxyDisabled } from "@/shared/utils/edgeProxy";
import type { Database } from "@/integrations/supabase/types";

type AppRole = Database["public"]["Enums"]["app_role"];

interface AuthContextType {
  session: Session | null;
  user: User | null;
  role: AppRole | null;
  profile: Database["public"]["Tables"]["profiles"]["Row"] | null;
  loading: boolean;
  isAdmin: boolean;
  isManager: boolean;
  isViewer: boolean;
  canEdit: boolean;
  hasFinanceAccess: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  role: null,
  profile: null,
  loading: true,
  isAdmin: false,
  isManager: false,
  isViewer: false,
  canEdit: false,
  hasFinanceAccess: false,
  signOut: async () => {},
  refreshProfile: async () => {},
});

export const useAuth = () => useContext(AuthContext);

const ROLE_PRIORITY: AppRole[] = ["admin", "director", "manager", "seo", "junior", "viewer"];

function resolveHighestRole(roles: AppRole[]): AppRole | null {
  return ROLE_PRIORITY.find((role) => roles.includes(role)) ?? roles[0] ?? null;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<AppRole | null>(null);
  const [profile, setProfile] = useState<Database["public"]["Tables"]["profiles"]["Row"] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;

    const syncAuthState = async (nextSession: Session | null) => {
      if (!mounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setRole(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      setLoading(true);

      let roles: { role: AppRole }[] | null = null;
      let rolesError: Error | null = null;
      let prof: Database["public"]["Tables"]["profiles"]["Row"] | null = null;
      let profileError: Error | null = null;

      try {
        const [rolesResult, profileResult] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", nextSession.user.id),
          supabase.from("profiles").select("*").eq("user_id", nextSession.user.id).single(),
        ]);

        roles = (rolesResult.data as { role: AppRole }[] | null) ?? null;
        rolesError = (rolesResult.error as Error | null) ?? null;
        prof = (profileResult.error ? null : profileResult.data) ?? null;
        profileError = (profileResult.error as Error | null) ?? null;
      } catch (error) {
        console.warn("[auth] Ошибка инициализации профиля:", error);
      }

      if (!mounted) return;

      if (rolesError) console.warn("[auth] Не удалось загрузить роли:", rolesError.message);
      if (profileError) console.warn("[auth] Не удалось загрузить профиль:", profileError.message);

      const roleList = (roles ?? []).map((item) => item.role);
      setRole(resolveHighestRole(roleList));
      setProfile(profileError ? null : prof);
      setLoading(false);
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      void syncAuthState(nextSession);
    });

    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        void syncAuthState(session);
      })
      .catch((error) => {
        console.warn("[auth] Не удалось восстановить сессию:", error);
        if (!mounted) return;
        setSession(null);
        setUser(null);
        setRole(null);
        setProfile(null);
        setLoading(false);
      });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const refreshProfile = async () => {
    if (!user) return;
    const { data: prof } = await supabase.from("profiles").select("*").eq("user_id", user.id).single();
    if (prof) setProfile(prof);
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const isAdmin = role === "admin";
  const isManager = role === "manager";
  const isViewer = role === "viewer";
  const canEdit = isAdmin || isManager;
  const hasFinanceAccess = isAdmin || (profile as any)?.finance_access === true;

  return (
    <AuthContext.Provider value={{ session, user, role, profile, loading, isAdmin, isManager, isViewer, canEdit, hasFinanceAccess, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}
