import { useEffect, useRef, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useGSAP } from "@gsap/react";
import {
  BookOpenText,
  Compass,
  Sparkles,
  LayoutDashboard,
  LibraryBig,
  LogOut,
  Menu,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import { useAuth } from "../context/AuthContext.jsx";
import { gsap, ScrollTrigger } from "../lib/gsap.js";
import NotificationBell from "./NotificationBell.jsx";
import TopperLogo from "./TopperLogo.jsx";

gsap.registerPlugin(useGSAP);

export function SiteHeader() {
  const { user } = useAuth();
  return user ? <AuthenticatedSiteHeader user={user} /> : <PublicSiteHeader />;
}

function PublicSiteHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  return (
    <header className="ed-header ed-app-header">
      <div className="ed-header-inner">
        <Link aria-label="Topper home" className="ed-logo-link" to="/"><TopperLogo /></Link>
        <button
          aria-expanded={menuOpen}
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          className="ed-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          <span /><span />
        </button>
        <nav aria-label="Main navigation" className={`ed-nav ed-app-nav ${menuOpen ? "ed-nav-open" : ""}`}>
          <Link to="/search">Explore</Link>
          <Link to="/login">Student sign in</Link>
          <Link className="ed-nav-cta" to="/register">
            Join for free
            <span aria-hidden="true" className="ed-arrow">→</span>
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function AuthenticatedSiteHeader({ user }) {
  const { signOut } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const navLinkClass = ({ isActive }) =>
    `ed-nav-link${isActive ? " is-active" : ""}`;

  useEffect(() => {
    setMenuOpen(false);
    setSignOutError("");
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const closeOnEscape = (event) => {
      if (event.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [menuOpen]);

  async function handleSignOut() {
    setSignOutError("");
    try {
      await signOut();
      navigate(user.role === "admin" ? "/admin/login" : "/", { replace: true });
    } catch (error) {
      setSignOutError(error.response?.data?.message ?? error.message ?? "Could not sign out. Please try again.");
    }
  }

  return (
    <header className="ed-header ed-app-header">
      <div className="ed-header-inner">
        <Link aria-label="Topper home" className="ed-logo-link" to="/"><TopperLogo /></Link>
        <button
          aria-expanded={menuOpen}
          aria-controls="ed-main-navigation"
          aria-label={menuOpen ? "Close navigation" : "Open navigation"}
          className="ed-menu-toggle"
          onClick={() => setMenuOpen((open) => !open)}
          type="button"
        >
          {menuOpen ? <X aria-hidden="true" size={21} /> : <Menu aria-hidden="true" size={21} />}
        </button>
        <nav aria-label="Main navigation" className={`ed-nav ed-app-nav ${menuOpen ? "ed-nav-open" : ""}`} id="ed-main-navigation">
          {user.role === "user" && (
            <>
              <NavLink className={navLinkClass} to="/search"><Compass aria-hidden="true" />Explore</NavLink>
              <NavLink className={navLinkClass} to="/uploads"><Upload aria-hidden="true" />Upload</NavLink>
              <NavLink className={navLinkClass} to="/practice"><Sparkles aria-hidden="true" />AI Practice</NavLink>
              <NavLink className={navLinkClass} to="/syllabus"><BookOpenText aria-hidden="true" />Syllabus analyzer</NavLink>
              {user.username && (
                <NavLink className={navLinkClass} to={`/profile/${encodeURIComponent(user.username)}`}>
                  <UserRound aria-hidden="true" />My profile
                </NavLink>
              )}
              <NavLink className={navLinkClass} to="/library"><LibraryBig aria-hidden="true" />My library</NavLink>
            </>
          )}
          {user.role === "admin" && (
            <NavLink className={navLinkClass} to="/search"><Compass aria-hidden="true" />Explore</NavLink>
          )}
          <NotificationBell />
          <button className="ed-nav-signout" onClick={handleSignOut} type="button">
            <LogOut aria-hidden="true" />Sign out
          </button>
          {user.role === "admin" && (
            <NavLink className="ed-nav-cta" to="/admin">
              <LayoutDashboard aria-hidden="true" />
              Admin dashboard
              <span aria-hidden="true" className="ed-arrow">→</span>
            </NavLink>
          )}
        </nav>
        {signOutError && <p className="ed-nav-error" role="alert">{signOutError}</p>}
      </div>
    </header>
  );
}

export function SiteFooter() {
  const shareUrl = encodeURIComponent(window.location.origin);
  const shareText = encodeURIComponent(
    "Learn Together. Rise Together. Discover Topper, a free student resource-sharing community.",
  );
  const contactEmail = (import.meta.env.VITE_CONTACT_EMAIL ?? "").trim();
  const validContactEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)
    ? contactEmail
    : "";

  return (
    <footer className="ed-footer ed-app-footer">
      <div aria-hidden="true" className="ed-footer-top-art"><span>✳</span><span>↗</span><span>✦</span></div>
      <div className="ed-footer-inner">
        <div className="ed-footer-main">
          <div className="ed-footer-brand">
            <Link aria-label="Topper home" to="/"><TopperLogo inverse /></Link>
            <p>Learn Together.<br /><span>Rise Together.</span></p>
            <span className="ed-footer-free">FREE TO LEARN · FREE TO SHARE</span>
          </div>
          <div className="ed-footer-links">
            <div><h2>Explore</h2><Link to="/search">Knowledge vault</Link><Link to="/pyqs">Previous-year papers</Link><Link to="/syllabus">Syllabus explorer</Link></div>
            <div><h2>Join in</h2><Link to="/register">Share your notes</Link><Link to="/login">Student sign in</Link><Link to="/library">Your library</Link></div>
            <div><h2>About</h2><Link to="/#about">Our story</Link><Link to="/#verification">Thoughtful verification</Link><Link to="/terms">Terms &amp; conditions</Link></div>
            <div><h2>Privacy</h2><Link to="/advertising">Privacy &amp; advertising details</Link>{validContactEmail ? <a href={`mailto:${validContactEmail}`}>Contact Topper</a> : <span className="ed-footer-coming-soon">Contact details coming soon</span>}</div>
          </div>
          <div className="ed-footer-social">
            <span>PASS THE GOOD STUFF ON.</span>
            <div aria-label="Share Topper" className="ed-social-links">
              <a aria-label="Share Topper on LinkedIn" href={`https://www.linkedin.com/sharing/share-offsite/?url=${shareUrl}`} rel="noreferrer" target="_blank">in</a>
              <a aria-label="Share Topper on X" href={`https://twitter.com/intent/tweet?text=${shareText}&url=${shareUrl}`} rel="noreferrer" target="_blank">𝕏</a>
              <a aria-label="Share Topper on WhatsApp" href={`https://wa.me/?text=${shareText}%20${shareUrl}`} rel="noreferrer" target="_blank">↗</a>
            </div>
          </div>
        </div>
        <div className="ed-footer-bottom">
          <span>© {new Date().getFullYear()} Topper. Made for students, by students.</span>
          <span>Free to learn · Free to share</span>
          <a href="#top">Back to the top ↑</a>
        </div>
      </div>
    </footer>
  );
}

export default function ApplicationLayout() {
  const rootRef = useRef(null);
  const { pathname } = useLocation();

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const main = rootRef.current?.querySelector(".ed-app-content");
    if (!main) return;
    gsap.fromTo(
      main,
      { autoAlpha: 0, y: 14 },
      { autoAlpha: 1, y: 0, duration: 0.48, ease: "power3.out" },
    );
    const refreshFrame = requestAnimationFrame(() => ScrollTrigger.refresh());
    return () => cancelAnimationFrame(refreshFrame);
  }, { scope: rootRef, dependencies: [pathname], revertOnUpdate: true });

  return (
    <div className="ed-site ed-app-site" id="top" ref={rootRef}>
      <SiteHeader />
      <div className="ed-app-content"><Outlet /></div>
      <SiteFooter />
    </div>
  );
}
