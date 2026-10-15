/* Run with: node --test server/tests/order-admin.test.js
 * The real router, JWT auth, multipart parsing, upload validation, validation
 * helpers, serializers, and Cloudinary URL parser run against an in-memory DB.
 * No MongoDB, Cloudinary credentials, network services, or test packages needed.
 */
const assert = require("node:assert/strict");
const { after, before, beforeEach, test } = require("node:test");
const express = require("express");
const jwt = require("jsonwebtoken");
const Order = require("../models/Order");
const priorCloudName = process.env.CLOUDINARY_CLOUD_NAME;
process.env.CLOUDINARY_CLOUD_NAME = "grandprint";
const cloudinary = require("../config/cloudinary");

const ID = "507f1f77bcf86cd799439011";
const OTHER_ID = "507f1f77bcf86cd799439012";
const TOKEN = "a".repeat(43);
const OLD_DESIGN = "https://res.cloudinary.com/grandprint/image/upload/v123/grandprint/designs/old.png";
const OLD_PROOF = "https://res.cloudinary.com/grandprint/raw/upload/v123/grandprint/payments/receipt.pdf";
const NEW_ASSET = {
  secure_url: "https://res.cloudinary.com/grandprint/image/upload/v124/grandprint/designs/new.png",
  public_id: "grandprint/designs/new",
  resource_type: "image",
  type: "upload",
};
const clone = (value) => value == null ? value : structuredClone(value);
const baseline = (overrides = {}) => ({
  _id: ID,
  orderId: "GP-123456",
  accessToken: TOKEN,
  customerName: "Original Customer",
  email: "original@example.com",
  contactNumber: "09123456789",
  productType: "Tarpaulin",
  width: 2,
  height: 3,
  pieces: 4,
  notes: "Original notes",
  designFile: OLD_DESIGN,
  paymentProof: OLD_PROOF,
  status: "Pending Approval",
  archivedAt: null,
  price: 1200,
  approvalEmail: { state: "accepted", attemptId: "private-attempt", acceptedAt: new Date("2026-01-01"), lastAttemptAt: new Date("2026-01-01"), leaseExpiresAt: new Date("2026-01-01") },
  createdAt: new Date("2026-01-01"),
  ...overrides,
});

let state;
let server;
let baseUrl;
const priorSecret = process.env.JWT_SECRET;
process.env.JWT_SECRET = "order-admin-regression-tests-only";
const adminToken = jwt.sign({ admin: true }, process.env.JWT_SECRET);

const same = (actual, expected) => expected == null
  ? actual == null
  : actual instanceof Date || expected instanceof Date
    ? new Date(actual).getTime() === new Date(expected).getTime()
    : String(actual) === String(expected);
