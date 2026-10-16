const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { createRequire } = require("node:module");
const { config, validateConfig, ownedSubdirectory } = require("./config.cjs");
const { checkAssetEntries } = require("./assets.cjs");
const serverRequire = createRequire(path.join(config.root, "server/package.json"));
const providerUrl = "https://api.brevo.com/v3/smtp/email";

function localUrl(value) {
  const url = new URL(value);
  if (!["http:", "https:"].includes(url.protocol) || url.hostname !== "127.0.0.1" || !["5212", "3212"].includes(url.port) || url.username || url.password) {
    throw new Error("Blocked a non-demo URL.");
  }
  return url;
}
function createStorage(directory) {
  return {
    async uploadBuffer(buffer) {
      if (ownedSubdirectory("assets") !== directory) throw new Error("Unexpected local upload directory.");
      checkAssetEntries(directory);
      if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 10_000_000) throw new Error("Invalid local upload.");
      let extension = "bin";
      if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) extension = "png";
      else if (buffer[0] === 255 && buffer[1] === 216) extension = "jpg";
      else if (buffer.subarray(0, 4).toString() === "%PDF") extension = "pdf";
      const filename = `upload-${crypto.randomUUID()}.${extension}`;
      fs.writeFileSync(path.join(directory, filename), buffer, { flag: "wx" });
      return { secure_url: `${config.apiOrigin}/portfolio-demo/assets/${filename}`, public_id: filename, resource_type: extension === "pdf" ? "raw" : "image", type: "upload" };
    },
    // Retain generated/uploaded local files; the screenshot setup never deletes files.
    async deleteUploadedAsset() { return true; },
    uploadedAssetFromUrl(value) {
      try {
        const url = localUrl(value);
        if (url.origin !== config.apiOrigin || !/^\/portfolio-demo\/assets\/[a-zA-Z0-9.-]+$/.test(url.pathname)) return null;
        return { public_id: path.basename(url.pathname), resource_type: url.pathname.endsWith(".pdf") ? "raw" : "image", type: "upload" };
      } catch { return null; }
    },
  };
}
function validateEnvelope(envelope) {
  if (!envelope || envelope.sender?.name !== "GrandPrint" || envelope.sender?.email !== "demo-sender@example.test" || !Array.isArray(envelope.to) || envelope.to.length !== 1 || !/^[a-z0-9.+_-]+@example\.test$/i.test(envelope.to[0].email)) throw new Error("Refusing non-demo mail identities.");
  if (typeof envelope.htmlContent !== "string" || envelope.htmlContent.length > 100_000 || typeof envelope.subject !== "string" || !envelope.subject.startsWith("Your Order GP-")) throw new Error("Invalid demo email.");
  for (const match of envelope.htmlContent.matchAll(/(?:href|src)="([^"]+)"/g)) localUrl(match[1].replaceAll("&amp;", "&"));
  return envelope;
}
function createFetchGuard(nativeFetch, deliver) {
  return async (input, options = {}) => {
    const url = typeof input === "string" ? input : input.url || input.href;
    if (url !== providerUrl) {
      localUrl(url);
      return nativeFetch(input, options);
    }
    if (options.method !== "POST") throw new Error("Invalid demo email method.");
    const envelope = validateEnvelope(JSON.parse(options.body));
    return deliver(envelope, options.signal);
  };
}
function cacheExport(file, exports) {
  require.cache[file] = { id: file, filename: file, loaded: true, exports };
}
function installAdapters(assetDirectory, deliver) {
  validateConfig();
  // emailService calls dotenv itself. Its process-local substitute cannot read any file.
  cacheExport(serverRequire.resolve("dotenv"), Object.freeze({ config: () => ({ parsed: {} }) }));
  cacheExport(path.join(config.root, "server/config/cloudinary.js"), createStorage(assetDirectory));
  Object.assign(process.env, {
    NODE_ENV: "development", ADMIN_PASSWORD: config.adminPassword,
    JWT_SECRET: crypto.randomBytes(48).toString("hex"),
    CUSTOMER_PORTAL_URL: config.clientOrigin, CLIENT_URL: config.clientOrigin,
    BUSINESS_NAME: "GrandPrint", EMAIL_USER: "demo-sender@example.test", BREVO_API_KEY: "local-capture-placeholder",
    GCASH_NAME: "SAMPLE DEMO ONLY", GCASH_NUMBER: "00000000000", BPI_NAME: "SAMPLE DEMO ONLY", BPI_ACCOUNT: "000000000000",
    // The original validator requires HTTPS. This inert contact URL remains loopback.
    FB_PAGE: "https://127.0.0.1:5212/portfolio-demo/contact",
  });
  const nativeFetch = globalThis.fetch;
  globalThis.fetch = createFetchGuard(nativeFetch, deliver || ((envelope, signal) => nativeFetch(`${config.apiOrigin}/portfolio-demo/mail/messages`, {
    method: "POST", signal, headers: { "content-type": "application/json", "X-Portfolio-Demo": config.marker }, body: JSON.stringify(envelope),
  })));
  return serverRequire;
}
function mailboxDirectory() {
  return ownedSubdirectory("mail");
}
module.exports = { localUrl, createStorage, validateEnvelope, createFetchGuard, installAdapters, mailboxDirectory };
