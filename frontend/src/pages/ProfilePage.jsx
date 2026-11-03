import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import { useAuth } from "../context/AuthContext.jsx";
import { api } from "../lib/api.js";
import { gsap } from "../lib/gsap.js";
import { PageLoader } from "../components/PageState.jsx";

const tabs = [
  ["all", "All contributions"],
  ["note", "Notes"],
  ["pyq", "Previous year papers"],
];

function initials(name = "") {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("") || "?";
}

function formatDate(value, options = { dateStyle: "medium" }) {
  return new Date(value).toLocaleDateString(undefined, options);
}

function errorMessage(error) {
  return error.response?.data?.message ?? error.message ?? "Something went wrong.";
}

export default function ProfilePage() {
  const { username = "" } = useParams();
  const navigate = useNavigate();
  const { user, updateUser } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeTab, setActiveTab] = useState("all");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [avatarFile, setAvatarFile] = useState(null);
  const [avatarPreview, setAvatarPreview] = useState("");
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const rootRef = useRef(null);
  const isOwner = Boolean(user && data?.profile.id === user.id);
  const visibleContributions = useMemo(
    () => data?.contributions.filter((item) => activeTab === "all" || item.type === activeTab) ?? [],
    [activeTab, data],
  );

  useEffect(() => {
    if (!avatarFile) {
      setAvatarPreview("");
      return undefined;
    }
    const preview = URL.createObjectURL(avatarFile);
    setAvatarPreview(preview);
    return () => URL.revokeObjectURL(preview);
  }, [avatarFile]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    setEditing(false);
    api.get(`/profiles/${encodeURIComponent(username)}`)
      .then(({ data: result }) => {
        if (active) setData(result);
      })
      .catch((requestError) => {
        if (active) {
          setData(null);
          setError(errorMessage(requestError));
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [username]);

  useGSAP(() => {
    if (!data || !rootRef.current) return;
    gsap.fromTo(
      rootRef.current.querySelectorAll("[data-profile-animate]"),
      { autoAlpha: 0, y: 12 },
      { autoAlpha: 1, y: 0, duration: 0.42, stagger: 0.06, ease: "power2.out" },
    );
  }, { scope: rootRef, dependencies: [data?.profile.username], revertOnUpdate: true });

  async function saveProfile(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const selectedAvatar = formData.get("avatar");
    if (!(selectedAvatar instanceof File) || !selectedAvatar.name) {
      formData.delete("avatar");
    }
    if (removeAvatar) formData.set("removeAvatar", "true");
    setSaving(true);
    setSaveError("");
    try {
      const { data: result } = await api.patch("/profiles/me", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      updateUser(result.profile);
      setData((current) => ({ ...current, profile: { ...current.profile, ...result.profile } }));
      setEditing(false);
      setAvatarFile(null);
      setRemoveAvatar(false);
      if (result.profile.username !== username) {
        navigate(`/profile/${encodeURIComponent(result.profile.username)}`, { replace: true });
      }
    } catch (requestError) {
      setSaveError(errorMessage(requestError));
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <PageLoader label="Loading profile…" />;
  if (error || !data) {
    return (
      <main className="ed-profile-error">
        <span aria-hidden="true" className="ed-profile-error-mark">?</span>
        <p className="ed-profile-kicker">A LITTLE DETOUR</p>
        <h1>Profile unavailable</h1>
        <p className="ed-profile-error-message" role="alert">{error || "Profile not found."}</p>
        <Link className="ed-profile-button ed-profile-button-dark" to="/search">
          Explore resources <span aria-hidden="true">↗</span>
        </Link>
      </main>
    );
  }

  const { profile, stats } = data;

  return (
    <main className="ed-profile-page">
      <div className="ed-profile-wrap" ref={rootRef}>
        <div className="ed-profile-intro" data-profile-animate>
          <p className="ed-profile-kicker"><span aria-hidden="true">✳</span> A PAGE FROM YOUR STUDY STORY</p>
          <span className="ed-profile-intro-note">LEARN IT · SHARE IT · PASS IT ON</span>
        </div>

        <section className="ed-profile-card" data-profile-animate>
          <div aria-hidden="true" className="ed-profile-cover">
            <span className="ed-profile-cover-orbit ed-profile-cover-orbit-one" />
            <span className="ed-profile-cover-orbit ed-profile-cover-orbit-two" />
            <span className="ed-profile-cover-star">✳</span>
            <span className="ed-profile-cover-caption">GOOD NOTES.<br />GOOD PEOPLE.</span>
            <span className="ed-profile-cover-label">THE STUDY COMMUNITY</span>
          </div>

          <div className="ed-profile-card-body">
            <div className="ed-profile-topline">
              <div aria-label={`${profile.fullName} profile picture`} className="ed-profile-avatar">
                <span>{initials(profile.fullName)}</span>
                {(avatarPreview || profile.avatarUrl) && (
                  <img
                    alt={`${profile.fullName}'s profile`}
                    onError={(event) => { event.currentTarget.style.display = "none"; }}
                    src={avatarPreview || profile.avatarUrl}
                  />
                )}
              </div>
              <div className="ed-profile-actions">
                {profile.role === "admin" && (
                  <span className="ed-profile-admin"><span aria-hidden="true">✦</span> Community admin</span>
                )}
                {isOwner && (
                  <button
                    className="ed-profile-button ed-profile-button-dark"
                    onClick={() => { setEditing((current) => !current); setSaveError(""); }}
                    type="button"
                  >
                    {editing ? "Cancel edit" : "Edit profile"}
                    <span aria-hidden="true">{editing ? "×" : "↗"}</span>
                  </button>
                )}
              </div>
            </div>

            <div className="ed-profile-overview">
              <div className="ed-profile-identity">
                <p className="ed-profile-label">STUDENT CONTRIBUTOR</p>
                <h1>{profile.fullName}</h1>
                <p className="ed-profile-username">@{profile.username}</p>
                {profile.bio && <p className="ed-profile-bio">{profile.bio}</p>}
                <div className="ed-profile-meta">
                  {(profile.college || profile.university) && (
                    <span><i aria-hidden="true">⌂</i>{[profile.college, profile.university].filter(Boolean).join(" · ")}</span>
                  )}
                  {(profile.course || profile.department) && (
                    <span><i aria-hidden="true">▤</i>{[profile.course, profile.department].filter(Boolean).join(" · ")}</span>
                  )}
                  <span><i aria-hidden="true">✳</i>Joined {formatDate(profile.joinedAt, { month: "long", year: "numeric" })}</span>
                </div>
              </div>
              <div aria-label="Contribution statistics" className="ed-profile-stats">
                {[
                  ["Notes", stats.totalUploadedNotes, "ed-stat-orange"],
                  ["PYQ papers", stats.totalUploadedPyqs, "ed-stat-purple"],
                  ["Shared", stats.totalContributions, "ed-stat-lime"],
                ].map(([label, count, tone]) => (
                  <div className={`ed-profile-stat ${tone}`} key={label}>
                    <strong>{count}</strong>
                    <span>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            {editing && isOwner && (
              <form className="ed-profile-form" onSubmit={saveProfile}>
                <div className="ed-profile-form-heading">
                  <div>
                    <p className="ed-profile-label">MAKE IT YOURS</p>
                    <h2>Edit your profile</h2>
                  </div>
                  <span aria-hidden="true" className="ed-profile-form-spark">✳</span>
                </div>
                <div className="ed-profile-form-grid">
                  <label>
                    Name
                    <input defaultValue={profile.fullName} maxLength={100} name="fullName" required />
                  </label>
                  <label>
                    Username
                    <input defaultValue={profile.username} maxLength={30} minLength={3} name="username" pattern="[A-Za-z0-9._]+" required />
                    <small>3–30 letters, numbers, dots, or underscores.</small>
                  </label>
                  <label className="ed-profile-form-wide">
                    Bio
                    <textarea defaultValue={profile.bio} maxLength={300} name="bio" rows={3} />
                  </label>
                  <label>
                    College
                    <input defaultValue={profile.college} maxLength={120} name="college" required />
                  </label>
                  <label>
                    Course
                    <input defaultValue={profile.course} maxLength={120} name="course" />
                  </label>
                  <label className="ed-profile-form-wide">
                    Profile picture
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="ed-profile-file"
                      name="avatar"
                      onChange={(event) => {
                        const file = event.currentTarget.files?.[0] ?? null;
                        setAvatarFile(file);
                        setRemoveAvatar(false);
                        if (file && file.size > 5 * 1024 * 1024) {
                          setSaveError("Choose an image smaller than 5 MB.");
                          event.currentTarget.value = "";
                          setAvatarFile(null);
                        }
                      }}
                      type="file"
                    />
                    <small>JPG, JPEG, PNG, or WebP · maximum 5 MB</small>
                  </label>
                </div>
                {saveError && <p className="ed-profile-form-error" role="alert">{saveError}</p>}
                <div className="ed-profile-form-actions">
                  {profile.avatarUrl && (
                    <button
                      className="ed-profile-remove-photo"
                      onClick={() => {
                        setAvatarFile(null);
                        setRemoveAvatar(true);
                        setSaveError("");
                      }}
                      type="button"
                    >
                      Remove current photo
                    </button>
                  )}
                  <button className="ed-profile-button ed-profile-button-dark" disabled={saving} type="submit">
                    {saving ? "Saving…" : "Save profile"} <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </section>

        <section className="ed-profile-contributions" data-profile-animate>
          <div className="ed-profile-section-heading">
            <div>
              <p className="ed-profile-kicker"><span aria-hidden="true">✳</span> PASSED ON WITH PURPOSE</p>
              <h2>Contributions</h2>
            </div>
            <span className="ed-profile-count">{stats.totalContributions} shared {stats.totalContributions === 1 ? "resource" : "resources"}</span>
          </div>

          <div aria-label="Profile contributions" className="ed-profile-tabs" role="tablist">
            {tabs.map(([value, label]) => (
              <button
                aria-selected={activeTab === value}
                className={activeTab === value ? "ed-profile-tab ed-profile-tab-active" : "ed-profile-tab"}
                key={value}
                onClick={() => setActiveTab(value)}
                role="tab"
                type="button"
              >
                {label}
              </button>
            ))}
          </div>

          {visibleContributions.length ? (
            <div className="ed-profile-resource-grid">
              {visibleContributions.map((item) => (
                <article className="ed-profile-resource" data-profile-animate key={`${item.type}-${item.id}`}>
                  <div className="ed-resource-top">
                    <span className={`ed-resource-type ${item.type === "note" ? "ed-resource-type-notes" : "ed-resource-type-pyq"}`}>
                      <span aria-hidden="true">{item.type === "note" ? "▤" : "◷"}</span>
                      {item.type === "note" ? "Verified notes" : "Approved PYQ"}
                    </span>
                    <span className="ed-resource-semester">SEM {item.semester}</span>
                  </div>
                  <h3>{item.title}</h3>
                  <p className="ed-resource-subject">{item.subject}</p>
                  <p className="ed-resource-date">SHARED {formatDate(item.createdAt, { day: "numeric", month: "short", year: "numeric" }).toUpperCase()}</p>
                  <a
                    className="ed-profile-button ed-profile-button-resource"
                    href={`${api.defaults.baseURL}${item.downloadUrl}`}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Open resource <span aria-hidden="true">↗</span>
                  </a>
                </article>
              ))}
            </div>
          ) : (
            <div className="ed-profile-empty">
              <span aria-hidden="true" className="ed-profile-empty-art">✳</span>
              <p className="ed-profile-label">THE NEXT GOOD THING STARTS HERE</p>
              <h3>No contributions just yet</h3>
              <p>Approved notes and papers shared by this student will find a home here.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
