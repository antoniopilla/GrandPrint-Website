// Central API base URL. In production, set VITE_API_URL to the deployed backend
// (e.g. https://your-service.onrender.com). Falls back to the local dev server.
export const API = import.meta.env.VITE_API_URL ?? "http://localhost:5000";
