import { lazy, useCallback, useEffect, useState } from "react";
import { Link, Navigate, Route, Routes, useLocation } from "react-router-dom";
import "lenis/dist/lenis.css";
import { useAuth } from "./context/AuthContext.jsx";
import { api } from "./lib/api.js";
import SeoHead, { organizationSchema } from "./components/SeoHead.jsx";
import {
  ApiPageLoader,
  BrandedSuspense,
  PageLoader,
} from "./components/PageState.jsx";
import { getPostLoginPath } from "./lib/navigation.js";
import {
  hasCompletedMainIntro,
  markMainIntroCompleted,
} from "./lib/loading-session.js";

const EduRiseLanding = lazy(() => import("./components/EduRiseLanding.jsx"));
const ApplicationLayout = lazy(() => import("./components/SiteChrome.jsx"));
const ResourceViewerPage = lazy(() => import("./pages/ResourceViewerPage.jsx"));
const AiPracticePage = lazy(() => import("./pages/AiPracticePage.jsx"));
const AdminDashboardPage = lazy(() => import("./pages/AdminDashboardPage.jsx"));
const NotificationsPage = lazy(() => import("./pages/NotificationsPage.jsx"));
const AdvertisingDisclosurePage = lazy(() => import("./pages/AdvertisingDisclosurePage.jsx"));
const PyqsPage = lazy(() => import("./pages/PyqsPage.jsx"));
const ResourceSearchPage = lazy(() => import("./pages/ResourceSearchPage.jsx"));
const LibraryPage = lazy(() => import("./pages/LibraryPage.jsx"));
const SyllabusAnalysisPage = lazy(() => import("./pages/SyllabusAnalysisPage.jsx"));
const UploadPage = lazy(() => import("./pages/UploadPage.jsx"));
const TermsPage = lazy(() => import("./pages/TermsPage.jsx"));
const ProfilePage = lazy(() => import("./pages/ProfilePage.jsx"));
const PublicResourcePage = lazy(() => import("./pages/PublicSeoPages.jsx")
  .then((module) => ({ default: module.PublicResourcePage })));
const SubjectDirectoryPage = lazy(() => import("./pages/PublicSeoPages.jsx")
  .then((module) => ({ default: module.SubjectDirectoryPage })));
const SubjectPage = lazy(() => import("./pages/PublicSeoPages.jsx")
  .then((module) => ({ default: module.SubjectPage })));
const TopicPage = lazy(() => import("./pages/PublicSeoPages.jsx")
  .then((module) => ({ default: module.TopicPage })));
const LoginPage = lazy(() => import("./pages/AuthPages.jsx")
  .then((module) => ({ default: module.LoginPage })));
const RegisterPage = lazy(() => import("./pages/AuthPages.jsx")
  .then((module) => ({ default: module.RegisterPage })));
