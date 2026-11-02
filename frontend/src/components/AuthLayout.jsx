import { useRef } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap.js";
import { SiteFooter, SiteHeader } from "./SiteChrome.jsx";

gsap.registerPlugin(useGSAP);

export default function AuthLayout({ children, eyebrow, title, description }) {
  const rootRef = useRef(null);

  useGSAP(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      ".ed-auth-card",
      { autoAlpha: 0, y: 22 },
      { autoAlpha: 1, y: 0, duration: 0.7, ease: "power3.out" },
    );
    gsap.fromTo(
      ".ed-auth-art-card",
      { autoAlpha: 0, scale: 0.86, rotation: -7 },
      { autoAlpha: 1, scale: 1, rotation: -3, duration: 0.65, delay: 0.2, ease: "back.out(1.5)" },
    );
  }, { scope: rootRef });

  return (
    <div className="ed-site ed-auth-site" id="top" ref={rootRef}>
      <SiteHeader />

      <main className="ed-auth-main">
        <div aria-hidden="true" className="ed-auth-doodle ed-auth-doodle-one">✳</div>
        <div aria-hidden="true" className="ed-auth-doodle ed-auth-doodle-two">✦</div>
        <div className="ed-auth-card">
          <aside className="ed-auth-story">
            <div className="ed-auth-story-copy">
              <span className="ed-auth-kicker"><i /> MADE FOR STUDENTS</span>
              <h2>GOOD NOTES.<br /><span>GOOD PEOPLE.</span></h2>
              <p>A little sharing goes a long way. Find your people, pass on what you know, and rise together.</p>
            </div>
            <div className="ed-auth-art-card" aria-hidden="true">
              <span>YOUR NEXT CHAPTER</span>
              <strong>STARTS HERE <i>↗</i></strong>
              <small>LEARN IT · SHARE IT</small>
            </div>
            <div className="ed-auth-proof"><i>✳</i> ALWAYS FREE TO LEARN</div>
          </aside>

          <section aria-labelledby="auth-title" className="ed-auth-form-panel">
            {eyebrow && <p className="ed-auth-eyebrow"><span />{eyebrow}</p>}
            <h1 id="auth-title">{title}</h1>
            {description && <p className="ed-auth-description">{description}</p>}
            <div className="ed-auth-form-content">{children}</div>
          </section>
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
