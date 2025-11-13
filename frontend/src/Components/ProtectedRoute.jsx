import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useMsal } from "@azure/msal-react";
import { InteractionStatus } from "@azure/msal-browser";
import { useAuth } from "../Components/AuthContext";

function ProtectedRoute({
  children,
  allow,
  redirectTo = "/login",
  denyTo = "/submissions",
  fallbackInProgress = null,
}) {
  const { user, isAuthenticated } = useAuth();
  const { inProgress } = useMsal();
  const location = useLocation();

  if (inProgress !== InteractionStatus.None) {
    return fallbackInProgress || <div>Loading…</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  if (!allow || (Array.isArray(allow) && allow.length === 0)) {
    return children;
  }

  const role = String(user?.role || "").toLowerCase();
  const ok = allow.some(a => role.includes(a.toLowerCase()));
  return ok ? children : <Navigate to={denyTo} replace />;
}

export default ProtectedRoute;

// --- PublicOnlyRoute ---
export function PublicOnlyRoute({ children }) {
  const { user, isAuthenticated } = useAuth();
  const { inProgress } = useMsal();

  if (inProgress !== InteractionStatus.None) return null;
  if (!isAuthenticated) return children;

  const role = String(user?.role || "").toLowerCase();
  const dest =
    role.includes("admin") || role.includes("hr") || role.includes("manager")
      ? "/dashboard"
      : "/tasks";

  return <Navigate to={dest} replace />;
}
