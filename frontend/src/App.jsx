import { lazy, Suspense, useEffect } from "react";
import { Link, Navigate, Route, Routes } from "react-router-dom";
import "lenis/dist/lenis.css";
import Panel from "./components/Panel.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { api } from "./lib/api.js";
import DashboardPage from "./pages/DashboardPage.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import AdvertisingDisclosurePage from "./pages/AdvertisingDisclosurePage.jsx";
import PyqsPage from "./pages/PyqsPage.jsx";
import ResourceSearchPage from "./pages/ResourceSearchPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import SyllabusAnalysisPage from "./pages/SyllabusAnalysisPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResendVerificationPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./pages/AuthPages.jsx";

const EduRiseLanding = lazy(() => import("./components/EduRiseLanding.jsx"));

export default function App() {
  useEffect(() => {
    let active = true;
    let stopSmoothScroll;
    import("./lib/smoothScroll.js").then(({ startSmoothScroll }) => {
      if (active) stopSmoothScroll = startSmoothScroll();
    });
    return () => {
      active = false;
      stopSmoothScroll?.();
    };
  }, []);

  return (
    <Routes>
      <Route
        path="/"
        element={(
          <Suspense fallback={<p className="grid min-h-screen place-items-center bg-[#fff9ec] font-bold text-[#171717]">Setting up your study space…</p>}>
            <EduRiseLanding />
          </Suspense>
        )}
      />
      <Route path="/pyqs" element={<PyqsPage />} />
      <Route path="/search" element={<ResourceSearchPage />} />
      <Route path="/advertising" element={<AdvertisingDisclosurePage />} />
      <Route path="/terms" element={<TermsPage />} />
      <Route path="/library" element={<ProtectedPage><LibraryPage /></ProtectedPage>} />
      <Route path="/notifications" element={<AuthenticatedPage><NotificationsPage /></AuthenticatedPage>} />
      <Route path="/syllabus" element={<ProtectedPage><SyllabusAnalysisPage /></ProtectedPage>} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<LoginPage admin />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/resend-verification" element={<ResendVerificationPage />} />
      <Route path="/dashboard" element={<ProtectedPage><DashboardPage /></ProtectedPage>} />
      <Route path="/admin" element={<ProtectedPage admin><AdminDashboardPage /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedPage({ children, admin = false }) {
  const { user, loading, authError } = useAuth();

  if (loading) {
    return <p className="grid min-h-screen place-items-center text-slate-600">Loading your account…</p>;
  }
  if (authError) {
    return <p className="grid min-h-screen place-items-center px-5 text-center text-rose-700">{authError}</p>;
  }
  if (!user) {
    return <Navigate to={admin ? "/admin/login" : "/login"} replace />;
  }
  if ((user.role === "admin") !== admin) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  return children;
}

function AuthenticatedPage({ children }) {
  const { user, loading, authError } = useAuth();
  if (loading) {
    return <p className="grid min-h-screen place-items-center text-slate-600">Loading your account…</p>;
  }
  if (authError) {
    return <p className="grid min-h-screen place-items-center px-5 text-center text-rose-700">{authError}</p>;
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