const matches = (order, filter = {}) => Boolean(order) && Object.entries(filter).every(([key, expected]) => {
  if (key === "$or") return expected.some((part) => matches(order, part));
  if (key === "$and") return expected.every((part) => matches(order, part));
  const actual = key.split(".").reduce((value, field) => value?.[field], order);
  if (expected && typeof expected === "object" && !(expected instanceof Date)) {
    return Object.entries(expected).every(([operator, value]) => {
      if (operator === "$ne") return !same(actual, value);
      if (operator === "$eq") return same(actual, value);
      if (operator === "$exists") return (actual !== undefined) === value;
      if (operator === "$in") return value.some((item) => same(actual, item));
      throw new Error(`Unsupported fake DB operator: ${operator}`);
    });
  }
  return same(actual, expected);
});
const query = (execute) => {
  let promise;
  const result = {
    select(selection) { state.selections.push(selection); return result; },
    sort(sort) { state.sorts.push(clone(sort)); return result; },
    lean() { return result; },
    exec() { promise ??= Promise.resolve().then(execute); return promise; },
    then(resolve, reject) { return result.exec().then(resolve, reject); },
  };
  return result;
};
const findRecord = (filter) => state.orders.find((order) => matches(order, filter));
Order.find = (filter = {}) => query(() => {
  state.reads.push({ method: "find", filter: clone(filter) });
  return clone(state.orders.filter((order) => matches(order, filter)).sort((a, b) => b.createdAt - a.createdAt));
});
Order.findById = (id) => query(() => {
  state.reads.push({ method: "findById", filter: { _id: String(id) } });
  return clone(findRecord({ _id: id }));
});
Order.findOne = (filter) => query(() => {
  state.reads.push({ method: "findOne", filter: clone(filter) });
  return clone(findRecord(filter));
});
Order.exists = (filter) => query(() => {
  state.reads.push({ method: "exists", filter: clone(filter) });
  const order = findRecord(filter);
  return order ? { _id: order._id } : null;
});
Order.findOneAndUpdate = (filter, update, options) => query(() => {
  state.events.push("write");
  state.writes.push({ method: "findOneAndUpdate", filter: clone(filter), update: clone(update), options: clone(options) });
  state.beforeWrite?.();
  if (state.writeError) throw state.writeError;
  const order = findRecord(filter);
  if (!order) return null;
  const old = clone(order);
  Object.assign(order, clone(update.$set || update));
  return clone(options?.new ? order : old);
});
Order.findOneAndDelete = (filter) => query(() => {
  state.events.push("delete");
  state.writes.push({ method: "findOneAndDelete", filter: clone(filter) });
  state.beforeDelete?.();
  if (state.deleteError) throw state.deleteError;
  const index = state.orders.findIndex((order) => matches(order, filter));
  return index === -1 ? null : clone(state.orders.splice(index, 1)[0]);
});
cloudinary.uploadBuffer = async (buffer, folder) => {
  state.events.push("upload");
  state.uploads.push({ bytes: buffer.length, folder });
  if (state.uploadError) throw state.uploadError;
  state.afterUpload?.();
  return clone(NEW_ASSET);
};
cloudinary.deleteUploadedAsset = async (asset) => {
  state.events.push("cleanup");
  state.cleanups.push(clone(asset));
  if (state.cleanupError) throw state.cleanupError;
  return state.cleanupResult;
};

const app = express();
app.use(express.json());
app.use("/api/orders", require("../routes/orderRoutes"));
app.use("/api/customers", require("../routes/customerRoutes"));
app.use((error, _req, res, _next) => res.status(500).json({ message: error.message }));

