import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield } from "lucide-react";

export function FinanceGuard({ children }: { children: React.ReactNode }) {
  const { loading, hasFinanceAccess, session } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  if (!hasFinanceAccess) {
    return (
      <div className="flex-1 flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
          <h2 className="text-lg font-semibold text-foreground">Доступ запрещён</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Раздел «Финансы» доступен только администраторам и сотрудникам с включённым разрешением. Обратитесь к администратору.
          </p>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
