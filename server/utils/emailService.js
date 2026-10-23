require("dotenv").config();
const { buildPaymentLink, getCustomerPortalUrl } = require("../config/customerPortal");
const { isValidEmail, isValidPrice } = require("./orderValidation");

// Render blocks outbound SMTP, so we send via Brevo's HTTPS API instead of Gmail SMTP.
const BREVO_API_URL = "https://api.brevo.com/v3/smtp/email";
const EMAIL_TIMEOUT_MS = 10_000;
const emailError = (code, message) => Object.assign(new Error(message), { code });
const validateEmailSettings = (env = process.env) => {
  const invalid = ["BREVO_API_KEY", "GCASH_NAME", "GCASH_NUMBER", "BPI_NAME", "BPI_ACCOUNT"]
    .filter((name) => typeof env[name] !== "string" || !env[name].trim());
  if (typeof env.EMAIL_USER !== "string" || env.EMAIL_USER.trim().length > 254 || !isValidEmail(env.EMAIL_USER.trim())) {
    invalid.push("EMAIL_USER");
  }
  try {
    const facebookUrl = new URL(env.FB_PAGE);
    if (facebookUrl.protocol !== "https:" || !facebookUrl.hostname || facebookUrl.username || facebookUrl.password) {
      invalid.push("FB_PAGE");
    }
  } catch {
    invalid.push("FB_PAGE");
  }
  try {
    getCustomerPortalUrl(env);
  } catch {
    invalid.push("CUSTOMER_PORTAL_URL");
  }
  if (invalid.length) throw emailError("EMAIL_CONFIGURATION", `Invalid email configuration: ${invalid.join(", ")}`);
};
const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

