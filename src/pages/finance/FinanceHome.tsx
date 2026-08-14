import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import Index from "@/pages/Index";

const OverviewPage = lazy(() => import("./OverviewPage"));

/** Главный экран: финансовый дашборд для руководства, рабочий дашборд для остальных. */
export default function FinanceHome() {
  const { isAdmin, role } = useAuth();
  const financeFirst = isAdmin || role === "director";
  if (!financeFirst) return <Index />;
  return (
    <Suspense fallback={<div className="flex h-[50vh] items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}>
      <OverviewPage />
    </Suspense>
  );
}
