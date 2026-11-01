import { useEffect, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import EditProfileDialog from "../components/dashboard/EditProfileDialog.jsx";
import NotesUpload from "../components/dashboard/NotesUpload.jsx";
import CommunityReports from "../components/dashboard/CommunityReports.jsx";
import ProfileCard from "../components/dashboard/ProfileCard.jsx";
import RecentActivity from "../components/dashboard/RecentActivity.jsx";
import SavedResources from "../components/dashboard/SavedResources.jsx";
import StatCard from "../components/dashboard/StatCard.jsx";
import RewardCenter from "../components/RewardCenter.jsx";
import AdminRewardsPanel from "../components/AdminRewardsPanel.jsx";
import NotificationBell from "../components/NotificationBell.jsx";

const statDefinitions = [
  ["totalUploadedNotes", "Uploaded notes", "Notes shared by you", "indigo"],
  ["totalUploadedPyqs", "Uploaded PYQs", "Past papers shared by you", "blue"],
  ["approvedResources", "Approved resources", "Approved by moderators", "green"],
  ["rejectedResources", "Rejected resources", "Resources needing changes", "red"],
  ["pendingVerification", "Pending verification", "Awaiting review", "amber"],
  ["savedResources", "Saved resources", "Approved resources saved", "slate"],
];

function initialsErrorMessage(error) {
  return error.response?.data?.message ?? error.message ?? "Something went wrong.";
}

export default function DashboardPage({ admin = false }) {
  const { user, signOut, updateUser } = useAuth();
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(!admin);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (admin) return;

    let active = true;
    api
      .get("/dashboard")
      .then(({ data }) => {
        if (active) setDashboard(data);
      })
      .catch((requestError) => {
        if (active) setError(initialsErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [admin]);

  if (user && (user.role === "admin") !== admin) {
    return <Navigate to={user.role === "admin" ? "/admin" : "/dashboard"} replace />;
  }

  async function handleSignOut() {
    setError("");
    try {
      await signOut();
      navigate("/login", { replace: true });
    } catch (requestError) {
      setError(initialsErrorMessage(requestError));
    }
  }

  async function handleProfileSave(updates) {
    const { data } = await api.patch("/dashboard/profile", updates);
    setDashboard((current) => ({ ...current, profile: data.profile }));
    updateUser(data.profile);
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-8 sm:py-4">
          <Link className="text-xl font-extrabold tracking-tight text-ink" to="/">
            Study<span className="text-brand">Share</span>
          </Link>
          <nav aria-label="Resource navigation" className="order-3 flex w-full flex-wrap gap-1 border-t border-slate-100 pt-2 sm:order-none sm:ml-4 sm:w-auto sm:flex-1 sm:border-0 sm:pt-0">
            <Link
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-brand sm:text-sm"
              to="/pyqs"
            >
              Free PYQs
            </Link>
            <Link
              className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-brand sm:text-sm"
              to="/search"
            >
              Search resources
            </Link>
            {!admin && (
              <>
                <Link
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-brand sm:text-sm"
                  to="/syllabus"
                >
                  Analyze syllabus
                </Link>
                <Link
                  className="rounded-xl px-3 py-2 text-xs font-semibold text-slate-600 hover:bg-indigo-50 hover:text-brand sm:text-sm"
                  to="/library"
                >
                  My library
                </Link>
              </>
            )}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <button
              className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 sm:px-4 sm:text-sm"
              onClick={handleSignOut}
              type="button"
            >
              Sign out
            </button>
            <NotificationBell />
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 py-8 sm:px-8 sm:py-12">
        <div className="relative mb-7 overflow-hidden rounded-3xl bg-gradient-to-br from-ink via-[#253372] to-indigo-700 px-5 py-7 text-white shadow-[0_24px_70px_-35px_rgba(30,41,59,0.6)] sm:px-8 sm:py-9">
          <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-24 size-72 rounded-full border-[36px] border-white/[0.06]" />
          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.18em] text-indigo-200">
              {admin ? "Platform administration" : "Your learning workspace"}
            </p>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight sm:text-4xl">
              {admin ? `Welcome, ${user?.fullName}` : `Welcome back, ${dashboard?.profile?.fullName ?? user?.fullName}`}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100/85 sm:text-base">
              {admin
                ? "Review resources, support contributors, and keep the academic community thriving."
                : "Your profile, academic resources, and contributions all in one place."}
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-5 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">
            {error}
          </p>
        )}

        {admin ? (
          <div className="space-y-6">
            <AdminPyqReview />
            <CommunityReports admin />
            <AdminRewardsPanel />
          </div>
        ) : loading ? (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            Loading your dashboard…
          </p>
        ) : dashboard ? (
          <div className="space-y-7">
            <ProfileCard profile={dashboard.profile} onEdit={() => setEditing(true)} />
            <RewardCenter />
            <NotesUpload profile={dashboard.profile} />
            <CommunityReports />

            <section aria-label="Academic contribution statistics">
              <div className="mb-4">
                <h2 className="text-lg font-bold text-ink">Your contributions</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Counts reflect resources currently recorded for your account.
                </p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {statDefinitions.map(([key, label, description, tone]) => (
                  <StatCard
                    description={description}
                    key={key}
                    label={label}
                    tone={tone}
                    value={dashboard.stats[key]}
                  />
                ))}
              </div>
            </section>

            <div className="grid gap-5 lg:grid-cols-2">
              <RecentActivity items={dashboard.recentActivity} />
              <SavedResources resources={dashboard.savedResources} />
            </div>
          </div>
        ) : (
          <p className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600">
            Your dashboard could not be loaded.
          </p>
        )}
      </section>

      {editing && dashboard && (
        <EditProfileDialog
          onClose={() => setEditing(false)}
          onSave={handleProfileSave}
          profile={dashboard.profile}
        />
      )}
    </main>
  );
}