const sendApprovalEmail = async (order) => {
  if (typeof order?.email !== "string" || order.email.trim().length > 254 || !isValidEmail(order.email.trim())) {
    throw emailError("EMAIL_INVALID_RECIPIENT", "Order has no valid recipient email.");
  }
  if (!isValidPrice(order.price)) throw emailError("EMAIL_INVALID_PRICE", "Order has no valid price.");
  validateEmailSettings();
  const total = order.price;
  const dp = (total * 0.5).toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const totalFmt = total.toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const paymentLink = buildPaymentLink(order.orderId, order.accessToken);

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#1d1d1f;padding:32px 40px;">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;color:#6e6e73;">${escapeHtml(process.env.BUSINESS_NAME || "GrandPrint")}</p>
    <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">Order Approved</h1>
  </div>

  <!-- Body -->
  <div style="padding:40px;">
    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 16px;">
      Good day, <strong>${escapeHtml(order.customerName)}!</strong>
    </p>

    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 16px;">
      We're happy to let you know that your order <strong>${escapeHtml(order.orderId)}</strong> has been reviewed and approved. Your <strong>${escapeHtml(order.productType)}</strong> — measuring <strong>${escapeHtml(order.width)} ft × ${escapeHtml(order.height)} ft</strong> for <strong>${escapeHtml(order.pieces)} piece${order.pieces > 1 ? "s" : ""}</strong> — is ready to go into production.
    </p>

    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 32px;">
      The total amount for your order is <strong>₱${escapeHtml(totalFmt)}</strong>. To begin production, we require a <strong>50% downpayment of ₱${escapeHtml(dp)}</strong>. The remaining balance of <strong>₱${escapeHtml(dp)}</strong> will be collected once your order is completed and ready for pickup or delivery.
    </p>

    <!-- Price box -->
    <div style="background:#f5f5f7;border-radius:14px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6e6e73;">Order Summary</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        <tr><td style="padding:6px 0;color:#3c3c43;">Downpayment due now (50%)</td><td style="text-align:right;font-weight:700;color:#1d1d1f;">₱${escapeHtml(dp)}</td></tr>
        <tr><td style="padding:6px 0;color:#3c3c43;">Balance upon completion (50%)</td><td style="text-align:right;font-weight:700;color:#1d1d1f;">₱${escapeHtml(dp)}</td></tr>
        <tr style="border-top:1px solid #d2d2d7;"><td style="padding:12px 0 0;font-weight:700;color:#1d1d1f;">Total</td><td style="text-align:right;padding:12px 0 0;font-weight:700;font-size:17px;color:#1d1d1f;">₱${escapeHtml(totalFmt)}</td></tr>
      </table>
    </div>

    <!-- Payment options -->
    <div style="background:#f5f5f7;border-radius:14px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6e6e73;">Payment Options</p>
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1d1d1f;">GCash</p>
      <p style="margin:0 0 20px;font-size:15px;color:#3c3c43;">${escapeHtml(process.env.GCASH_NUMBER)} &nbsp;·&nbsp; ${escapeHtml(process.env.GCASH_NAME)}</p>
      <div style="border-top:1px solid #d2d2d7;margin:16px 0;"></div>
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1d1d1f;">BPI Bank Transfer</p>
      <p style="margin:0;font-size:15px;color:#3c3c43;">Account Name: ${escapeHtml(process.env.BPI_NAME)}<br>Account Number: ${escapeHtml(process.env.BPI_ACCOUNT)}</p>
    </div>

    <!-- FB instructions -->
    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 16px;">
      After sending your payment, please upload the receipt using your <a href="${escapeHtml(paymentLink)}" style="color:#0071e3;text-decoration:none;font-weight:600;">private payment link</a>. Keep this link private. You can also message us on our <a href="${escapeHtml(process.env.FB_PAGE)}" style="color:#0071e3;text-decoration:none;font-weight:600;">Facebook page</a> along with this message format:
    </p>

    <div style="background:#fff8e7;border-left:4px solid #ff9f0a;border-radius:0 10px 10px 0;padding:18px 20px;margin-bottom:28px;font-family:'Courier New',monospace;font-size:14px;line-height:2;color:#1d1d1f;">
      Name: ${escapeHtml(order.customerName)}<br>
      Order ID: ${escapeHtml(order.orderId)}<br>
      [Attach payment screenshot]
    </div>

    <p style="font-size:15px;line-height:1.8;color:#6e6e73;margin:0;">
      If you have any questions, feel free to message us on Facebook. We appreciate your trust in <strong>${escapeHtml(process.env.BUSINESS_NAME || "GrandPrint")}</strong> and look forward to delivering your order!
    </p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #d2d2d7;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#aeaeb2;">${escapeHtml(process.env.BUSINESS_NAME || "GrandPrint")} · This is an automated email, please do not reply.</p>
  </div>

</div>
</body>
</html>`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
  try {
    const res = await fetch(BREVO_API_URL, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "api-key": process.env.BREVO_API_KEY.trim(),
        "content-type": "application/json",
        accept: "application/json",
      },
      body: JSON.stringify({
        sender: {
          name: process.env.BUSINESS_NAME || "GrandPrint",
          email: process.env.EMAIL_USER.trim(), // must be a verified sender in Brevo
        },
        to: [{ email: order.email.trim(), name: order.customerName }],
        subject: `Your Order ${order.orderId} is Approved — ₱${totalFmt}`,
        htmlContent: html,
      }),
    });
    if (res.status >= 400 && res.status < 500) {
      throw emailError("EMAIL_REJECTED", "Email provider rejected the request.");
    }
    if (!res.ok || res.status !== 201) throw emailError("EMAIL_UNKNOWN", "Email acceptance could not be confirmed.");
    const result = await res.json();
    if (typeof result?.messageId !== "string" || !result.messageId.trim()) {
      throw emailError("EMAIL_UNKNOWN", "Email acceptance could not be confirmed.");
    }
  } catch (error) {
    if (error?.code === "EMAIL_REJECTED") throw error;
    throw emailError("EMAIL_UNKNOWN", "Email acceptance could not be confirmed.");
  } finally {
    clearTimeout(timeout);
  }
};

module.exports = sendApprovalEmail;
module.exports.validateEmailSettings = validateEmailSettings;
