const storageKey = (orderId) => `grandprint:order-access:${orderId}`;
const TOKEN_PATTERN = /^[a-zA-Z0-9_-]{43}$/;

export const createPaymentPath = (orderId, accessToken) =>
  `/pay/${encodeURIComponent(orderId)}${accessToken ? `#token=${encodeURIComponent(accessToken)}` : ""}`;

export function forgetPaymentToken(orderId) {
  try {
    sessionStorage.removeItem(storageKey(orderId));
  } catch {
    // Payment links still work for this page when browser storage is unavailable.
  }
}

export function capturePaymentToken(orderId, hash) {
  const fragment = new URLSearchParams((hash || "").replace(/^#/, ""));
  const hasFragmentToken = fragment.has("token");
  let token = "";
  if (hasFragmentToken) {
    token = fragment.get("token") || "";
    if (!TOKEN_PATTERN.test(token)) token = "";
    try {
      if (token) sessionStorage.setItem(storageKey(orderId), token);
      else sessionStorage.removeItem(storageKey(orderId));
    } catch {
      // Keep using the captured token without persisting it.
    }
  } else {
    try {
      const storedToken = sessionStorage.getItem(storageKey(orderId)) || "";
      token = TOKEN_PATTERN.test(storedToken) ? storedToken : "";
    } catch {
      // A private payment link is required when there is no stored token.
    }
  }
  return { token, hasFragmentToken };
}
