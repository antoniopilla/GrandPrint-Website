import { useState } from "react";

// Reads the theme applied to <html> by the early-load script in index.html.
const getTheme = () =>
  (typeof document !== "undefined" &&
    document.documentElement.getAttribute("data-theme")) ||
  "light";

/**
 * Small sun/moon button that flips the app between light and dark.
 * - floating: fix it to the top-right corner (for pages without a nav bar).
 */
export default function ThemeToggle({ floating = false }) {
  const [theme, setTheme] = useState(getTheme);
  const isDark = theme === "dark";

  const toggle = () => {
    const next = isDark ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("theme", next);
    } catch (e) {}
    setTheme(next);
  };

  return (
    <button
      onClick={toggle}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Switch to light mode" : "Switch to dark mode"}
      style={{ ...s.btn, ...(floating ? s.floating : null) }}
    >
      <span style={{ fontSize: 16, lineHeight: 1 }}>{isDark ? "☀️" : "🌙"}</span>
    </button>
  );
}

const s = {
  btn: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    width: 38,
    height: 38,
    borderRadius: 980,
    background: "var(--bg)",
    border: "1px solid var(--border)",
    color: "var(--text)",
    cursor: "pointer",
    flexShrink: 0,
    fontFamily: "var(--font)",
    transition: "background .15s, border-color .15s",
  },
  floating: {
    position: "fixed",
    top: 16,
    right: 16,
    zIndex: 1000,
    boxShadow: "var(--shadow)",
  },
};
