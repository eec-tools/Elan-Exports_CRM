import type { ReactNode } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { AccessDeniedPage } from "@/components/AccessDeniedPage";

interface PermissionGateProps {
  permission?: string;
  editOnly?: boolean;
  adminOnly?: boolean;
  children: ReactNode;
  fallback?: ReactNode;
}

/**
 * Conditionally renders children based on user permissions.
 *
 * Route-level (no editOnly):
 *   - permission denied → shows AccessDeniedPage with request form
 *   - adminOnly denied  → renders fallback (default null)
 *
 * Component-level (editOnly):
 *   - permission denied → renders fallback (default null, hides buttons)
 */
export function PermissionGate({
  permission,
  editOnly = false,
  adminOnly = false,
  children,
  fallback = null,
}: PermissionGateProps) {
  const { isAdmin, hasPermission, hasEditPermission } = useAuth();

  if (adminOnly && !isAdmin) return <>{fallback}</>;

  if (permission && editOnly) {
    if (!hasEditPermission(permission)) return <>{fallback}</>;
  }

  if (permission && !editOnly) {
    if (!hasPermission(permission)) return <AccessDeniedPage />;
  }

  return <>{children}</>;
}
