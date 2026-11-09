import { lazy, useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import "lenis/dist/lenis.css";
import Panel from "./components/Panel.jsx";
import { useAuth } from "./context/AuthContext.jsx";
import { api } from "./lib/api.js";
import ApplicationLayout from "./components/SiteChrome.jsx";
import {
  BrandedSuspense,
  useBrandedLoadingScreen,
} from "./components/PageState.jsx";
import AdminDashboardPage from "./pages/AdminDashboardPage.jsx";
import NotificationsPage from "./pages/NotificationsPage.jsx";
import AdvertisingDisclosurePage from "./pages/AdvertisingDisclosurePage.jsx";
import PyqsPage from "./pages/PyqsPage.jsx";
import ResourceSearchPage from "./pages/ResourceSearchPage.jsx";
import LibraryPage from "./pages/LibraryPage.jsx";
import SyllabusAnalysisPage from "./pages/SyllabusAnalysisPage.jsx";
import UploadPage from "./pages/UploadPage.jsx";
import TermsPage from "./pages/TermsPage.jsx";
import ProfilePage from "./pages/ProfilePage.jsx";
import { getPostLoginPath } from "./lib/navigation.js";
import {
  ForgotPasswordPage,
  LoginPage,
  RegisterPage,
  ResendVerificationPage,
  ResetPasswordPage,
  VerifyEmailPage,
} from "./pages/AuthPages.jsx";

const EduRiseLanding = lazy(() => import("./components/EduRiseLanding.jsx"));
const ResourceViewerPage = lazy(() => import("./pages/ResourceViewerPage.jsx"));

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
          <BrandedSuspense label="Setting up your learning space…">
            <EduRiseLanding />
          </BrandedSuspense>
        )}
      />
      <Route element={<ApplicationLayout />}>
        <Route path="/pyqs" element={<PyqsPage />} />
        <Route path="/search" element={<ResourceSearchPage />} />
        <Route
          path="/resources/:resourceType/:resourceId"
          element={(
            <AuthenticatedPage>
              <BrandedSuspense label="Opening your study resource…">
                <ResourceViewerPage />
              </BrandedSuspense>
            </AuthenticatedPage>
          )}
        />
        <Route path="/advertising" element={<AdvertisingDisclosurePage />} />
        <Route path="/terms" element={<TermsPage />} />
        <Route path="/library" element={<ProtectedPage><LibraryPage /></ProtectedPage>} />
        <Route path="/uploads" element={<ProtectedPage><UploadPage /></ProtectedPage>} />
        <Route path="/upload" element={<ProtectedPage><UploadPage /></ProtectedPage>} />
        <Route path="/notifications" element={<AuthenticatedPage><NotificationsPage /></AuthenticatedPage>} />
        <Route path="/syllabus" element={<ProtectedPage><SyllabusAnalysisPage /></ProtectedPage>} />
        <Route path="/dashboard" element={<Navigate to="/search" replace />} />
        <Route path="/profile/:username" element={<ProfilePage />} />
        <Route path="/admin" element={<ProtectedPage admin><AdminDashboardPage /></ProtectedPage>} />
        <Route path="/admin/dashboard" element={<ProtectedPage admin><AdminDashboardPage /></ProtectedPage>} />
      </Route>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/admin/login" element={<LoginPage admin />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/resend-verification" element={<ResendVerificationPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function ProtectedPage({ children, admin = false }) {
  const { user, loading, authError } = useAuth();
  const loadingScreen = useBrandedLoadingScreen(loading, "Loading your account…");

  if (loading) {
    return loadingScreen;
  }
  if (authError) {
    return (
      <>
        <p className="ed-page-error grid min-h-screen place-items-center px-5 text-center" role="alert">{authError}</p>
        {loadingScreen}
      </>
    );
  }
  if (!user) {
    return <><Navigate to={admin ? "/admin/login" : "/login"} replace />{loadingScreen}</>;
  }
  if ((admin && user.role !== "admin") || (!admin && user.role !== "user")) {
    return <><Navigate to={getPostLoginPath(user)} replace />{loadingScreen}</>;
  }

  return <>{children}{loadingScreen}</>;
}

function AuthenticatedPage({ children }) {
  const { user, loading, authError } = useAuth();
  const loadingScreen = useBrandedLoadingScreen(loading, "Loading your account…");
  if (loading) {
    return loadingScreen;
  }
  if (authError) {
    return (
      <>
        <p className="ed-page-error grid min-h-screen place-items-center px-5 text-center" role="alert">{authError}</p>
        {loadingScreen}
      </>
    );
  }
  if (!user) {
    return <><Navigate to="/login" replace />{loadingScreen}</>;
  }
  return <>{children}{loadingScreen}</>;
}
