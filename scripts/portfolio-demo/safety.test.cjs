const assert = require("node:assert/strict");
const { test } = require("node:test");
const { config, validateConfig, requireOptIn, assertOrdinaryEntry } = require("./config.cjs");
const { assertSocketTarget, installSocketGuard } = require("./network.cjs");
const { fixturePng, checkedAssetEntry, checkAssetEntries } = require("./assets.cjs");
const { localUrl, validateEnvelope, createFetchGuard, installAdapters } = require("./adapters.cjs");
const { createRequire } = require("node:module");
const path = require("node:path");
const serverRequire = createRequire(path.join(config.root, "server/package.json"));

test("database and origin substitutions fail closed", () => {
  for (const [key, value] of Object.entries({ mongoUri: "mongodb://127.0.0.1:27017/printingPOS", database: "another_database", apiOrigin: "https://example.test", clientOrigin: "http://localhost:3000", stateDir: path.dirname(config.stateDir) })) {
    assert.throws(() => validateConfig({ ...config, [key]: value }));
  }
  assert.throws(() => requireOptIn([], {}));
  assert.throws(() => requireOptIn(["--confirm-local"], {}));
  requireOptIn(["--confirm-local"], { GRANDPRINT_PORTFOLIO_DEMO: "1" });
});
test("external service and alternate-port URLs are rejected", () => {
  for (const url of ["https://example.test", "http://127.0.0.1:27017", "http://localhost:5212", "http://user@127.0.0.1:5212"]) assert.throws(() => localUrl(url));
  assert.equal(localUrl(config.apiOrigin).origin, config.apiOrigin);
});
test("the process-wide TCP boundary blocks HTTP, HTTPS, SMTP and alternate Mongo ports", () => {
  for (const target of [{ host: "example.test", port: 443 }, { host: "127.0.0.1", port: 27017 }, { host: "localhost", port: 27027 }, { host: "127.0.0.1", port: 25 }, { path: "some-socket" }]) assert.throws(() => assertSocketTarget([target], [5212, 27027]));
  assertSocketTarget([{ host: "127.0.0.1", port: 27027 }], [5212, 27027]);
  const restore = installSocketGuard();
  try { assert.throws(() => new (require("node:net").Socket)().connect({ host: "example.test", port: 443 }), /Blocked outbound socket/); }
  finally { restore(); }
});
test("storage rejects junctions, symlinks and redirected children", () => {
  const file = path.join(config.stateDir, "assets");
  assert.throws(() => assertOrdinaryEntry(file, "directory", { lstatSync: () => ({ isSymbolicLink: () => true }) }));
  assert.throws(() => assertOrdinaryEntry(file, "directory", { lstatSync: () => ({ isSymbolicLink: () => false, isDirectory: () => true }), realpathSync: () => path.dirname(file) }));
});
test("asset serving and writes reject unexpected names, linked entries, and dangling links", () => {
  const directory = path.join(config.stateDir, "assets");
  const normal = { isSymbolicLink: () => false, isDirectory: () => true, isFile: () => true };
  const linked = { isSymbolicLink: () => true };
  const fake = { lstatSync: file => file === directory ? normal : linked, realpathSync: file => file, readdirSync: () => ["sample-artwork.png"] };
  assert.throws(() => checkedAssetEntry(directory, "unrecognized-private-file.png", fake), /Unexpected asset name/);
  assert.throws(() => checkedAssetEntry(directory, "..\\sample-artwork.png", fake), /Unexpected asset name/);
  assert.throws(() => checkedAssetEntry(directory, "sample-artwork.png", fake), /linked/);
  assert.throws(() => checkAssetEntries(directory, fake), /linked/);
  // No existsSync lookup is used; dangling symbolic links are rejected by lstat.
  assert.equal("existsSync" in fake, false);
  const ordinary = { ...fake, lstatSync: () => normal };
  assert.equal(checkedAssetEntry(directory, "sample-artwork.png", ordinary), path.join(directory, "sample-artwork.png"));
});
test("generated artwork and receipt are valid bounded PNG fixtures", () => {
  const { getImageDimensions } = serverRequire("./utils/imageDimensions");
  assert.deepEqual(getImageDimensions(fixturePng(), "png"), { width: 1000, height: 667 });
  assert.deepEqual(getImageDimensions(fixturePng(true), "png"), { width: 1000, height: 900 });
  assert(fixturePng(true).length < 500_000);
});
test("mail mock only accepts synthetic identities and local links", async () => {
  const envelope = { sender: { name: "GrandPrint", email: "demo-sender@example.test" }, to: [{ email: "sample.customer.a@example.test" }], subject: "Your Order GP-900101 is Approved", htmlContent: `<a href="${config.clientOrigin}/pay/GP-900101">Private payment link</a>` };
  validateEnvelope(envelope);
  assert.throws(() => validateEnvelope({ ...envelope, to: [{ email: "person@example.com" }] }));
  assert.throws(() => validateEnvelope({ ...envelope, htmlContent: '<img src="https://example.test/a.png">' }));
  let received = 0;
  const guarded = createFetchGuard(() => { throw new Error("Unexpected network request"); }, async mail => { received++; assert.equal(mail.subject, envelope.subject); return new Response(JSON.stringify({ messageId: "local-received-test" }), { status: 201 }); });
  assert.equal((await guarded("https://api.brevo.com/v3/smtp/email", { method: "POST", body: JSON.stringify(envelope) })).status, 201);
  assert.equal(received, 1);
  await assert.rejects(guarded("https://example.test"));
});
test("the actual approval renderer delivers its template through the local adapter without dotenv reads", async () => {
  const priorFetch = globalThis.fetch;
  let received;
  try {
    const localRequire = installAdapters(path.join(config.stateDir, "assets"), async envelope => {
      received = validateEnvelope(envelope);
      return new Response(JSON.stringify({ messageId: "local-received-renderer-test" }), { status: 201 });
    });
    assert.deepEqual(localRequire("dotenv").config(), { parsed: {} });
    const send = localRequire("./utils/emailService");
    await send({ orderId: "GP-900101", customerName: "Sample Customer A", email: "sample.customer.a@example.test", productType: "Tarpaulin", width: 3, height: 2, pieces: 2, price: 1200, accessToken: "a".repeat(43) });
    assert.match(received.subject, /GP-900101/);
    assert.match(received.htmlContent, /Order Approved/);
    assert.match(received.htmlContent, /SAMPLE DEMO ONLY/);
    assert.match(received.htmlContent, /127\.0\.0\.1:3212\/pay\/GP-900101/);
  } finally { globalThis.fetch = priorFetch; }
});
test("installed Vite resolves the actual demo options without opening any environment file", async () => {
  const fs = require("node:fs");
  const { syncBuiltinESMExports } = require("node:module");
  const { pathToFileURL } = require("node:url");
  const { viteIsolationOptions } = require("./client.cjs");
  const clientRequire = createRequire(path.join(config.root, "client/package.json"));
  let attempts = 0;
  const originals = { readFile: fs.readFile, readFileSync: fs.readFileSync, promisesReadFile: fs.promises.readFile };
  const guard = original => function (file, ...args) {
    if (typeof file === "string" && /^\.env(?:\.|$)/i.test(path.basename(file))) { attempts++; throw new Error("Environment-file read blocked by test sentinel."); }
    return original.call(this, file, ...args);
  };
  fs.readFile = guard(originals.readFile); fs.readFileSync = guard(originals.readFileSync); fs.promises.readFile = guard(originals.promisesReadFile); syncBuiltinESMExports();
  try {
    const { resolveConfig } = await import(pathToFileURL(clientRequire.resolve("vite")).href);
    const resolved = await resolveConfig(viteIsolationOptions(), "serve");
    assert.equal(resolved.envDir, false); assert.equal(resolved.configFile, undefined); assert.equal(attempts, 0);
  } finally { fs.readFile = originals.readFile; fs.readFileSync = originals.readFileSync; fs.promises.readFile = originals.promisesReadFile; syncBuiltinESMExports(); }
});
