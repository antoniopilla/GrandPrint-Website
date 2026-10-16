const { config, validateConfig } = require("./config.cjs");
async function validateDatabase(db, allowEmpty = false) {
  validateConfig();
  if (db.databaseName !== config.database) throw new Error("Refusing another database.");
  const names = (await db.listCollections({}, { nameOnly: true }).toArray()).map(item => item.name);
  if (names.some(name => !["orders", "portfolio_demo_meta"].includes(name))) throw new Error("Unexpected demo database collection; no data changed.");
  const marker = await db.collection("portfolio_demo_meta").findOne({ _id: config.marker });
  const count = await db.collection("orders").countDocuments({});
  const metaCount = await db.collection("portfolio_demo_meta").countDocuments({});
  if (!marker && !(allowEmpty && count === 0 && metaCount === 0)) throw new Error("Seeded local database ownership marker missing.");
  if (count && await db.collection("orders").countDocuments({ email: { $not: /@example\.test$/i } })) throw new Error("Non-fixture email found; refusing database access.");
}
module.exports = { validateDatabase };
