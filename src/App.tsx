import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { useThemeInit } from "@/hooks/useTheme";
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Auth from "./pages/Auth";
import SubmitTicket from "./pages/SubmitTicket";
import MyTickets from "./pages/MyTickets";
import Work from "./pages/Work";
import Safety from "./pages/Safety";
import Overview from "./pages/Overview";
import Admin from "./pages/Admin";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => {
  useThemeInit();
  
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Routes>
              <Route path="/auth" element={<Auth />} />
              <Route path="/" element={<Navigate to="/submit" replace />} />
              <Route path="/submit" element={<AppLayout><SubmitTicket /></AppLayout>} />
              <Route path="/my-tickets" element={<AppLayout><MyTickets /></AppLayout>} />
              <Route path="/work" element={
                <AppLayout>
                  <ProtectedRoute requiredRoles={['admin', 'maintenance']}>
                    <Work />
                  </ProtectedRoute>
                </AppLayout>
              } />
              <Route path="/safety" element={
                <AppLayout>
                  <ProtectedRoute requiredRoles={['admin', 'safety_officer']}>
                    <Safety />
                  </ProtectedRoute>
                </AppLayout>
              } />
              <Route path="/overview" element={
                <AppLayout>
                  <ProtectedRoute requiredRoles={['admin', 'leadership']}>
                    <Overview />
                  </ProtectedRoute>
                </AppLayout>
              } />
              <Route path="/admin" element={
                <AppLayout>
                  <ProtectedRoute requiredRoles={['admin']}>
                    <Admin />
                  </ProtectedRoute>
                </AppLayout>
              } />
              <Route path="/profile" element={
                <AppLayout>
                  <Profile />
                </AppLayout>
              } />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