before(async () => {
  server = await new Promise((resolve) => {
    const listening = app.listen(0, "127.0.0.1", () => resolve(listening));
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  if (priorSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = priorSecret;
  if (priorCloudName === undefined) delete process.env.CLOUDINARY_CLOUD_NAME;
  else process.env.CLOUDINARY_CLOUD_NAME = priorCloudName;
});
beforeEach(() => {
  state = { orders: [baseline()], reads: [], writes: [], selections: [], sorts: [], events: [], uploads: [], cleanups: [], cleanupResult: true };
});

const request = async (method, path = `/${ID}`, { fields, file, authenticated = true, headers = {} } = {}) => {
  const body = fields || file ? new FormData() : undefined;
  for (const [key, value] of Object.entries(fields || {})) body.append(key, value);
  if (file) body.append(file.field || "designFile", new Blob([file.bytes || Buffer.from("%PDF-1.7\nTest artwork")], { type: file.type || "application/pdf" }), file.name || "artwork.pdf");
  const response = await fetch(`${baseUrl}/api${path.startsWith("/customers/") ? path : `/orders${path}`}`, {
    method,
    headers: { ...(authenticated ? { Authorization: `Bearer ${adminToken}` } : {}), ...headers },
    body,
  });
  const text = await response.text();
  let data;
  try { data = JSON.parse(text); } catch { data = { text }; }
  return { status: response.status, body: data };
};
const assertNoMutation = () => {
  assert.equal(state.writes.length, 0);
  assert.equal(state.uploads.length, 0);
  assert.equal(state.cleanups.length, 0);
};
const assertNewAssetCleaned = () => {
  assert.equal(state.cleanups.length, 1);
  assert.equal(state.cleanups[0].public_id, NEW_ASSET.public_id);
  assert.equal(state.orders[0].designFile, OLD_DESIGN);
};

test("Order schema defaults archivedAt to null and indexes it", () => {
  assert.equal(new Order().archivedAt, null);
  assert.ok(Order.schema.indexes().some(([fields]) => fields.archivedAt === 1));
});

test("stored Cloudinary URL parsing preserves raw extensions and handles versioned image/PDF paths", () => {
  const { uploadedAssetFromUrl } = cloudinary;
  assert.deepEqual(uploadedAssetFromUrl(OLD_PROOF), {
    public_id: "grandprint/payments/receipt.pdf", resource_type: "raw", type: "upload",
  });
  assert.deepEqual(uploadedAssetFromUrl("https://res.cloudinary.com/grandprint/image/upload/c_scale,w_100/v123/grandprint/designs/customer%20file.pdf"), {
    public_id: "grandprint/designs/customer file", resource_type: "image", type: "upload",
  });
  assert.deepEqual(uploadedAssetFromUrl("https://res.cloudinary.com/grandprint/image/upload/grandprint/designs/old.png"), {
    public_id: "grandprint/designs/old", resource_type: "image", type: "upload",
  });
  for (const value of [null, "not a URL", "https://example.com/image/upload/v123/design.png", "https://res.cloudinary.com/other-cloud/image/upload/v123/design.png", "https://res.cloudinary.com/grandprint/image/private/v123/design.png"]) {
    assert.equal(uploadedAssetFromUrl(value), null);
  }
});

test("all new admin endpoints require authentication before upload or writes", async () => {
  for (const [method, path] of [["PUT", `/${ID}`], ["PUT", `/${ID}/archive`], ["PUT", `/${ID}/restore`], ["DELETE", `/${ID}`], ["GET", "/"]]) {
    const response = await request(method, path, { authenticated: false, ...(method === "PUT" && path === `/${ID}` ? { file: {} } : {}) });
    assert.equal(response.status, 401, `${method} ${path}`);
  }
  assertNoMutation();
});

test("all new mutation routes reject malformed IDs with API errors", async () => {
  for (const [method, path] of [["PUT", "/invalid"], ["PUT", "/invalid/archive"], ["PUT", "/invalid/restore"], ["DELETE", "/invalid"]]) {
    const response = await request(method, path);
    assert.equal(response.status, 400, `${method} ${path}`);
    assert.equal(typeof response.body.code, "string");
    assert.equal(typeof response.body.message, "string");
  }
  assertNoMutation();
});

test("valid but nonexistent IDs return 404 on all new routes", async () => {
  for (const [method, suffix] of [["PUT", ""], ["PUT", "/archive"], ["PUT", "/restore"], ["DELETE", ""]]) {
    const response = await request(method, `/${OTHER_ID}${suffix}`, { ...(suffix === "" && method === "PUT" ? { fields: { notes: "new" } } : {}) });
    assert.equal(response.status, 404, `${method} ${suffix}`);
  }
  assert.equal(state.uploads.length, 0);
  assert.equal(state.cleanups.length, 0);
});

test("partial text edits trim supplied values and leave omitted fields intact", async () => {
  const response = await request("PUT", undefined, { fields: { customerName: "  Updated Customer  ", notes: "  New notes  " } });
  assert.equal(response.status, 200);
  assert.equal(response.body.customerName, "Updated Customer");
  assert.equal(response.body.notes, "New notes");
  assert.equal(response.body.email, "original@example.com");
  assert.equal(response.body.width, 2);
  assert.equal(response.body.accessToken, undefined);
  assert.equal(response.body.approvalEmail.attemptId, undefined);
  assert.equal(state.writes[0].filter.archivedAt, null);
  assert.equal(state.writes[0].options.runValidators, true);
});

test("partial edits validate only supplied fields, including legacy orders", async () => {
  delete state.orders[0].email;
  const response = await request("PUT", undefined, { fields: { notes: "Fixing another detail" } });
  assert.equal(response.status, 200);
  assert.equal(state.orders[0].email, undefined);
  assert.equal(state.orders[0].notes, "Fixing another detail");
});

test("edit validates each customer field before upload and DB mutation", async (t) => {
  for (const [field, value] of [["customerName", " "], ["email", "invalid-email"], ["contactNumber", ""], ["productType", "Unknown"], ["width", "0"], ["width", "101"], ["height", "NaN"], ["pieces", "1.5"], ["pieces", "10001"], ["notes", "x".repeat(5001)]]) {
    await t.test(`${field}: ${value.slice(0, 20)}`, async () => {
      const response = await request("PUT", undefined, { fields: { [field]: value }, file: {} });
      assert.equal(response.status, 400);
      assert.equal(response.body.code, "VALIDATION_ERROR");
      assert.equal(typeof response.body.errors[field], "string");
      assertNoMutation();
    });
  }
});

test("protected and unknown multipart fields cannot overwrite order data", async (t) => {
  for (const field of ["orderId", "accessToken", "status", "price", "paymentProof", "approvalEmail", "createdAt", "archivedAt", "designFile", "unknownField"]) {
    await t.test(field, async () => {
      const original = clone(state.orders[0]);
      const response = await request("PUT", undefined, { fields: { notes: "Allowed edit", [field]: "malicious-value" } });
      assert.ok([200, 400].includes(response.status));
      assert.deepEqual(state.orders[0][field], original[field]);
      assert.equal(state.uploads.length, 0);
      assert.equal(state.cleanups.length, 0);
    });
  }
});

test("every approved status locks every pricing field and replacement file before upload", async (t) => {
  for (const status of ["Awaiting Downpayment", "Payment Submitted", "Printing", "Completed", "Fully Paid"]) {
    for (const [field, value] of [["productType", "Sticker"], ["width", "5"], ["height", "5"], ["pieces", "5"], ["designFile", null]]) {
      await t.test(`${status}: ${field}`, async () => {
        state.orders[0].status = status;
        const originalNotes = state.orders[0].notes;
        const response = await request("PUT", undefined, {
          fields: { notes: "Must be rejected too", ...(field === "designFile" ? {} : { [field]: value }) },
          ...(field === "designFile" ? { file: {} } : {}),
        });
        assert.equal(response.status, 409);
        assert.equal(response.body.code, "QUOTE_LOCKED");
        assert.ok(response.body.blockedFields.includes(field));
        assert.equal(state.orders[0].notes, originalNotes);
        assertNoMutation();
      });
    }
  }
});

test("full approved edit form accepts numerically unchanged pricing and all text fields", async () => {
  state.orders[0].status = "Awaiting Downpayment";
  const response = await request("PUT", undefined, { fields: {
    customerName: "  Updated  ", email: "new@example.com", contactNumber: "09987654321", notes: "  Changed  ",
    productType: "Tarpaulin", width: "02.000", height: "3e0", pieces: "+04",
  } });
  assert.equal(response.status, 200);
  assert.equal(response.body.customerName, "Updated");
  assert.equal(response.body.email, "new@example.com");
  assert.equal(response.body.contactNumber, "09987654321");
  assert.equal(response.body.notes, "Changed");
  assert.equal(response.body.width, 2);
  assert.equal(response.body.height, 3);
  assert.equal(response.body.pieces, 4);
  assert.equal(state.writes[0].filter.status, undefined);
  assert.equal(state.uploads.length, 0);
});

test("pending order pricing edits are coerced and guarded against concurrent approval", async () => {
  const response = await request("PUT", undefined, { fields: { productType: "Sintra Board", width: "4.5", height: "6", pieces: "10" } });
  assert.equal(response.status, 200);
  assert.equal(response.body.productType, "Sintra Board");
  assert.equal(response.body.width, 4.5);
  assert.equal(response.body.height, 6);
  assert.equal(response.body.pieces, 10);
  assert.equal(state.writes[0].filter.status, "Pending Approval");
  assert.equal(state.writes[0].filter.archivedAt, null);
});

test("archived order rejects editing text or file without uploading", async () => {
  state.orders[0].archivedAt = new Date();
  const response = await request("PUT", undefined, { fields: { notes: "Blocked" }, file: {} });
  assert.equal(response.status, 409);
  assert.match(response.body.message, /restor|archiv/i);
  assertNoMutation();
});

test("replacement upload commits new URL before deleting the previous asset", async () => {
  const response = await request("PUT", undefined, { fields: { notes: "New artwork" }, file: {} });
  assert.equal(response.status, 200);
  assert.equal(response.body.designFile, NEW_ASSET.secure_url);
  assert.deepEqual(state.events, ["upload", "write", "cleanup"]);
  assert.equal(state.uploads[0].folder, "grandprint/designs");
  assert.equal(state.writes[0].filter.status, "Pending Approval");
  assert.equal(state.writes[0].filter.archivedAt, null);
  assert.equal(state.writes[0].options.runValidators, true);
  assert.equal(state.cleanups[0].public_id, "grandprint/designs/old");
  assert.equal(state.cleanups[0].resource_type, "image");
});

test("real upload middleware rejects bad extensions, MIME, signatures, dimensions and oversized files", async (t) => {
  const largePng = Buffer.alloc(33);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(largePng);
  largePng.writeUInt32BE(13, 8);
  largePng.write("IHDR", 12);
  largePng.writeUInt32BE(5001, 16);
  largePng.writeUInt32BE(5000, 20);
  const oversizedPdf = Buffer.alloc(10_000_001);
  oversizedPdf.write("%PDF");
  for (const [label, file] of [
    ["extension", { name: "artwork.exe", type: "application/octet-stream" }],
    ["MIME", { name: "artwork.pdf", type: "text/plain" }],
    ["signature", { bytes: Buffer.from("not actually a PDF") }],
    ["missing image dimensions", { name: "artwork.png", type: "image/png", bytes: largePng.subarray(0, 8) }],
    ["25 megapixel limit", { name: "artwork.png", type: "image/png", bytes: largePng }],
    ["10 MB limit", { bytes: oversizedPdf }],
  ]) {
    await t.test(label, async () => {
      const response = await request("PUT", undefined, { file });
      assert.equal(response.status, 400);
      assertNoMutation();
      assert.equal(state.orders[0].designFile, OLD_DESIGN);
    });
  }
});

test("failed Cloudinary upload preserves order and old artwork", async () => {
  state.uploadError = new Error("Simulated upload failure");
  const response = await request("PUT", undefined, { file: {} });
  assert.equal(response.status, 422);
  assert.equal(state.writes.length, 0);
  assert.equal(state.cleanups.length, 0);
  assert.equal(state.orders[0].designFile, OLD_DESIGN);
});

test("rejected DB replacement write removes new upload and keeps old artwork", async () => {
  state.writeError = Object.assign(new Error("Simulated validation failure"), { name: "ValidationError" });
  const response = await request("PUT", undefined, { file: {} });
  assert.equal(response.status, 400);
  assertNewAssetCleaned();
});

test("DB replacement failure removes new upload and keeps old artwork", async () => {
  state.writeError = new Error("Simulated DB failure");
  const response = await request("PUT", undefined, { file: {} });
  assert.equal(response.status, 500);
  assertNewAssetCleaned();
});

test("approval landing during upload blocks replacement and cleans only new upload", async () => {
  state.afterUpload = () => { state.orders[0].status = "Awaiting Downpayment"; };
  const response = await request("PUT", undefined, { fields: { notes: "Must not apply" }, file: {} });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "QUOTE_LOCKED");
  assert.ok(response.body.blockedFields.includes("designFile"));
  assert.equal(state.orders[0].notes, "Original notes");
  assertNewAssetCleaned();
});

test("approval landing before pricing-only write blocks changed pricing atomically", async () => {
  state.beforeWrite = () => { state.orders[0].status = "Awaiting Downpayment"; };
  const response = await request("PUT", undefined, { fields: { width: "5", notes: "Must not apply" } });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "QUOTE_LOCKED");
  assert.equal(state.orders[0].width, 2);
  assert.equal(state.orders[0].notes, "Original notes");
});

test("archive landing during upload prevents replacement and cleans only new asset", async () => {
  state.afterUpload = () => { state.orders[0].archivedAt = new Date(); };
  const response = await request("PUT", undefined, { file: {} });
  assert.equal(response.status, 409);
  assertNewAssetCleaned();
});

test("concurrent design replacement preserves the winner and cleans only the losing new upload", async () => {
  const winningUrl = "https://res.cloudinary.com/grandprint/image/upload/v125/grandprint/designs/winner.png";
  state.afterUpload = () => { state.orders[0].designFile = winningUrl; };
  const response = await request("PUT", undefined, { file: {} });
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "ORDER_CONFLICT");
  assert.equal(state.writes[0].filter.designFile, OLD_DESIGN);
  assert.equal(state.orders[0].designFile, winningUrl);
  assert.equal(state.cleanups.length, 1);
  assert.equal(state.cleanups[0].public_id, NEW_ASSET.public_id);
});

