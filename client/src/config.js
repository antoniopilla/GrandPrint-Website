import { resolveApiUrl } from "./apiConfig";

export const API = resolveApiUrl(
  import.meta.env.VITE_API_URL,
  import.meta.env.DEV && __ALLOW_LOCAL_API_FALLBACK__,
);