const ForgotPasswordPage = lazy(() => import("./pages/AuthPages.jsx")
  .then((module) => ({ default: module.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import("./pages/AuthPages.jsx")
  .then((module) => ({ default: module.ResetPasswordPage })));
const VerifyEmailPage = lazy(() => import("./pages/AuthPages.jsx")
  .then((module) => ({ default: module.VerifyEmailPage })));
const ResendVerificationPage = lazy(() => import("./pages/AuthPages.jsx")
  .then((module) => ({ default: module.ResendVerificationPage })));

export default function App() {
  const [introPhase, setIntroPhase] = useState(() =>
    hasCompletedMainIntro() ? "done" : "entering",
  );
  const completeIntroAnimation = useCallback(() => {
    setIntroPhase((phase) => (phase === "entering" ? "exiting" : phase));
  }, []);
  const completeIntroExit = useCallback(() => {
    markMainIntroCompleted();
    setIntroPhase("done");
  }, []);

  useEffect(() => {
    if (introPhase === "done") return undefined;
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const transitionDelay =
      introPhase === "entering"
        ? prefersReducedMotion ? 100 : 1200
        : 450;
    const timer = window.setTimeout(
      introPhase === "entering" ? completeIntroAnimation : completeIntroExit,
      transitionDelay,
    );
    return () => window.clearTimeout(timer);
  }, [completeIntroAnimation, completeIntroExit, introPhase]);

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
    <>
      <RouteSeoDefaults />
      <Routes>
        <Route
          path="/"
          element={(
            <BrandedSuspense label="Setting up your learning space…">
              <EduRiseLanding />
            </BrandedSuspense>
          )}
        />
        <Route path="/subjects" element={<BrandedSuspense label="Loading subjects…"><SubjectDirectoryPage /></BrandedSuspense>} />
        <Route path="/subjects/:slug/topics/:topicSlug" element={<BrandedSuspense label="Loading topic resources…"><TopicPage /></BrandedSuspense>} />
        <Route path="/subjects/:slug" element={<BrandedSuspense label="Loading subject resources…"><SubjectPage /></BrandedSuspense>} />
        <Route path="/notes/:resourceId" element={<BrandedSuspense label="Loading published notes…"><PublicResourcePage type="note" /></BrandedSuspense>} />
        <Route path="/notes/:resourceId/:slug" element={<BrandedSuspense label="Loading published notes…"><PublicResourcePage type="note" /></BrandedSuspense>} />
        <Route path="/question-papers/:resourceId" element={<BrandedSuspense label="Loading published question paper…"><PublicResourcePage type="pyq" /></BrandedSuspense>} />
        <Route path="/question-papers/:resourceId/:slug" element={<BrandedSuspense label="Loading published question paper…"><PublicResourcePage type="pyq" /></BrandedSuspense>} />
        <Route element={<BrandedSuspense label="Opening your learning space…"><ApplicationLayout /></BrandedSuspense>}>
        <Route path="/pyqs" element={<BrandedSuspense label="Loading question papers…"><PyqsPage /></BrandedSuspense>} />
        <Route path="/search" element={<BrandedSuspense label="Loading resources…"><ResourceSearchPage /></BrandedSuspense>} />
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
        <Route path="/advertising" element={<BrandedSuspense label="Loading page…"><AdvertisingDisclosurePage /></BrandedSuspense>} />
        <Route path="/terms" element={<BrandedSuspense label="Loading page…"><TermsPage /></BrandedSuspense>} />
        <Route path="/library" element={<ProtectedPage><BrandedSuspense label="Loading your library…"><LibraryPage /></BrandedSuspense></ProtectedPage>} />
        <Route
          path="/practice"
          element={(
            <ProtectedPage>
              <BrandedSuspense label="Preparing your AI practice session…">
                <AiPracticePage />
              </BrandedSuspense>
            </ProtectedPage>
          )}
        />
        <Route path="/uploads" element={<ProtectedPage><BrandedSuspense label="Loading uploads…"><UploadPage /></BrandedSuspense></ProtectedPage>} />
        <Route path="/upload" element={<ProtectedPage><BrandedSuspense label="Loading uploads…"><UploadPage /></BrandedSuspense></ProtectedPage>} />
        <Route path="/notifications" element={<AuthenticatedPage><BrandedSuspense label="Loading notifications…"><NotificationsPage /></BrandedSuspense></AuthenticatedPage>} />
        <Route path="/syllabus" element={<ProtectedPage><BrandedSuspense label="Loading syllabus…"><SyllabusAnalysisPage /></BrandedSuspense></ProtectedPage>} />
        <Route path="/dashboard" element={<Navigate to="/search" replace />} />
        <Route path="/profile/:username" element={<BrandedSuspense label="Loading profile…"><ProfilePage /></BrandedSuspense>} />
        <Route path="/admin" element={<ProtectedPage admin><BrandedSuspense label="Loading admin dashboard…"><AdminDashboardPage /></BrandedSuspense></ProtectedPage>} />
        <Route path="/admin/dashboard" element={<ProtectedPage admin><BrandedSuspense label="Loading admin dashboard…"><AdminDashboardPage /></BrandedSuspense></ProtectedPage>} />
        </Route>
        <Route path="/login" element={<BrandedSuspense label="Loading sign in…"><LoginPage /></BrandedSuspense>} />
        <Route path="/admin/login" element={<BrandedSuspense label="Loading sign in…"><LoginPage admin /></BrandedSuspense>} />
        <Route path="/register" element={<BrandedSuspense label="Loading registration…"><RegisterPage /></BrandedSuspense>} />
        <Route path="/forgot-password" element={<BrandedSuspense label="Loading password recovery…"><ForgotPasswordPage /></BrandedSuspense>} />
        <Route path="/reset-password" element={<BrandedSuspense label="Loading password reset…"><ResetPasswordPage /></BrandedSuspense>} />
        <Route path="/verify-email" element={<BrandedSuspense label="Loading verification…"><VerifyEmailPage /></BrandedSuspense>} />
        <Route path="/resend-verification" element={<BrandedSuspense label="Loading verification…"><ResendVerificationPage /></BrandedSuspense>} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <ApiPageLoader />
      {introPhase !== "done" && (
        <PageLoader
          exiting={introPhase === "exiting"}
          fullScreen
          label="Welcome to Topper…"
          onAnimationComplete={completeIntroAnimation}
          onExitComplete={completeIntroExit}
        />
      )}
    </>
  );
}

function NotFoundPage() {
  return (
    <>
      <SeoHead
        canonicalPath={false}
        description="The requested Topper page could not be found."
        robots="noindex,nofollow"
        title="Page not found | Topper"
      />
      <main className="grid min-h-screen place-items-center bg-[#fff8eb] px-5 text-center text-[#171717]">
        <section>
          <p className="text-sm font-bold uppercase tracking-widest text-brand">404</p>
          <h1 className="mt-2 text-3xl font-black">Page not found</h1>
          <p className="mt-3 text-slate-600">This page may have moved or is no longer available.</p>
          <Link className="mt-5 inline-block rounded-xl bg-brand px-5 py-3 font-bold text-white" to="/">Return to Topper</Link>
        </section>
      </main>
    </>
  );
}

function RouteSeoDefaults() {
  const { pathname } = useLocation();
  const pages = {
    "/": {
      title: "Topper — Free Study Notes and Previous-Year Papers",
      description: "Explore free student-shared study notes, subject resources and previous-year question papers on Topper. Learn together. Rise together.",
      robots: "index,follow",
      structuredData: organizationSchema(),
    },
    "/pyqs": {
      title: "Previous-Year Question Papers | Topper",
      description: "Browse published previous-year question papers by subject, semester, university and examination year on Topper.",
      robots: "index,follow",
    },
    "/subjects": {
      title: "Study Subjects, Notes and Question Papers | Topper",
      description: "Browse subject areas with published student notes and previous-year question papers on Topper.",
      robots: "index,follow",
    },
    "/terms": {
      title: "Terms and Community Guidelines | Topper",
      description: "Read Topper's community guidelines for sharing and discovering student academic resources.",
      robots: "index,follow",
    },
    "/advertising": {
      title: "Advertising and Privacy Information | Topper",
      description: "Learn how advertising works on Topper and review information about privacy, cookies and ad controls.",
      robots: "index,follow",
    },
  };
  const page = pages[pathname] ?? {
    title: "Topper | Student Learning Resources",
    description: "Discover student-shared learning resources on Topper.",
    robots: "noindex,follow",
  };

  return (
    <SeoHead
      canonicalPath={pathname}
      description={page.description}
      pathname={pathname}
      robots={page.robots}
      structuredData={page.structuredData}
      title={page.title}
    />
  );
}

function ProtectedPage({ children, admin = false }) {
  const { user, loading, authError } = useAuth();

  if (loading) {
    return <PageLoader label="Loading your account…" />;
  }
  if (authError) {
    return (
      <>
        <p className="ed-page-error grid min-h-screen place-items-center px-5 text-center" role="alert">{authError}</p>
      </>
    );
  }
  if (!user) {
    return <Navigate to={admin ? "/admin/login" : "/login"} replace />;
  }
  if ((admin && user.role !== "admin") || (!admin && user.role !== "user")) {
    return <Navigate to={getPostLoginPath(user)} replace />;
  }

  return children;
}

function AuthenticatedPage({ children }) {
  const { user, loading, authError } = useAuth();
  if (loading) {
    return <PageLoader label="Loading your account…" />;
  }
  if (authError) {
    return (
      <>
        <p className="ed-page-error grid min-h-screen place-items-center px-5 text-center" role="alert">{authError}</p>
      </>
    );
  }
  if (!user) {
    return <Navigate to="/login" replace />;
  }
  return children;
}
