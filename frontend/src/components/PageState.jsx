import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useGSAP } from "@gsap/react";
import { gsap } from "../lib/gsap.js";
import AnimatedIllustration from "./AnimatedIllustration.jsx";
import FlyingStudentsMascot from "./FlyingStudentsMascot.jsx";
import TopperLogo from "./TopperLogo.jsx";

gsap.registerPlugin(useGSAP);

export function PageLoader({
  label = "Preparing your learning space…",
  fullScreen = false,
  exiting = false,
  onExitComplete,
}) {
  const rootRef = useRef(null);

  useGSAP(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const progress = root.querySelector(".ed-loader-progress-indicator");

    if (exiting) {
      gsap.to(root, {
        autoAlpha: 0,
        scale: 0.985,
        duration: reduceMotion ? 0.01 : 0.36,
        ease: "power2.inOut",
        onComplete: onExitComplete,
      });
      return undefined;
    }

    if (reduceMotion) return undefined;

    const entrance = gsap.timeline({ defaults: { ease: "power3.out" } });
    if (fullScreen) {
      entrance
        .fromTo(root.querySelector(".ed-loader-mascot"), { y: 14, scale: 0.94, autoAlpha: 0 }, { y: 0, scale: 1, autoAlpha: 1, duration: 0.6 })
        .fromTo(root.querySelector(".ed-loader-copy"), { y: 12, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: 0.45 }, "-=0.16");
      gsap.to(progress, {
        xPercent: 280,
        duration: 1.25,
        ease: "power2.inOut",
        repeat: -1,
        repeatDelay: 0.16,
      });
    } else {
      entrance.fromTo(root.querySelector(".ed-loader-inline-logo"), { y: 5, autoAlpha: 0.7 }, {
        y: 0,
        autoAlpha: 1,
        duration: 0.45,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });
    }
    return undefined;
  }, { scope: rootRef, dependencies: [exiting, fullScreen, onExitComplete], revertOnUpdate: true });

  if (fullScreen) {
    return (
      <div
        aria-busy="true"
        aria-live="polite"
        className="ed-page-loader ed-page-loader-fullscreen"
        ref={rootRef}
        role="status"
      >
        <FlyingStudentsMascot className="ed-loader-mascot" />
        <div className="ed-loader-copy">
          <p className="ed-loader-kicker">TOPPER · LEARN TOGETHER</p>
          <span>{label}</span>
          <div aria-hidden="true" className="ed-loader-progress-track">
            <span className="ed-loader-progress-indicator" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div aria-busy="true" aria-live="polite" className="ed-page-loader ed-page-loader-inline" ref={rootRef} role="status">
      <div className="ed-loader-inline-logo"><TopperLogo loading /></div>
      <span>{label}</span>
    </div>
  );
}

export function useBrandedLoadingScreen(active, label) {
  const [visible, setVisible] = useState(active);
  const hide = useCallback(() => setVisible(false), []);

  useEffect(() => {
    if (active) setVisible(true);
  }, [active]);

  if (!visible) return null;
  return (
    <PageLoader
      exiting={!active}
      fullScreen
      label={label}
      onExitComplete={hide}
    />
  );
}

export function EmptyState({ title, children, icon = "book", illustration, className = "" }) {
  const variant = illustration ?? "book";
  return (
    <section className={`ed-empty-state ${className}`} data-ed-animate>
      <span className={`ed-empty-illustration ed-empty-${icon}`}>
        <AnimatedIllustration variant={variant} size={66} />
      </span>
      <h2>{title}</h2>
      {children && <p>{children}</p>}
    </section>
  );
}

function SuspensePending({ onStart, onFinish }) {
  useEffect(() => {
    onStart();
    return onFinish;
  }, [onFinish, onStart]);
  return null;
}

function SuspenseReady({ children, onReady }) {
  useEffect(() => onReady(), [onReady]);
  return children;
}

export function BrandedSuspense({ children, label = "Preparing your learning space…" }) {
  const [phase, setPhase] = useState("idle");
  const start = useCallback(() => setPhase("loading"), []);
  const finish = useCallback(
    () => setPhase((current) => (current === "loading" ? "exiting" : current)),
    [],
  );
  const completeExit = useCallback(() => setPhase("idle"), []);

  return (
    <>
      <Suspense fallback={<SuspensePending onStart={start} onFinish={finish} />}>
        <SuspenseReady onReady={finish}>{children}</SuspenseReady>
      </Suspense>
      {phase !== "idle" && (
        <PageLoader
          exiting={phase === "exiting"}
          fullScreen
          label={label}
          onExitComplete={completeExit}
        />
      )}
    </>
  );
}
