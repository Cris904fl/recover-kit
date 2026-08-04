import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { isAuthenticated } from "@/lib/auth";

/** Envuelve rutas privadas: sin token, redirige a /login. */
export function RequireAuth({ children }: { children: ReactNode }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}
