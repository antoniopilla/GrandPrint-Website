const nodemailer = require("nodemailer");
require("dotenv").config();

const sendApprovalEmail = async (order) => {
  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS,
    },
  });

  const total = Number(order.price);
  const dp = (total * 0.5).toLocaleString("en-PH", { minimumFractionDigits: 2 });
  const totalFmt = total.toLocaleString("en-PH", { minimumFractionDigits: 2 });

  const html = `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f5f5f7;font-family:-apple-system,BlinkMacSystemFont,'Helvetica Neue',Arial,sans-serif;">
<div style="max-width:600px;margin:40px auto;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

  <!-- Header -->
  <div style="background:#1d1d1f;padding:32px 40px;">
    <p style="margin:0;font-size:12px;font-weight:700;letter-spacing:0.12em;text-transform:uppercase;color:#6e6e73;">${process.env.BUSINESS_NAME || "GrandPrint"}</p>
    <h1 style="margin:8px 0 0;font-size:24px;font-weight:700;color:#ffffff;line-height:1.2;">Order Approved ✓</h1>
  </div>

  <!-- Body -->
  <div style="padding:40px;">
    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 16px;">
      Good day, <strong>${order.customerName}!</strong>
    </p>

    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 16px;">
      We're happy to let you know that your order <strong>${order.orderId}</strong> has been reviewed and approved. Your <strong>${order.productType}</strong> — measuring <strong>${order.width} ft × ${order.height} ft</strong> for <strong>${order.pieces} piece${order.pieces > 1 ? "s" : ""}</strong> — is ready to go into production.
    </p>

    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 32px;">
      The total amount for your order is <strong>₱${totalFmt}</strong>. To begin production, we require a <strong>50% downpayment of ₱${dp}</strong>. The remaining balance of <strong>₱${dp}</strong> will be collected once your order is completed and ready for pickup or delivery.
    </p>

    <!-- Price box -->
    <div style="background:#f5f5f7;border-radius:14px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6e6e73;">Order Summary</p>
      <table style="width:100%;border-collapse:collapse;font-size:15px;">
        <tr><td style="padding:6px 0;color:#3c3c43;">Downpayment due now (50%)</td><td style="text-align:right;font-weight:700;color:#1d1d1f;">₱${dp}</td></tr>
        <tr><td style="padding:6px 0;color:#3c3c43;">Balance upon completion (50%)</td><td style="text-align:right;font-weight:700;color:#1d1d1f;">₱${dp}</td></tr>
        <tr style="border-top:1px solid #d2d2d7;"><td style="padding:12px 0 0;font-weight:700;color:#1d1d1f;">Total</td><td style="text-align:right;padding:12px 0 0;font-weight:700;font-size:17px;color:#1d1d1f;">₱${totalFmt}</td></tr>
      </table>
    </div>

    <!-- Payment options -->
    <div style="background:#f5f5f7;border-radius:14px;padding:24px;margin-bottom:28px;">
      <p style="margin:0 0 16px;font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;color:#6e6e73;">Payment Options</p>
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1d1d1f;">GCash</p>
      <p style="margin:0 0 20px;font-size:15px;color:#3c3c43;">${process.env.GCASH_NUMBER} &nbsp;·&nbsp; ${process.env.GCASH_NAME}</p>
      <div style="border-top:1px solid #d2d2d7;margin:16px 0;"></div>
      <p style="margin:0 0 4px;font-size:15px;font-weight:700;color:#1d1d1f;">BPI Bank Transfer</p>
      <p style="margin:0;font-size:15px;color:#3c3c43;">Account Name: ${process.env.BPI_NAME}<br>Account Number: ${process.env.BPI_ACCOUNT}</p>
    </div>

    <!-- FB instructions -->
    <p style="font-size:16px;line-height:1.8;color:#1d1d1f;margin:0 0 16px;">
      After sending your payment, please message us on our <a href="${process.env.FB_PAGE}" style="color:#0071e3;text-decoration:none;font-weight:600;">Facebook page</a> and send your receipt along with this message format:
    </p>

    <div style="background:#fff8e7;border-left:4px solid #ff9f0a;border-radius:0 10px 10px 0;padding:18px 20px;margin-bottom:28px;font-family:'Courier New',monospace;font-size:14px;line-height:2;color:#1d1d1f;">
      Name: ${order.customerName}<br>
      Order ID: ${order.orderId}<br>
      [Attach payment screenshot]
    </div>

    <p style="font-size:15px;line-height:1.8;color:#6e6e73;margin:0;">
      If you have any questions, feel free to message us on Facebook. We appreciate your trust in <strong>${process.env.BUSINESS_NAME || "GrandPrint"}</strong> and look forward to delivering your order!
    </p>
  </div>

  <!-- Footer -->
  <div style="border-top:1px solid #d2d2d7;padding:20px 40px;text-align:center;">
    <p style="margin:0;font-size:12px;color:#aeaeb2;">${process.env.BUSINESS_NAME || "GrandPrint"} · This is an automated email, please do not reply.</p>
  </div>

</div>
</body>
</html>`;

  await transporter.sendMail({
    from: `"${process.env.BUSINESS_NAME || "GrandPrint"}" <${process.env.EMAIL_USER}>`,
    to: order.email,
    subject: `Your Order ${order.orderId} is Approved — ₱${totalFmt}`,
    html,
  });

  console.log(`Email sent → ${order.email} for ${order.orderId}`);
};

module.exports = sendApprovalEmail;