test("order disappearing during upload returns 404 and removes new upload", async () => {
  state.afterUpload = () => { state.orders = []; };
  const response = await request("PUT", undefined, { file: {} });
  assert.equal(response.status, 404);
  assert.equal(state.cleanups.length, 1);
  assert.equal(state.cleanups[0].public_id, NEW_ASSET.public_id);
});

test("archive landing before a text write prevents the edit atomically", async () => {
  state.beforeWrite = () => { state.orders[0].archivedAt = new Date(); };
  const response = await request("PUT", undefined, { fields: { notes: "Must not apply" } });
  assert.equal(response.status, 409);
  assert.equal(state.orders[0].notes, "Original notes");
  assert.equal(state.writes[0].filter.archivedAt, null);
});

test("old asset cleanup failure returns successful replacement plus cleanupWarning", async (t) => {
  for (const failure of ["false", "throw"]) {
    await t.test(failure, async () => {
      state.orders[0] = baseline();
      state.cleanupResult = false;
      state.cleanupError = failure === "throw" ? new Error("Simulated cleanup failure") : undefined;
      const response = await request("PUT", undefined, { file: {} });
      assert.equal(response.status, 200);
      assert.ok(response.body.cleanupWarning);
      assert.equal(state.orders[0].designFile, NEW_ASSET.secure_url);
    });
  }
});

