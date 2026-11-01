import { useEffect, useRef } from "react";

const publisherId = import.meta.env.VITE_ADSENSE_CLIENT_ID ?? "";
const adsEnabled = import.meta.env.VITE_ADSENSE_ENABLED === "true";
const consentReady = import.meta.env.VITE_ADSENSE_CONSENT_READY === "true";
const slots = {
  home: import.meta.env.VITE_ADSENSE_SLOT_HOME ?? "",
  search: import.meta.env.VITE_ADSENSE_SLOT_SEARCH ?? "",
  pyqs: import.meta.env.VITE_ADSENSE_SLOT_PYQS ?? "",
};

function isProductionSite() {
  if (!import.meta.env.PROD || typeof window === "undefined") return false;
  const { hostname } = window.location;
  return (
    hostname !== "localhost" &&
    hostname !== "127.0.0.1" &&
    hostname !== "[::1]" &&
    !hostname.endsWith(".localhost") &&
    !hostname.endsWith(".local")
  );
}

function loadAdSenseScript() {
  const existing = document.querySelector("script[data-studyshare-adsense]");
  if (existing) return;

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.dataset.studyshareAdsense = "true";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisherId}`;
  script.onerror = () => {
    console.error("Google AdSense script could not be loaded.");
  };
  document.head.append(script);
}

export default function AdUnit({ placement, className = "" }) {
  const adRef = useRef(null);
  const slot = slots[placement];
  const configured =
    adsEnabled &&
    consentReady &&
    isProductionSite() &&
    /^ca-pub-\d+$/.test(publisherId) &&
    /^\d+$/.test(slot);

  useEffect(() => {
    if (!configured || !adRef.current) return;

    loadAdSenseScript();
    if (adRef.current.dataset.adRequested === "true") return;
    adRef.current.dataset.adRequested = "true";
    try {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push({});
    } catch (error) {
      console.error(`Google AdSense failed to initialize the ${placement} ad unit:`, error);
    }
  }, [configured, placement]);

  if (!configured) return null;

  return (
    <aside
      aria-label="Advertisement"
      className={`mx-auto w-full max-w-5xl ${className}`}
    >
      <p className="mb-1 text-center text-[10px] font-medium uppercase tracking-wide text-slate-400">
        Advertisement
      </p>
      <ins
        className="adsbygoogle block min-h-0 w-full overflow-hidden"
        data-ad-client={publisherId}
        data-ad-format="auto"
        data-ad-slot={slot}
        data-full-width-responsive="true"
        ref={adRef}
      />
    </aside>
  );
}
