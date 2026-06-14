import { useEffect, useState } from "react";

function getMediaQueryMatches(query: string): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia(query).matches;
}

export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => getMediaQueryMatches(query));

  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

/** Responsive Leaflet panel height for browse / detail maps */
export function useMapPanelHeight(options?: {
  compact?: boolean;
}): number {
  const [height, setHeight] = useState(options?.compact ? 320 : 420);

  useEffect(() => {
    const update = () => {
      const w = window.innerWidth;
      if (options?.compact) {
        setHeight(w < 640 ? 280 : w < 1024 ? 360 : 480);
        return;
      }
      setHeight(w < 640 ? 300 : w < 1024 ? 440 : 560);
    };
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [options?.compact]);

  return height;
}