test("archive and restore use conditional updates and conflict when repeated", async () => {
  const archived = await request("PUT", `/${ID}/archive`);
  assert.equal(archived.status, 200);
  assert.ok(Number.isFinite(new Date(archived.body.archivedAt).getTime()));
  assert.equal(state.writes[0].filter.archivedAt, null);
  assert.equal((await request("PUT", `/${ID}/archive`)).status, 409);
  const restored = await request("PUT", `/${ID}/restore`);
  assert.equal(restored.status, 200);
  assert.equal(restored.body.archivedAt, null);
  const restoreWrite = state.writes.find((write) => write.update?.$set?.archivedAt === null);
  assert.deepEqual(restoreWrite.filter.archivedAt, { $ne: null });
  assert.equal((await request("PUT", `/${ID}/restore`)).status, 409);
  assert.equal(state.cleanups.length, 0);
});

test("permanent deletion is rejected for active orders before any asset cleanup", async () => {
  const response = await request("DELETE");
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "NOT_ARCHIVED");
  assert.equal(state.orders.length, 1);
  assert.equal(state.cleanups.length, 0);
});

test("permanent delete atomically removes archived record and cleans design and payment assets", async () => {
  state.orders[0].archivedAt = new Date();
  const response = await request("DELETE");
  assert.equal(response.status, 200);
  assert.equal(state.orders.length, 0);
  assert.deepEqual(state.writes[0].filter.archivedAt, { $ne: null });
  assert.equal(state.writes[0].method, "findOneAndDelete");
  assert.equal(state.events[0], "delete", "DB deletion must succeed before deleting any referenced files");
  assert.deepEqual(state.cleanups.map(({ public_id, resource_type }) => ({ public_id, resource_type })).sort((a, b) => a.public_id.localeCompare(b.public_id)), [
    { public_id: "grandprint/designs/old", resource_type: "image" },
    { public_id: "grandprint/payments/receipt.pdf", resource_type: "raw" },
  ]);
});

