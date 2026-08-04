import { createBrowserRouter, Navigate } from "react-router-dom";
import { AppShell } from "@/components/ui/AppShell";
import { RequireAuth } from "@/components/ui/RequireAuth";
import { LoginPage } from "@/pages/LoginPage";
import { RegisterPage } from "@/pages/RegisterPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { CartsPage } from "@/pages/CartsPage";
import { SequencesPage } from "@/pages/SequencesPage";
import { AnalyticsPage } from "@/pages/AnalyticsPage";

export const router = createBrowserRouter([
  { path: "/login", element: <LoginPage /> },
  { path: "/register", element: <RegisterPage /> },
  {
    path: "/",
    element: (
      <RequireAuth>
        <AppShell />
      </RequireAuth>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },
      { path: "dashboard", element: <DashboardPage /> },
      { path: "carts", element: <CartsPage /> },
      { path: "sequences", element: <SequencesPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
    ],
  },
]);
