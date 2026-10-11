const INVALID_API_URL = "VITE_API_URL must be an absolute HTTP or HTTPS backend URL without credentials, a query, or a fragment.";

export function resolveApiUrl(value, allowLocalFallback = false) {
  if (value == null || (typeof value === "string" && !value.trim())) {
    if (allowLocalFallback) return "http://localhost:5000";
    throw new Error("VITE_API_URL must be set outside local development.");
  }

  if (typeof value !== "string") throw new Error(INVALID_API_URL);
  const trimmed = value.trim();
  let url;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error(INVALID_API_URL);
  }
  if (!/^https?:\/\//i.test(trimmed) || !["http:", "https:"].includes(url.protocol)
    || url.username || url.password || trimmed.includes("?") || trimmed.includes("#") || trimmed.includes("\\")) {
    throw new Error(INVALID_API_URL);
  }
  return url.toString().replace(/\/+$/, "");
}
