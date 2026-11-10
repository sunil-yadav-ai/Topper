import { useEffect, useState } from "react";

export default function useResponsiveFilters() {
  const [open, setOpen] = useState(() =>
    window.matchMedia("(min-width: 641px)").matches
  );

  useEffect(() => {
    const desktop = window.matchMedia("(min-width: 641px)");
    const sync = () => setOpen(desktop.matches);
    desktop.addEventListener("change", sync);
    return () => desktop.removeEventListener("change", sync);
  }, []);

  return [open, setOpen];
}
