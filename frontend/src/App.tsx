import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
  Outlet,
} from "react-router-dom";
import { QueryClient, QueryClientProvider, MutationCache } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { AppLayout } from "@/components/AppLayout";
import { PermissionGate } from "@/components/PermissionGate";
import LoginPage from "@/pages/LoginPage";
import DashboardPage from "@/pages/DashboardPage";
import BuyersPage from "@/pages/BuyersPage";
import SignedContractSuppliersPage from "@/pages/SignedContractSuppliersPage";
import OldSuppliersPage from "@/pages/OldSuppliersPage";
import NewSuppliersPage from "@/pages/NewSuppliersPage";
import NewSupplierDetailsPage from "@/pages/NewSupplierDetailsPage";
import ReportsPage from "@/pages/ReportsPage";
import MembersPage from "@/pages/MembersPage";
import ActivityPage from "@/pages/ActivityPage";
import AccessRequestsPage from "@/pages/AccessRequestsPage";
import EmailTasksPage from "@/pages/EmailTasksPage";
import DailyTasksPage from "@/pages/DailyTasksPage";
import SupplierDetailsPage from "@/pages/SupplierDetailsPage";
import VaultPage from "@/pages/VaultPage";
import DealsPage from "@/pages/DealsPage";
import CompliancePage from "@/pages/CompliancePage";
import NotificationsPage from "@/pages/NotificationsPage";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      // Automatically refetch notifications whenever any mutation succeeds
      // This keeps the notification bell "real-time" across the entire app
      queryClient.invalidateQueries({ queryKey: ["notifications"] });
    },
  }),
});

function ProtectedRoute() {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

/** Redirects non-admins back to home instead of showing admin pages */
function AdminRoute() {
  const { isAdmin, isLoading } = useAuth();
  if (isLoading) return null;
  if (!isAdmin) return <Navigate to="/" replace />;
  return <Outlet />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route element={<ProtectedRoute />}>
              <Route element={<AppLayout />}>
                {/* Open to all logged-in users */}
                <Route index element={<DashboardPage />} />

                {/* Visible to all in sidebar; content gated by PermissionGate */}
                <Route
                  path="buyers"
                  element={
                    <PermissionGate permission="buyers">
                      <BuyersPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="suppliers"
                  element={<Navigate to="/suppliers/signed-contract" replace />}
                />
                <Route
                  path="suppliers/signed-contract"
                  element={
                    <PermissionGate permission="suppliers">
                      <SignedContractSuppliersPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="suppliers/signed-contract/:id"
                  element={
                    <PermissionGate permission="suppliers">
                      <SupplierDetailsPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="suppliers/old"
                  element={
                    <PermissionGate permission="suppliers">
                      <OldSuppliersPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="suppliers/new"
                  element={
                    <PermissionGate permission="suppliers">
                      <NewSuppliersPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="suppliers/new/:id"
                  element={
                    <PermissionGate permission="suppliers">
                      <NewSupplierDetailsPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="reports"
                  element={
                    <PermissionGate permission="reports">
                      <ReportsPage />
                    </PermissionGate>
                  }
                />
                <Route
                  path="vault"
                  element={
                    <PermissionGate permission="vault">
                      <VaultPage />
                    </PermissionGate>
                  }
                />

                <Route
                  path="email-tasks"
                  element={
                    <PermissionGate permission="task_tracker">
                      <EmailTasksPage />
                    </PermissionGate>
                  }
                />

                <Route
                  path="daily-tasks"
                  element={
                    <PermissionGate permission="task_tracker">
                      <DailyTasksPage />
                    </PermissionGate>
                  }
                />
                <Route path="deals" element={<DealsPage />} />
                <Route path="compliance" element={<CompliancePage />} />
                <Route path="notifications" element={<NotificationsPage />} />

                {/* Admin-only routes */}
                <Route element={<AdminRoute />}>
                  <Route path="members" element={<MembersPage />} />
                  <Route path="activity" element={<ActivityPage />} />
                  <Route
                    path="access-requests"
                    element={<AccessRequestsPage />}
                  />
                </Route>
              </Route>
            </Route>

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
