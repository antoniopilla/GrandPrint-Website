const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { config, requireOptIn, assertOrdinaryEntry } = require("./config.cjs");
const { installSocketGuard } = require("./network.cjs");
const { ensureFixtures, checkedAssetPath } = require("./assets.cjs");
const { installAdapters, validateEnvelope, mailboxDirectory } = require("./adapters.cjs");
const { validateDatabase } = require("./database.cjs");
const escape = value => String(value).replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" })[char]);

async function main() {
  requireOptIn();
  installSocketGuard();
  const assets = ensureFixtures();
  const localRequire = installAdapters(assets);
  const express = localRequire("express");
  const cors = localRequire("cors");
  const mongoose = localRequire("mongoose");
  await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 5000 });
  await validateDatabase(mongoose.connection.db);
  const mailDirectory = mailboxDirectory();
  const app = express();
  app.disable("x-powered-by");
  app.use(cors({ origin: config.clientOrigin, allowedHeaders: ["Content-Type", "Authorization", "X-Order-Access-Token"] }));
  app.use(express.json({ limit: "150kb" }));
  app.use((req, res, next) => {
    res.setHeader("X-Portfolio-Demo", "local-synthetic-data-only");
    const sendJson = res.json.bind(res);
    res.json = body => sendJson(JSON.parse(JSON.stringify(body).replace(/https?:\/\/(?:www\.)?messenger\.com\/[^\s"<>]+/g, `${config.apiOrigin}/portfolio-demo/contact`)));
    next();
  });
  app.get("/portfolio-demo/health", (_req, res) => res.json({ mode: "local-synthetic-only", api: config.apiOrigin, client: config.clientOrigin, database: config.database, mongoHost: "127.0.0.1:27027", uploads: "local", email: "local-http-capture", envFilesLoaded: false }));
  app.get("/portfolio-demo/contact", (_req, res) => res.type("text").send("GrandPrint local demo. External contact and real payments are disabled."));
  app.get("/portfolio-demo/assets/:name", (req, res) => {
    try {
      const file = checkedAssetPath(req.params.name);
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.sendFile(file);
    } catch { res.sendStatus(404); }
  });
  app.post("/portfolio-demo/mail/messages", (req, res) => {
    if (req.get("X-Portfolio-Demo") !== config.marker) return res.sendStatus(403);
    try {
      const envelope = validateEnvelope(req.body);
      const id = crypto.randomUUID();
      fs.writeFileSync(path.join(mailboxDirectory(), `${id}.json`), JSON.stringify({ id, receivedAt: new Date().toISOString(), ...envelope }), { flag: "wx" });
      return res.status(201).json({ messageId: `local-received-${id}` });
    } catch { return res.status(400).json({ message: "Only safe local demo messages can be received." }); }
  });
  const readMail = id => {
    if (!/^[a-f0-9-]{36}$/.test(id)) throw new Error("Invalid message.");
    const file = path.join(mailboxDirectory(), `${id}.json`);
    assertOrdinaryEntry(file, "file");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  };
  app.use("/portfolio-demo/mail", (_req, res, next) => {
    res.setHeader("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; frame-src 'self'; img-src 'self' data:; base-uri 'none'; form-action 'none'; frame-ancestors 'self'");
    res.setHeader("Cache-Control", "no-store"); next();
  });
  app.get("/portfolio-demo/mail", (_req, res) => {
    const messages = fs.readdirSync(mailDirectory).filter(name => /^[a-f0-9-]{36}\.json$/.test(name)).map(name => readMail(name.slice(0, -5))).sort((a, b) => b.receivedAt.localeCompare(a.receivedAt));
    res.type("html").send(`<!doctype html><title>GrandPrint local mail capture</title><style>body{font:16px system-ui;max-width:900px;margin:36px auto;background:#f5f5f7}article{background:white;padding:24px;margin:20px 0;border:1px solid #ddd}iframe{width:100%;height:1400px;border:0}small{color:#666}</style><h1>GrandPrint local mail capture</h1><p>Received locally. Synthetic recipients and payment details only. No external email delivery.</p>${messages.length ? messages.map(mail => `<article><h2>${escape(mail.subject)}</h2><p>From: ${escape(mail.sender.name)} &lt;${escape(mail.sender.email)}&gt;<br>To: ${escape(mail.to[0].email)}</p><small>Received locally: ${escape(mail.receivedAt)}</small><iframe title="Received approval email" sandbox src="/portfolio-demo/mail/${mail.id}/body"></iframe></article>`).join("") : "<p>No local messages received yet. Approve a sample order using the local app.</p>"}`);
  });
  app.get("/portfolio-demo/mail/:id/body", (req, res) => {
    try { res.type("html").send(readMail(req.params.id).htmlContent); } catch { res.sendStatus(404); }
  });
  app.use("/api/orders", localRequire(path.join(config.root, "server/routes/orderRoutes.js")));
  app.use("/api/admin", localRequire(path.join(config.root, "server/routes/adminRoutes.js")));
  app.use("/api/customers", localRequire(path.join(config.root, "server/routes/customerRoutes.js")));
  app.use(localRequire(path.join(config.root, "server/middleware/errorHandler.js")));
  const server = app.listen(config.apiPort, config.host, () => console.log(`GrandPrint local demo API: ${config.apiOrigin}; mail: ${config.apiOrigin}/portfolio-demo/mail`));
  server.on("error", async error => { console.error(error.message); await mongoose.disconnect(); process.exitCode = 1; });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => server.close(() => mongoose.disconnect().then(() => process.exit(0))));
}
main().catch(error => { console.error(error.message); process.exit(1); });
