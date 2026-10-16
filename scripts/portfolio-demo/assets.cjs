const zlib = require("node:zlib");
const fs = require("node:fs");
const path = require("node:path");
const { ownedSubdirectory, assertOrdinaryEntry } = require("./config.cjs");

const assetNamePattern = /^(?:sample-(?:artwork|payment-receipt)\.png|upload-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\.(?:png|jpg|pdf|bin))$/;
function checkedAssetEntry(directory, name, io = fs) {
  if (!assetNamePattern.test(name)) throw new Error("Unexpected asset name; only generated demo files are allowed.");
  const file = path.join(directory, name);
  // lstat is deliberate: existsSync would miss a dangling malicious link.
  assertOrdinaryEntry(file, "file", io);
  return file;
}
function checkAssetEntries(directory, io = fs) {
  assertOrdinaryEntry(directory, "directory", io);
  for (const name of io.readdirSync(directory)) checkedAssetEntry(directory, name, io);
}
function checkedAssetPath(name) {
  return checkedAssetEntry(ownedSubdirectory("assets"), name);
}

// A tiny embedded bitmap alphabet makes synthetic PNG fixtures without any
// downloaded image, font, browser, service, or image-generation dependency.
const alphabet = {
  A:"01110/10001/10001/11111/10001/10001/10001", B:"11110/10001/10001/11110/10001/10001/11110",
  C:"01111/10000/10000/10000/10000/10000/01111", D:"11110/10001/10001/10001/10001/10001/11110",
  E:"11111/10000/10000/11110/10000/10000/11111", F:"11111/10000/10000/11110/10000/10000/10000",
  G:"01111/10000/10000/10111/10001/10001/01111", H:"10001/10001/10001/11111/10001/10001/10001",
  I:"11111/00100/00100/00100/00100/00100/11111", J:"00111/00010/00010/00010/10010/10010/01100",
  K:"10001/10010/10100/11000/10100/10010/10001", L:"10000/10000/10000/10000/10000/10000/11111",
  M:"10001/11011/10101/10101/10001/10001/10001", N:"10001/11001/10101/10011/10001/10001/10001",
  O:"01110/10001/10001/10001/10001/10001/01110", P:"11110/10001/10001/11110/10000/10000/10000",
  Q:"01110/10001/10001/10001/10101/10010/01101", R:"11110/10001/10001/11110/10100/10010/10001",
  S:"01111/10000/10000/01110/00001/00001/11110", T:"11111/00100/00100/00100/00100/00100/00100",
  U:"10001/10001/10001/10001/10001/10001/01110", V:"10001/10001/10001/10001/10001/01010/00100",
  W:"10001/10001/10001/10101/10101/10101/01010", X:"10001/10001/01010/00100/01010/10001/10001",
  Y:"10001/10001/01010/00100/00100/00100/00100", Z:"11111/00001/00010/00100/01000/10000/11111",
  0:"01110/10001/10011/10101/11001/10001/01110", 1:"00100/01100/00100/00100/00100/00100/01110",
  2:"01110/10001/00001/00010/00100/01000/11111", 3:"11110/00001/00001/01110/00001/00001/11110",
  4:"00010/00110/01010/10010/11111/00010/00010", 5:"11111/10000/10000/11110/00001/00001/11110",
  6:"01110/10000/10000/11110/10001/10001/01110", 7:"11111/00001/00010/00100/01000/01000/01000",
  8:"01110/10001/10001/01110/10001/10001/01110", 9:"01110/10001/10001/01111/00001/00001/01110",
  "-":"00000/00000/00000/11111/00000/00000/00000", ".":"00000/00000/00000/00000/00000/00110/00110",
  ":":"00000/00110/00110/00000/00110/00110/00000", " ":"00000/00000/00000/00000/00000/00000/00000",
};
function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4); length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}
function fixturePng(receipt = false) {
  const width = 1000, height = receipt ? 900 : 667;
  const pixels = Buffer.alloc(width * height * 3, 247);
  function rect(x, y, w, h, color) {
    for (let yy = y; yy < Math.min(height, y + h); yy++) for (let xx = x; xx < Math.min(width, x + w); xx++) {
      if (xx < 0 || yy < 0) continue;
      const offset = (yy * width + xx) * 3;
      pixels[offset] = color[0]; pixels[offset + 1] = color[1]; pixels[offset + 2] = color[2];
    }
  }
  function text(value, y, scale = 5, color = [30, 35, 45]) {
    let x = 56;
    for (const char of value.toUpperCase()) {
      const rows = (alphabet[char] || alphabet[" "]).split("/");
      rows.forEach((row, ry) => [...row].forEach((pixel, rx) => { if (pixel === "1") rect(x + rx * scale, y + ry * scale, scale, scale, color); }));
      x += 6 * scale;
    }
  }
  rect(0, 0, width, 140, [22, 61, 124]);
  text(receipt ? "SAMPLE RECEIPT" : "SAMPLE ARTWORK", 48, 8, [255, 255, 255]);
  text("NOT A REAL " + (receipt ? "PAYMENT" : "CUSTOMER ORDER"), 190, 5);
  text("GRANDPRINT LOCAL DEMO", 280, 5);
  text(receipt ? "SAMPLE CUSTOMER C" : "TARPAULIN - 3 FT BY 2 FT", 370, 4);
  text(receipt ? "AMOUNT: PHP 600.00" : "GENERATED TEST DESIGN", 450, 5);
  if (receipt) {
    text("REFERENCE: DEMO-0003", 540, 5);
    text("ACCOUNT: 00000000000", 630, 5);
    text("SYNTHETIC TEST DATA ONLY", 760, 4);
  } else text("NO REAL DATA", 560, 6);
  const rows = [];
  for (let y = 0; y < height; y++) rows.push(Buffer.from([0]), pixels.subarray(y * width * 3, (y + 1) * width * 3));
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 2;
  return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]), chunk("IHDR", header), chunk("IDAT", zlib.deflateSync(Buffer.concat(rows))), chunk("IEND", Buffer.alloc(0))]);
}
function ensureFixtures() {
  const directory = ownedSubdirectory("assets");
  checkAssetEntries(directory);
  const fixtures = { "sample-artwork.png": fixturePng(), "sample-payment-receipt.png": fixturePng(true) };
  for (const [name, bytes] of Object.entries(fixtures)) {
    const file = path.join(directory, name);
    if (fs.existsSync(file)) {
      assertOrdinaryEntry(file, "file");
      if (!fs.readFileSync(file).equals(bytes)) throw new Error(`Existing fixture differs; refusing overwrite: ${name}`);
    } else fs.writeFileSync(file, bytes, { flag: "wx" });
  }
  return directory;
}
module.exports = { fixturePng, ensureFixtures, checkedAssetEntry, checkAssetEntries, checkedAssetPath };
