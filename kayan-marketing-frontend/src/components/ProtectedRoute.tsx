import type { ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuthStore } from "../stores/auth-store";
import { ROUTES } from "../constants/routes";

interface Props {
  children: ReactNode;
}

export function ProtectedRoute({ children }: Props): JSX.Element {
  const session = useAuthStore((state) => state.session);
  const isLoading = useAuthStore((state) => state.isLoading);
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-warmbg text-ink-2">
        Loading…
      </div>
    );
  }

  if (!session) {
    // Preserve where the user actually wanted to go so the login flow can
    // return them there once auth completes (instead of always landing on
    // Today). Captures the full location object — pathname + search +
    // hash — so deep-linked URLs survive the round trip.
    return <Navigate to={ROUTES.LOGIN} state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
