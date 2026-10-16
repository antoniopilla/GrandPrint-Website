const crypto = require("node:crypto");
const path = require("node:path");
const { createRequire } = require("node:module");
const { config, requireOptIn } = require("./config.cjs");
const { ensureFixtures } = require("./assets.cjs");
const { validateDatabase } = require("./database.cjs");
const { installSocketGuard } = require("./network.cjs");

async function main() {
  requireOptIn();
  installSocketGuard();
  const localRequire = createRequire(path.join(config.root, "server/package.json"));
  const mongoose = localRequire("mongoose");
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  try {
    await validateDatabase(mongoose.connection.db, true);
    const assets = ensureFixtures();
    const Order = localRequire(path.join(config.root, "server/models/Order.js"));
    const statuses = ["Pending Approval", "Pending Approval", "Awaiting Downpayment", "Payment Submitted", "Printing", "Completed"];
    const now = new Date();
    await mongoose.connection.db.collection("portfolio_demo_meta").updateOne({ _id: config.marker }, { $setOnInsert: { createdAt: now, mode: "local-synthetic-only" } }, { upsert: true });
    for (const [index, status] of statuses.entries()) {
      const letter = String.fromCharCode(65 + index);
      const fixture = {
        orderId: `GP-${String(900101 + index)}`,
        accessToken: crypto.randomBytes(32).toString("base64url"),
        customerName: `Sample Customer ${letter}`, email: `sample.customer.${letter.toLowerCase()}@example.test`, contactNumber: "09000000000",
        productType: ["Tarpaulin", "Sticker", "Sintra Board"][index % 3], width: 3, height: 2, pieces: index % 2 + 1,
        notes: "Sample order for local demonstration. Synthetic test data only.",
        designFile: `${config.apiOrigin}/portfolio-demo/assets/sample-artwork.png`,
        status, archivedAt: null, createdAt: now, updatedAt: now,
        ...(index >= 2 ? { price: 1200 } : {}),
        ...(status === "Payment Submitted" ? { paymentProof: `${config.apiOrigin}/portfolio-demo/assets/sample-payment-receipt.png` } : {}),
      };
      await new Order(fixture).validate();
      // Existing fixture state is preserved; rerunning never resets orders or drops data.
      await Order.updateOne({ orderId: fixture.orderId }, { $setOnInsert: fixture }, { upsert: true, runValidators: true, timestamps: false });
    }
    console.log(`Local synthetic fixtures ready in ${config.database}. Generated assets: ${assets}. Existing order state was preserved.`);
  } finally { await mongoose.disconnect(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