test("restore racing permanent delete prevents deletion and leaves files untouched", async () => {
  state.orders[0].archivedAt = new Date();
  state.beforeDelete = () => { state.orders[0].archivedAt = null; };
  const response = await request("DELETE");
  assert.equal(response.status, 409);
  assert.equal(response.body.code, "NOT_ARCHIVED");
  assert.equal(state.orders.length, 1);
  assert.equal(state.cleanups.length, 0);
});

test("DB permanent deletion failure leaves every Cloudinary asset untouched", async () => {
  state.orders[0].archivedAt = new Date();
  state.deleteError = new Error("Simulated DB delete failure");
  const response = await request("DELETE");
  assert.equal(response.status, 500);
  assert.equal(state.orders.length, 1);
  assert.equal(state.cleanups.length, 0);
});

test("permanent deletion completes with cleanupWarning when asset cleanup fails", async (t) => {
  for (const failure of ["false", "throw"]) {
    await t.test(failure, async () => {
      state.orders = [baseline({ archivedAt: new Date() })];
      const cleanupCount = state.cleanups.length;
      state.cleanupResult = false;
      state.cleanupError = failure === "throw" ? new Error("Simulated cleanup failure") : undefined;
      const response = await request("DELETE");
      assert.equal(response.status, 200);
      assert.ok(response.body.cleanupWarning);
      assert.equal(state.orders.length, 0);
      assert.equal(state.cleanups.length - cleanupCount, 2, "both assets must be attempted even if one cleanup throws");
    });
  }
});

