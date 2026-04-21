import { useAuth } from "@/contexts/AuthContext";
import { Navigate } from "react-router-dom";
import { Shield } from "lucide-react";

export function FinanceGuard({ children }: { children: React.ReactNode }) {
  const { loading, role, isAdmin, session } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  const allowed = isAdmin || role === "director";
  if (!allowed) return <Navigate to="/" replace />;

  return <>{children}</>;
}
