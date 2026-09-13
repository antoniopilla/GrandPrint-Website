import { useState, useEffect } from "react";

// Subscribe to a CSS media query and re-render when it changes.
export function useMediaQuery(query) {
  const get = () =>
    typeof window !== "undefined" && window.matchMedia(query).matches;
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const mql = window.matchMedia(query);
    const handler = (e) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}

// Phones (and small windows). Tablets/desktops keep the full layout.
export const useIsMobile = () => useMediaQuery("(max-width: 640px)");
