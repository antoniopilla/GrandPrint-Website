const getCustomerPortalUrl = (env = process.env) => {
  const production = env.NODE_ENV === "production";
  const normalized = (env.CUSTOMER_PORTAL_URL || "").trim().replace(/\/+$/, "");
  if (!normalized) {
    if (production) throw new Error("CUSTOMER_PORTAL_URL is required in production");
    return "http://localhost:3000";
  }

  let url;
  try {
    url = new URL(normalized);
  } catch {
    throw new Error("CUSTOMER_PORTAL_URL must be a valid absolute URL");
  }
  if (
    !["http:", "https:"].includes(url.protocol) ||
    (production && url.protocol !== "https:") ||
    url.username || url.password || url.search || url.hash
  ) {
    throw new Error("CUSTOMER_PORTAL_URL must use HTTPS in production and have no credentials, query, or fragment");
  }
  return url.href.replace(/\/+$/, "");
};

const buildPaymentLink = (orderId, token) =>
  `${getCustomerPortalUrl()}/pay/${encodeURIComponent(orderId)}#token=${encodeURIComponent(token)}`;

module.exports = { getCustomerPortalUrl, buildPaymentLink };