function AdminPyqReview() {
  const [pyqs, setPyqs] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  async function loadPending() {
    setError("");
    try {
      const { data } = await api.get("/pyqs/review");
      setPyqs(data.pyqs);
    } catch (requestError) {
      setError(initialsErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPending();
  }, []);

  async function review(pyq, approvalStatus) {
    setError("");
    try {
      await api.patch(`/pyqs/${pyq.id}/approval`, { approvalStatus });
      setPyqs((current) => current.filter((item) => item.id !== pyq.id));
    } catch (requestError) {
      setError(initialsErrorMessage(requestError));
    }
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 className="text-xl font-bold text-ink">PYQ approval queue</h2>
      <p className="mt-1 text-sm text-slate-600">
        Review submissions before they become visible in public search.
      </p>
      {error && <p className="mt-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-700" role="alert">{error}</p>}
      {loading ? (
        <p className="mt-5 text-sm text-slate-600">Loading submissions…</p>
      ) : pyqs.length === 0 ? (
        <p className="mt-5 text-sm text-slate-600">No question papers are awaiting review.</p>
      ) : (
        <div className="mt-5 divide-y divide-slate-100">
          {pyqs.map((pyq) => (
            <article className="flex flex-col justify-between gap-4 py-4 sm:flex-row sm:items-center" key={pyq.id}>
              <div>
                <h3 className="font-bold text-ink">{pyq.subject} · {pyq.examinationYear} {pyq.examType}</h3>
                <p className="mt-1 text-sm text-slate-600">
                  {pyq.university} · {pyq.college} · Semester {pyq.semester}
                </p>
                <p className="mt-1 text-xs text-slate-500">
                  Uploaded by {pyq.uploadedBy}{pyq.uploaderEmail ? ` (${pyq.uploaderEmail})` : ""}
                </p>
                <a
                  className="mt-2 inline-block text-sm font-semibold text-brand hover:underline"
                  href={pyq.reviewUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  Review PDF
                </a>
              </div>
              <div className="flex gap-2">
                <button
                  className="rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                  onClick={() => review(pyq, "approved")}
                  type="button"
                >
                  Approve
                </button>
                <button
                  className="rounded-xl border border-rose-200 px-4 py-2 text-sm font-bold text-rose-700 hover:bg-rose-50"
                  onClick={() => review(pyq, "rejected")}
                  type="button"
                >
                  Reject
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
