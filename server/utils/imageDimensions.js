const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);

const jpegDimensions = (buffer) => {
  if (buffer.length < 2 || buffer[0] !== 0xff || buffer[1] !== 0xd8) return null;
  let offset = 2;
  let hierarchicalCanvas = null;
  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) return null;
    while (offset < buffer.length && buffer[offset] === 0xff) offset += 1;
    if (offset >= buffer.length) return null;
    const marker = buffer[offset++];
    if (marker === 0x00 || marker === 0xd8 || marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
    if (offset + 2 > buffer.length) return null;
    const length = buffer.readUInt16BE(offset);
    if (length < 2 || offset + length > buffer.length) return null;
    if (frameMarkers.has(marker) || marker === 0xde) {
      if (length < 8) return null;
      const components = buffer[offset + 7];
      if (!components || length !== 8 + 3 * components) return null;
      const height = buffer.readUInt16BE(offset + 3);
      const width = buffer.readUInt16BE(offset + 5);
      if (!width || !height) return null;
      const dimensions = { width, height };
      if (marker === 0xde) {
        hierarchicalCanvas = dimensions;
      } else {
        return hierarchicalCanvas && hierarchicalCanvas.width * hierarchicalCanvas.height > width * height
          ? hierarchicalCanvas : dimensions;
      }
    }
    offset += length;
  }
  return null;
};

const getImageDimensions = (buffer, extension) => {
  if (!Buffer.isBuffer(buffer)) return null;
  if (extension === "png") {
    if (
      buffer.length < 33 ||
      !buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) ||
      buffer.readUInt32BE(8) !== 13 || !buffer.subarray(12, 16).equals(Buffer.from("IHDR"))
    ) return null;
    const width = buffer.readUInt32BE(16);
    const height = buffer.readUInt32BE(20);
    return width && height && width <= 0x7fffffff && height <= 0x7fffffff ? { width, height } : null;
  }
  if (extension === "psd") {
    if (buffer.length < 26 || !buffer.subarray(0, 4).equals(Buffer.from("8BPS")) || buffer.readUInt16BE(4) !== 1) return null;
    const height = buffer.readUInt32BE(14);
    const width = buffer.readUInt32BE(18);
    return width && height && width <= 30000 && height <= 30000 ? { width, height } : null;
  }
  if (extension === "jpg" || extension === "jpeg") return jpegDimensions(buffer);
  return null;
};

module.exports = { getImageDimensions };
