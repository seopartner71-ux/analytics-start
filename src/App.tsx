import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { lazy, Suspense } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspaceColorProvider } from "@/contexts/WorkspaceColorContext";
import { FinancePeriodProvider } from "@/contexts/FinancePeriodContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FinanceGuard } from "@/components/FinanceGuard";
import { CrmLayout } from "./components/CrmLayout";
import { Loader2 } from "lucide-react";
import { GlobalProgressBar } from "./components/GlobalProgressBar";

// Eagerly load core / public routes
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OAuthCallback from "./pages/OAuthCallback";

// Lazy-load heavy / rarely-used pages — splits the bundle
const ProjectDetail = lazy(() => import("./pages/ProjectDetail"));
const PublicReport = lazy(() => import("./pages/PublicReport"));
const PublicWeeklyReport = lazy(() => import("./pages/PublicWeeklyReport"));
const ShareView = lazy(() => import("./pages/ShareView"));
const Team = lazy(() => import("./pages/Team"));
const AdminPanel = lazy(() => import("./pages/AdminPanel"));
const CrmTasksPage = lazy(() => import("./pages/CrmTasksPage"));
const DirectorDashboard = lazy(() => import("./pages/DirectorDashboard"));
const ContentPage = lazy(() => import("./pages/ContentPage"));
const LinksPage = lazy(() => import("./pages/LinksPage"));
const ProfilePage = lazy(() => import("./pages/ProfilePage"));

const Finance = lazy(() => import("./pages/Finance"));
const FinanceHome = lazy(() => import("./pages/finance/FinanceHome"));
const FinanceOverview = lazy(() => import("./pages/finance/OverviewPage"));
const FinanceOperations = lazy(() => import("./pages/finance/OperationsPage"));
const FinanceIncome = lazy(() => import("./pages/finance/IncomePage"));
const FinanceExpenses = lazy(() => import("./pages/finance/ExpensesPage"));
const FinanceClients = lazy(() => import("./pages/finance/ClientsPage"));
const FinancePayables = lazy(() => import("./pages/finance/PayablesPage"));
const FinanceForecast = lazy(() => import("./pages/finance/ForecastPage"));
const FinancePartners = lazy(() => import("./pages/finance/PartnersPage"));
const FinanceReports = lazy(() => import("./pages/finance/ReportsPage"));
const FinanceSettings = lazy(() => import("./pages/finance/FinanceSettingsPage"));
const DeletionLogPage = lazy(() => import("./pages/DeletionLogPage"));
const CredentialsPage = lazy(() => import("./pages/CredentialsPage"));
const NotificationSettingsPage = lazy(() => import("./pages/NotificationSettingsPage"));
const ProjectReportsPage = lazy(() => import("./pages/ProjectReportsPage"));


// Tuned QueryClient: cache for 60s, no refetch on window focus,
// retry once. Greatly reduces redundant network traffic.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const PageFallback = () => (
  <div className="flex h-[60vh] items-center justify-center">
    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
  </div>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceColorProvider>
          <FinancePeriodProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <GlobalProgressBar />
            <BrowserRouter>
              <Suspense fallback={<PageFallback />}>
                <Routes>
                  <Route path="/auth" element={<Auth />} />
                  <Route path="/share/:shareToken" element={<ShareView />} />
                  <Route path="/report/:id" element={<PublicReport />} />
                  <Route path="/weekly/:token" element={<PublicWeeklyReport />} />
                  <Route path="/oauth/yandex/callback" element={<OAuthCallback />} />
                  <Route path="/" element={<ProtectedRoute><CrmLayout><FinanceHome /></CrmLayout></ProtectedRoute>} />
                  <Route path="/seo-dashboard" element={<ProtectedRoute><CrmLayout><Index /></CrmLayout></ProtectedRoute>} />
                  <Route path="/tasks" element={<ProtectedRoute><CrmLayout><CrmTasksPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/director" element={<ProtectedRoute><CrmLayout><DirectorDashboard /></CrmLayout></ProtectedRoute>} />
                  <Route path="/content" element={<ProtectedRoute><CrmLayout><ContentPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/links" element={<ProtectedRoute><CrmLayout><LinksPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
                  <Route path="/team" element={<ProtectedRoute><CrmLayout><Team /></CrmLayout></ProtectedRoute>} />
                  <Route path="/admin" element={<ProtectedRoute><CrmLayout><AdminPanel /></CrmLayout></ProtectedRoute>} />
                  <Route path="/profile" element={<ProtectedRoute><CrmLayout><ProfilePage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance" element={<ProtectedRoute><CrmLayout><FinanceGuard><Finance /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/overview" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceOverview /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/operations" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceOperations /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/income" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceIncome /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/expenses" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceExpenses /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/clients" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceClients /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/payables" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinancePayables /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/forecast" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceForecast /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/partners" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinancePartners /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/reports" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceReports /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                  <Route path="/finance/settings" element={<ProtectedRoute><CrmLayout><FinanceGuard><FinanceSettings /></FinanceGuard></CrmLayout></ProtectedRoute>} />

                  <Route path="/admin/deletion-log" element={<ProtectedRoute><CrmLayout><DeletionLogPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/credentials" element={<ProtectedRoute><CrmLayout><CredentialsPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/notifications/settings" element={<ProtectedRoute><CrmLayout><NotificationSettingsPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="/project-reports" element={<ProtectedRoute><CrmLayout><ProjectReportsPage /></CrmLayout></ProtectedRoute>} />
                  <Route path="*" element={<NotFound />} />
                </Routes>
              </Suspense>
            </BrowserRouter>
          </TooltipProvider>
          </FinancePeriodProvider>
        </WorkspaceColorProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
