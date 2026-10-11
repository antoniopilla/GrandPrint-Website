const LABELS = {
  sending: "Sending",
  accepted: "Accepted by email provider (delivery not confirmed)",
  failed: "Failed",
  unknown: "Unknown",
};

export const isValidApprovalEmail = (value) => {
  const email = typeof value === "string" ? value.trim() : "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
};

export const getApprovalEmailInfo = (order, now = Date.now()) => {
  const metadata = order.approvalEmail;
  if (order.status !== "Awaiting Downpayment" && !metadata) return null;
  let state = metadata?.state;
  if (!Object.prototype.hasOwnProperty.call(LABELS, state)) state = "unknown";
  if (state === "sending" && !(Date.parse(metadata?.leaseExpiresAt) > now)) state = "unknown";
  return {
    state,
    label: LABELS[state],
    isSending: state === "sending",
    requiresConfirmation: state === "accepted" || state === "unknown",
  };
};
