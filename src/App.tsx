import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { WorkspaceColorProvider } from "@/contexts/WorkspaceColorContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import ProjectDetail from "./pages/ProjectDetail";
import PublicReport from "./pages/PublicReport";
import ShareView from "./pages/ShareView";
import Team from "./pages/Team";
import Auth from "./pages/Auth";
import NotFound from "./pages/NotFound";
import OAuthCallback from "./pages/OAuthCallback";
import AdminPanel from "./pages/AdminPanel";
import CompaniesPage from "./pages/CompaniesPage";
import EmployeesPage from "./pages/EmployeesPage";
import CrmTasksPage from "./pages/CrmTasksPage";
import CrmProjectsPage from "./pages/CrmProjectsPage";
import CrmProjectDetailPage from "./pages/CrmProjectDetailPage";
import ContentPage from "./pages/ContentPage";
import LinksPage from "./pages/LinksPage";
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
                <Route path="/oauth/yandex/callback" element={<OAuthCallback />} />
                <Route path="/" element={<ProtectedRoute><CrmLayout><Index /></CrmLayout></ProtectedRoute>} />
                <Route path="/companies" element={<ProtectedRoute><CrmLayout><CompaniesPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/employees" element={<ProtectedRoute><CrmLayout><EmployeesPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/tasks" element={<ProtectedRoute><CrmLayout><CrmTasksPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/crm-projects" element={<ProtectedRoute><CrmLayout><CrmProjectsPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/content" element={<ProtectedRoute><CrmLayout><ContentPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/links" element={<ProtectedRoute><CrmLayout><LinksPage /></CrmLayout></ProtectedRoute>} />
                <Route path="/project/:id" element={<ProtectedRoute><ProjectDetail /></ProtectedRoute>} />
                <Route path="/team" element={<ProtectedRoute><CrmLayout><Team /></CrmLayout></ProtectedRoute>} />
                <Route path="/admin" element={<ProtectedRoute><CrmLayout><AdminPanel /></CrmLayout></ProtectedRoute>} />
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
