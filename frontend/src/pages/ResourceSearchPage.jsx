import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import NotificationBell from "../components/NotificationBell.jsx";
import AdUnit from "../components/AdUnit.jsx";
import { EmptyState, PageLoader } from "../components/PageState.jsx";

const initialFilters = {
  q: "",
  department: "",
  university: "",
  college: "",
  batch: "",
  semester: "",
  subject: "",
  unit: "",
  topic: "",
  resourceType: "",
  sort: "recent",
};
const pageSize = 12;

function errorText(error) {
  return error.response?.data?.message ?? error.message ?? "Search failed.";
}

function FilterInput({ label, name, onChange, value, ...props }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-semibold text-slate-700">{label}</span>
      <input
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
        name={name}
        onChange={onChange}
        value={value}
        {...props}
      />
    </label>
  );
}

export default function ResourceSearchPage() {
  const { user } = useAuth();
  const [filters, setFilters] = useState(initialFilters);
  const [page, setPage] = useState(1);
  const [resources, setResources] = useState([]);
  const [pagination, setPagination] = useState({ pages: 0, total: 0 });
  const [suggestions, setSuggestions] = useState([]);
  const [focusedSearch, setFocusedSearch] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [voting, setVoting] = useState("");
  const [helpfulVotes, setHelpfulVotes] = useState(() => new Set());
  const [reportTarget, setReportTarget] = useState(null);
  const [reportForm, setReportForm] = useState({
    pageNumber: "1",
    category: "incorrect_definition",
    explanation: "",
    suggestedCorrection: "",
  });
  const [submittingReport, setSubmittingReport] = useState(false);
  const [bookmarkingId, setBookmarkingId] = useState("");

  const searchParams = useMemo(
    () => ({ ...filters, page, limit: pageSize }),
    [filters, page],
  );

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError("");
      api
        .get("/search", { params: searchParams, signal: controller.signal })
        .then(({ data }) => {
          setResources(data.resources);
          setPagination(data.pagination);
        })
        .catch((requestError) => {
          if (requestError.name !== "CanceledError") setError(errorText(requestError));
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, 300);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [searchParams]);

  useEffect(() => {
    const prefix = filters.q.trim();
    if (prefix.length < 2) {
      setSuggestions([]);
      return undefined;
    }
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      api
        .get("/search/suggestions", {
          params: { q: prefix, resourceType: filters.resourceType },
          signal: controller.signal,
        })
        .then(({ data }) => setSuggestions(data.suggestions))
        .catch((requestError) => {
          if (requestError.name !== "CanceledError") setError(errorText(requestError));
        });
    }, 200);
    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [filters.q, filters.resourceType]);

  function updateFilter(event) {
    const { name, value } = event.target;
    setFilters((current) => ({ ...current, [name]: value }));
    setPage(1);
  }

  async function voteHelpful(resource) {
    if (!user || user.role !== "user") {
      setNotice("Sign in with a student account to mark resources helpful.");
      return;
    }
    setVoting(resource.id);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(
        `/search/${resource.type}/${resource.id}/helpful`,
      );
      setResources((current) =>
        current.map((item) =>
          item.id === resource.id && item.type === resource.type
            ? { ...item, helpfulCount: data.helpfulCount }
            : item,
        ),
      );
      setHelpfulVotes((current) => new Set(current).add(`${resource.type}:${resource.id}`));
      setNotice(data.message);
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setVoting("");
    }
  }

  async function toggleBookmark(resource) {
    if (!user || user.role !== "user") {
      setNotice("Sign in with a student account to save resources to your library.");
      return;
    }
    setBookmarkingId(resource.id);
    setError("");
    setNotice("");
    try {
      if (resource.isBookmarked) {
        await api.delete(
          `/library/bookmarks/${resource.type}/${resource.id}`,
        );
      } else {
        await api.post("/library/bookmarks", {
          resourceType: resource.type,
          resourceId: resource.id,
        });
      }
      setResources((current) =>
        current.map((item) =>
          item.id === resource.id && item.type === resource.type
            ? { ...item, isBookmarked: !resource.isBookmarked }
            : item,
        ),
      );
      setNotice(
        resource.isBookmarked
          ? "Resource removed from your library."
          : "Resource saved to your library.",
      );
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setBookmarkingId("");
    }
  }

  function selectSuggestion(value) {
    setFilters((current) => ({ ...current, q: value }));
    setSuggestions([]);
    setFocusedSearch(false);
    setPage(1);
  }

  async function submitMistakeReport(event) {
    event.preventDefault();
    if (!reportTarget) return;
    setSubmittingReport(true);
    setError("");
    setNotice("");
    try {
      const { data } = await api.post(
        `/notes/${reportTarget.id}/reports`,
        reportForm,
      );
      setNotice(data.message);
      setReportTarget(null);
      setReportForm({
        pageNumber: "1",
        category: "incorrect_definition",
        explanation: "",
        suggestedCorrection: "",
      });
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSubmittingReport(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-4 py-3 sm:px-8 sm:py-4">
          <Link className="shrink-0 text-xl font-extrabold tracking-tight text-ink" to="/">
            Study<span className="text-brand">Share</span>
          </Link>
          <nav className="flex w-full flex-wrap items-center gap-1 border-t border-slate-100 pt-2 sm:w-auto sm:justify-end sm:gap-2 sm:border-0 sm:pt-0">
            <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-indigo-50" to="/pyqs">Free PYQs</Link>
            {user?.role === "user" && <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-indigo-50" to="/syllabus">Analyze syllabus</Link>}
            {user ? (
              <>
                {user.role === "user" && <Link className="rounded-xl px-3 py-2 text-sm font-semibold text-brand hover:bg-indigo-50" to="/library">My library</Link>}
                <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" to={user.role === "admin" ? "/admin" : "/dashboard"}>Dashboard</Link>
              </>
            ) : (
              <Link className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700" to="/login">Sign in</Link>
            )}
            {user && <NotificationBell />}
          </nav>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 sm:px-8 sm:py-10">
        <div className="mb-6 rounded-3xl border border-indigo-100 bg-gradient-to-br from-white via-white to-indigo-50 px-5 py-7 shadow-sm sm:mb-8 sm:px-8 sm:py-9">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand sm:text-sm">Approved academic resources</p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">Find what you need to study</h1>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">Search verified notes and approved question papers across subjects, topics, and units.</p>
        </div>

        <div className="grid min-w-0 items-start gap-5 lg:grid-cols-[280px_minmax(0,1fr)] lg:gap-6">
          <aside className="h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="mb-4 font-bold text-ink">Search and filter</h2>
            <div className="space-y-4">
              <div className="relative">
                <FilterInput
                  autoComplete="off"
                  label="Search notes, PYQs, subjects, topics, units"
                  name="q"
                  onChange={updateFilter}
                  onFocus={() => setFocusedSearch(true)}
                  placeholder="Type a subject, topic, or keyword"
                  value={filters.q}
                />
                {focusedSearch && suggestions.length > 0 && (
                  <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg" role="listbox">
                    {suggestions.map((suggestion) => (
                      <li key={suggestion}>
                        <button
                          className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 hover:bg-indigo-50"
                          onMouseDown={(event) => event.preventDefault()}
                          onClick={() => selectSuggestion(suggestion)}
                          type="button"
                        >
                          {suggestion}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              {[
                ["department", "Department"],
                ["university", "University"],
                ["college", "College"],
                ["batch", "Batch"],
                ["subject", "Subject"],
                ["unit", "Unit"],
                ["topic", "Topic"],
              ].map(([name, label]) => (
                <FilterInput
                  key={name}
                  label={label}
                  name={name}
                  onChange={updateFilter}
                  placeholder={`Filter by ${label.toLowerCase()}`}
                  value={filters[name]}
                />
              ))}
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Semester</span>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" name="semester" onChange={updateFilter} value={filters.semester}>
                  <option value="">All semesters</option>
                  {Array.from({ length: 12 }, (_, index) => index + 1).map((semester) => <option key={semester} value={semester}>{semester}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Resource type</span>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" name="resourceType" onChange={updateFilter} value={filters.resourceType}>
                  <option value="">Notes and PYQs</option>
                  <option value="note">Notes</option>
                  <option value="pyq">PYQs</option>
                </select>
              </label>
              <label className="block">
                <span className="mb-1.5 block text-sm font-semibold text-slate-700">Sort by</span>
                <select className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15" name="sort" onChange={updateFilter} value={filters.sort}>
                  <option value="recent">Recently uploaded</option>
                  <option value="helpful">Most helpful</option>
                </select>
              </label>
              <button
                className="w-full rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => {
                  setFilters(initialFilters);
                  setPage(1);
                }}
                type="button"
              >
                Clear filters
              </button>
            </div>
          </aside>

          <section aria-label="Search results">
            <AdUnit className="mb-5" placement="search" />
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-sm text-slate-600">{pagination.total} approved resource{pagination.total === 1 ? "" : "s"}</p>
              <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">Approved resources only</span>
            </div>
            {error && <p className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-700" role="alert">{error}</p>}
            {notice && <p className="mb-4 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-700" role="status">{notice}</p>}
            {loading ? (
              <PageLoader label="Searching approved resources…" />
            ) : resources.length === 0 ? (
              <EmptyState icon="book" title="No approved resources found">
                Try another search or broaden your filters.
              </EmptyState>
            ) : (
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {resources.map((resource) => (
                  <article className="flex min-w-0 flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md sm:p-5" key={`${resource.type}-${resource.id}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-lg bg-indigo-50 px-2.5 py-1 text-xs font-bold uppercase text-brand">{resource.type === "note" ? "Verified notes" : "Approved PYQ"}</span>
                      <span className="text-xs text-slate-500">{resource.fileFormat?.toUpperCase()}</span>
                    </div>
                    <h2 className="mt-4 break-words text-lg font-bold text-ink">{resource.title}</h2>
                    <p className="mt-1 line-clamp-2 break-words text-sm text-slate-600">{resource.description}</p>
                    <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs text-slate-500">Subject</dt><dd className="font-semibold text-slate-800">{resource.subject}</dd></div>
                      <div><dt className="text-xs text-slate-500">Semester</dt><dd className="font-semibold text-slate-800">{resource.semester}</dd></div>
                      {resource.unit && <div><dt className="text-xs text-slate-500">Unit</dt><dd className="font-semibold text-slate-800">{resource.unit}</dd></div>}
                      {resource.topic && <div><dt className="text-xs text-slate-500">Topic</dt><dd className="font-semibold text-slate-800">{resource.topic}</dd></div>}
                    </dl>
                    <p className="mt-3 line-clamp-1 text-xs text-slate-500">{[resource.department, resource.college, resource.university, resource.batch].filter(Boolean).join(" · ")}</p>
                    {resource.uploader?.username && (
                      <Link className="mt-2 w-fit text-xs font-semibold text-brand hover:underline" to={`/profile/${encodeURIComponent(resource.uploader.username)}`}>
                        Shared by {resource.uploader.fullName}
                      </Link>
                    )}
                    <p className="mt-2 text-xs text-slate-400">{new Date(resource.createdAt).toLocaleDateString()} · {resource.helpfulCount} found helpful</p>
                    <div className="mt-auto flex flex-wrap items-center gap-2 pt-5">
                      {user ? (
                        <a className="flex-1 rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-indigo-700" href={`${api.defaults.baseURL}${resource.downloadUrl}`} rel="noreferrer" target="_blank">Open resource</a>
                      ) : (
                        <Link className="flex-1 rounded-xl bg-brand px-3 py-2.5 text-center text-sm font-bold text-white hover:bg-indigo-700" to="/login">Sign in to open</Link>
                      )}
                      {user?.role === "user" && (
                        <button
                          className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                          disabled={voting === resource.id || helpfulVotes.has(`${resource.type}:${resource.id}`)}
                          onClick={() => voteHelpful(resource)}
                          type="button"
                        >
                          {voting === resource.id ? "Saving…" : helpfulVotes.has(`${resource.type}:${resource.id}`) ? "Marked helpful" : "Helpful"}
                        </button>
                      )}
                      {user?.role === "user" && (
                        <button
                          className="rounded-xl border border-indigo-200 px-3 py-2.5 text-xs font-semibold text-brand hover:bg-indigo-50 disabled:opacity-50"
                          disabled={bookmarkingId === resource.id}
                          onClick={() => toggleBookmark(resource)}
                          type="button"
                        >
                          {bookmarkingId === resource.id
                            ? "Saving…"
                            : resource.isBookmarked
                              ? "Saved"
                              : "Save"}
                        </button>
                      )}
                      {resource.type === "note" && (
                        user?.role === "user" ? (
                          <button
                            className="rounded-xl border border-rose-200 px-3 py-2.5 text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            onClick={() => {
                              setReportTarget(resource);
                              setReportForm((current) => ({
                                ...current,
                                pageNumber: "1",
                              }));
                            }}
                            type="button"
                          >
                            Report mistake
                          </button>
                        ) : (
                          <Link
                            className="rounded-xl border border-rose-200 px-3 py-2.5 text-center text-xs font-semibold text-rose-700 hover:bg-rose-50"
                            to="/login"
                          >
                            Report mistake
                          </Link>
                        )
                      )}
                    </div>
                  </article>
                ))}
              </div>
            )}
            {pagination.pages > 1 && (
              <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={page <= 1 || loading} onClick={() => setPage((current) => current - 1)} type="button">Previous</button>
                <span className="text-sm text-slate-600">Page {page} of {pagination.pages}</span>
                <button className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 disabled:opacity-40" disabled={page >= pagination.pages || loading} onClick={() => setPage((current) => current + 1)} type="button">Next</button>
              </div>
            )}
          </section>
        </div>
      </section>
      {reportTarget && (
        <div className="fixed inset-0 z-50 grid place-items-center overflow-y-auto bg-slate-950/50 p-3 sm:p-4">
          <form
            className="my-auto w-full max-w-xl rounded-2xl border border-slate-100 bg-white p-5 shadow-2xl sm:p-6"
            onSubmit={submitMistakeReport}
          >
            <h2 className="text-xl font-bold text-ink">Report a mistake</h2>
            <p className="mt-1 text-sm text-slate-600">{reportTarget.title}</p>
            <label className="mt-5 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Page number</span>
              <input
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                max={reportTarget.pageCount || 10000}
                min="1"
                onChange={(event) => setReportForm((current) => ({ ...current, pageNumber: event.target.value }))}
                required
                type="number"
                value={reportForm.pageNumber}
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Issue category</span>
              <select
                className="w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm"
                onChange={(event) => setReportForm((current) => ({ ...current, category: event.target.value }))}
                value={reportForm.category}
              >
                <option value="incorrect_definition">Incorrect definition</option>
                <option value="wrong_formula">Wrong formula</option>
                <option value="incorrect_calculation">Incorrect calculation</option>
                <option value="missing_explanation">Missing explanation</option>
                <option value="poor_readability">Poor handwriting readability</option>
                <option value="duplicate_content">Duplicate content</option>
              </select>
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Explain the issue</span>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/15"
                maxLength={2000}
                onChange={(event) => setReportForm((current) => ({ ...current, explanation: event.target.value }))}
                required
                rows={3}
                value={reportForm.explanation}
              />
            </label>
            <label className="mt-4 block">
              <span className="mb-1.5 block text-sm font-semibold text-slate-700">Suggested correction (optional)</span>
              <textarea
                className="w-full rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm"
                maxLength={2000}
                onChange={(event) => setReportForm((current) => ({ ...current, suggestedCorrection: event.target.value }))}
                rows={3}
                value={reportForm.suggestedCorrection}
              />
            </label>
            <p className="mt-3 text-xs text-slate-500">A report is a request for review. It does not change the note or contributor points unless an administrator confirms an issue.</p>
            <div className="mt-5 flex justify-end gap-3">
              <button
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700"
                onClick={() => setReportTarget(null)}
                type="button"
              >
                Cancel
              </button>
              <button
                className="rounded-xl bg-brand px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
                disabled={submittingReport}
                type="submit"
              >
                {submittingReport ? "Submitting…" : "Submit report"}
              </button>
            </div>
          </form>
        </div>
      )}
    </main>
  );
}