test("list defaults to active orders, archived=true returns archived, with existing selection and sort", async () => {
  const archived = baseline({ _id: OTHER_ID, orderId: "GP-654321", archivedAt: new Date(), createdAt: new Date("2026-02-01") });
  const legacy = baseline({ _id: "507f1f77bcf86cd799439013", orderId: "GP-111111", createdAt: new Date("2025-12-01") });
  delete legacy.archivedAt;
  state.orders.push(archived, legacy);
  const activeResponse = await request("GET", "/");
  assert.equal(activeResponse.status, 200);
  assert.deepEqual(activeResponse.body.map((order) => order.orderId), ["GP-123456", "GP-111111"]);
  const archivedResponse = await request("GET", "/?archived=true");
  assert.deepEqual(archivedResponse.body.map((order) => order.orderId), ["GP-654321"]);
  const falseResponse = await request("GET", "/?archived=false");
  assert.equal(falseResponse.body.length, 2);
  assert.deepEqual(state.reads.filter((read) => read.method === "find").map((read) => read.filter), [{ archivedAt: null }, { archivedAt: { $ne: null } }, { archivedAt: null }]);
  assert.ok(state.selections.every((selection) => selection === "+approvalEmail"));
  assert.ok(state.sorts.every((sort) => sort.createdAt === -1));
  assert.equal(activeResponse.body[0].accessToken, undefined);
  assert.equal(activeResponse.body[0].approvalEmail.attemptId, undefined);
});

test("archived customer lookup and payment return not found even with correct access token", async () => {
  state.orders[0].archivedAt = new Date();
  const headers = { "X-Order-Access-Token": TOKEN };
  const lookup = await request("GET", "/lookup/GP-123456", { authenticated: false, headers });
  assert.equal(lookup.status, 404);
  const payment = await request("PATCH", "/customers/pay/GP-123456", { authenticated: false, headers, file: { field: "paymentProof" } });
  assert.equal(payment.status, 404);
  assertNoMutation();
});

test("active and legacy customer lookup still accept a correct access token", async () => {
  const headers = { "X-Order-Access-Token": TOKEN };
  for (const archivedAt of [null, undefined]) {
    state.orders[0].archivedAt = archivedAt;
    const response = await request("GET", "/lookup/GP-123456", { authenticated: false, headers });
    assert.equal(response.status, 200);
    assert.equal(response.body.orderId, "GP-123456");
    assert.equal(response.body.accessToken, undefined);
  }
});
