import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AppShell } from "./components/AppShell";
import { useAuthInit } from "./hooks/use-auth";
import { ROUTES } from "./constants/routes";
import LoginPage from "./pages/Login";
import TodayPage from "./pages/Today";
import CalendarPage from "./pages/Calendar";
import MarketingCalendarPage from "./pages/MarketingCalendar";
import TopicsPage from "./pages/Topics";
import CampaignsPage from "./pages/Campaigns";
import CampaignDetailPage from "./pages/CampaignDetail";
import InfluencersPage from "./pages/Influencers";
import InfluencerDetailPage from "./pages/InfluencerDetail";
import PendingVerificationsPage from "./pages/PendingVerifications";
import CreatorPortalPage from "./pages/CreatorPortal";
import PerformancePage from "./pages/Performance";
import ReportsPage from "./pages/Reports";
import GoalsPage from "./pages/Goals";
import BudgetPage from "./pages/Budget";
import SettingsPage from "./pages/Settings";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1 },
  },
});

function AppRoutes(): JSX.Element {
  useAuthInit();

  return (
    <Routes>
      <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      <Route
        path={ROUTES.CREATOR_PORTAL(":token")}
        element={<CreatorPortalPage />}
      />
      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path={ROUTES.TODAY} element={<TodayPage />} />
        <Route path={ROUTES.CALENDAR} element={<CalendarPage />} />
        <Route
          path={ROUTES.MARKETING_CALENDAR}
          element={<MarketingCalendarPage />}
        />
        <Route path={ROUTES.TOPICS} element={<TopicsPage />} />
        <Route path={ROUTES.CAMPAIGNS} element={<CampaignsPage />} />
        <Route path="/campaigns/:id" element={<CampaignDetailPage />} />
        <Route path={ROUTES.INFLUENCERS} element={<InfluencersPage />} />
        {/* Verifications must come BEFORE the parameterized :id route
            so /influencers/verifications isn't captured as id="verifications". */}
        <Route
          path={ROUTES.INFLUENCER_VERIFICATIONS}
          element={<PendingVerificationsPage />}
        />
        <Route path="/influencers/:id" element={<InfluencerDetailPage />} />
        <Route path={ROUTES.PERFORMANCE} element={<PerformancePage />} />
        <Route path={ROUTES.REPORTS} element={<ReportsPage />} />
        <Route path={ROUTES.GOALS} element={<GoalsPage />} />
        <Route path={ROUTES.BUDGET} element={<BudgetPage />} />
        <Route path={ROUTES.SETTINGS} element={<SettingsPage />} />
        <Route path="/" element={<Navigate to={ROUTES.TODAY} replace />} />
      </Route>
    </Routes>
  );
}

export default function App(): JSX.Element {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </QueryClientProvider>
  );
}
