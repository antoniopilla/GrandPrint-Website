const crypto = require("crypto");
const Order = require("../models/Order");
const sendApprovalEmail = require("./emailService");

const EMAIL_LEASE_MS = 60_000;
const EMAIL_STATES = new Set(["sending", "accepted", "failed", "unknown"]);

const asDate = (value) => {
  if (value === undefined || value === null) return undefined;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : undefined;
};

const createEmailAttempt = (now = Date.now()) => {
  const lastAttemptAt = asDate(now);
  if (!lastAttemptAt) throw new Error("Invalid approval email attempt time");
  return {
    state: "sending",
    attemptId: crypto.randomUUID(),
    lastAttemptAt,
    leaseExpiresAt: new Date(lastAttemptAt.getTime() + EMAIL_LEASE_MS),
  };
};

const getApprovalEmailState = (order, now = Date.now()) => {
  const email = order?.approvalEmail;
  if (!email || !EMAIL_STATES.has(email.state)) return "unknown";
  if (email.state === "sending") {
    const expiry = asDate(email.leaseExpiresAt);
    if (!expiry || expiry.getTime() <= Number(now)) return "unknown";
  }
  return email.state;
};

const serializeAdminOrder = (order, now = Date.now()) => {
  const serialized = typeof order.toObject === "function" ? order.toObject() : { ...order };
  delete serialized.accessToken;
  delete serialized.approvalEmail;
  if (order.approvalEmail) {
    const email = order.approvalEmail;
    serialized.approvalEmail = { state: getApprovalEmailState(order, now) };
    for (const key of ["lastAttemptAt", "acceptedAt", "leaseExpiresAt"]) {
      const date = asDate(email[key]);
      if (date) serialized.approvalEmail[key] = date;
    }
  }
  return serialized;
};

const logOutcome = (orderId, outcome) => {
  const safeOrderId = typeof orderId === "string" && /^GP-\d{6}$/.test(orderId)
    ? orderId : "unknown-order";
  console.log(`Approval email ${safeOrderId}: ${outcome}`);
};

const dispatchApprovalEmail = async (order) => {
  const attempt = order?.approvalEmail;
  if (!attempt?.attemptId || attempt.state !== "sending") return;
  const attemptId = attempt.attemptId;

  let state;
  try {
    const emailOrder = typeof order.toObject === "function" ? order.toObject() : { ...order };
    delete emailOrder.approvalEmail;
    await sendApprovalEmail({ ...emailOrder, accessToken: order.accessToken });
    state = "accepted";
  } catch (error) {
    state = error?.code === "EMAIL_UNKNOWN" ? "unknown" : "failed";
  }

  const update = { $set: { "approvalEmail.state": state } };
  if (state === "accepted") update.$set["approvalEmail.acceptedAt"] = new Date();
  else update.$unset = { "approvalEmail.acceptedAt": "" };

  try {
    const result = await Order.updateOne(
      { _id: order._id, "approvalEmail.attemptId": attemptId, "approvalEmail.state": "sending" },
      update,
      { runValidators: true }
    );
    logOutcome(order.orderId, result.matchedCount ? state : "superseded");
  } catch {
    logOutcome(order.orderId, `${state}-state-not-saved`);
  }
};

module.exports = { createEmailAttempt, getApprovalEmailState, serializeAdminOrder, dispatchApprovalEmail };
