import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspaceColorProvider } from "@/contexts/WorkspaceColorContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { FinanceGuard } from "@/components/FinanceGuard";
import Index from "./pages/Index";
import ProjectDetail from "./pages/ProjectDetail";
import PublicReport from "./pages/PublicReport";
import PublicWeeklyReport from "./pages/PublicWeeklyReport";
import ShareView from "./pages/ShareView";
import Team from "./pages/Team";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OAuthCallback from "./pages/OAuthCallback";
import AdminPanel from "./pages/AdminPanel";
import CompaniesPage from "./pages/CompaniesPage";
import EmployeesPage from "./pages/EmployeesPage";
import CrmTasksPage from "./pages/CrmTasksPage";
import MyTasksPage from "./pages/MyTasksPage";
import DirectorDashboard from "./pages/DirectorDashboard";
import CrmProjectsPage from "./pages/CrmProjectsPage";
import CrmProjectDetailPage from "./pages/CrmProjectDetailPage";
import ContentPage from "./pages/ContentPage";
import LinksPage from "./pages/LinksPage";
import ProfilePage from "./pages/ProfilePage";
import ChatPage from "./pages/ChatPage";
import ReportsPage from "./pages/ReportsPage";
import Finance from "./pages/Finance";
import TimeTrackingPage from "./pages/TimeTrackingPage";
import WorkloadPage from "./pages/WorkloadPage";
import EmployeeKpiPage from "./pages/EmployeeKpiPage";
import PlanFactPage from "./pages/PlanFactPage";
import OnboardingPage from "./pages/OnboardingPage";
import KnowledgeBasePage from "./pages/KnowledgeBasePage";
import KnowledgeBooksPage from "./pages/KnowledgeBooksPage";
import UsersAdminPage from "./pages/UsersAdminPage";
import AdminTimeStatsPage from "./pages/AdminTimeStatsPage";
import { CrmLayout } from "./components/CrmLayout";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider>
      <AuthProvider>
        <WorkspaceColorProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/auth" element={<Auth />} />
                <Route path="/share/:shareToken" element={<ShareView />} />
                <Route path="/report/:id" element={<PublicReport />} />
                <Route path="/weekly/:token" element={<PublicWeeklyReport />} />
                <Route path="/oauth/yandex/callback" element={<OAuthCallback />} />
                <Route path="/" element={<ProtectedRoute><CrmLayout><Index /></CrmLayout></ProtectedRoute>} />
                <Route path="/companies" element={<ProtectedRoute><CrmLayout><CompaniesPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><CrmLayout><EmployeesPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><CrmLayout><CrmTasksPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/my-tasks" element={<ProtectedRoute><CrmLayout><MyTasksPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/director" element={<ProtectedRoute><CrmLayout><DirectorDashboard /></CrmLayout></ProtectedRoute>} />
                <Route path="/crm-projects" element={<ProtectedRoute><CrmLayout><CrmProjectsPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/crm-projects/:id" element={<ProtectedRoute><CrmLayout><CrmProjectDetailPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/content" element={<ProtectedRoute><CrmLayout><ContentPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/links" element={<ProtectedRoute><CrmLayout><LinksPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><CrmLayout><Team /></CrmLayout></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><CrmLayout><AdminPanel /></CrmLayout></ProtectedRoute>} />
                <Route path="/profile" element={<ProtectedRoute><CrmLayout><ProfilePage /></CrmLayout></ProtectedRoute>} />
                <Route path="/chat" element={<ProtectedRoute><CrmLayout><ChatPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/reports" element={<ProtectedRoute><CrmLayout><ReportsPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/finance" element={<ProtectedRoute><CrmLayout><FinanceGuard><Finance /></FinanceGuard></CrmLayout></ProtectedRoute>} />
                <Route path="/time-tracking" element={<ProtectedRoute><CrmLayout><TimeTrackingPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/workload" element={<ProtectedRoute><CrmLayout><WorkloadPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/kpi" element={<ProtectedRoute><CrmLayout><EmployeeKpiPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/plan-fact" element={<ProtectedRoute><CrmLayout><PlanFactPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/onboarding" element={<ProtectedRoute><CrmLayout><OnboardingPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/knowledge" element={<ProtectedRoute><CrmLayout><KnowledgeBasePage /></CrmLayout></ProtectedRoute>} />
                <Route path="/knowledge-books" element={<ProtectedRoute><CrmLayout><KnowledgeBooksPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/users" element={<ProtectedRoute><CrmLayout><EmployeesPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/admin/time-stats" element={<ProtectedRoute><CrmLayout><EmployeesPage /></CrmLayout></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </TooltipProvider>
        </WorkspaceColorProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
