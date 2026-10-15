const { v2: cloudinary } = require("cloudinary");

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

/**
 * Upload an in-memory file buffer to Cloudinary and resolve with the file info.
 * @param {Buffer} buffer   The file buffer (from multer memoryStorage).
 * @param {string} folder   Cloudinary folder to store the file in.
 * @returns {Promise<object>} The Cloudinary upload result (includes secure_url).
 */
const uploadBuffer = (buffer, folder) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder, resource_type: "auto" },
      (err, result) => (err ? reject(err) : resolve(result))
    );
    stream.end(buffer);
  });

const deleteUploadedAsset = async (result) => {
  if (
    typeof result?.public_id !== "string" || !result.public_id.trim() ||
    !["image", "raw", "video"].includes(result.resource_type) ||
    (result.type != null && (typeof result.type !== "string" || !result.type.trim()))
  ) {
    console.error("Uploaded asset cleanup failed: missing or invalid upload metadata.");
    return false;
  }

  try {
    const deleted = await cloudinary.uploader.destroy(result.public_id, {
      resource_type: result.resource_type,
      type: result.type || "upload",
      invalidate: true,
    });
    if (deleted?.result === "ok" || deleted?.result === "not found") return true;
  } catch {
    // Cleanup must not replace the response for the original failed operation.
  }
  console.error("Uploaded asset cleanup failed.");
  return false;
};

// Older orders retain only the delivery URL, rather than the upload metadata.
const uploadedAssetFromUrl = (value) => {
  if (typeof value !== "string" || !value) return null;
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.hostname !== "res.cloudinary.com") return null;
    const parts = url.pathname.split("/").filter(Boolean);
    const [cloudName, resourceType, type, ...path] = parts;
    if (
      !cloudName || !["image", "raw", "video"].includes(resourceType) || type !== "upload" ||
      (process.env.CLOUDINARY_CLOUD_NAME && cloudName !== process.env.CLOUDINARY_CLOUD_NAME)
    ) return null;

    // Upload results include a version; it also separates any delivery transforms.
    const versionIndex = path.findIndex((part) => /^v\d+$/.test(part));
    const publicPath = versionIndex === -1 ? path : path.slice(versionIndex + 1);
    let publicId = decodeURIComponent(publicPath.join("/"));
    if (resourceType !== "raw") publicId = publicId.replace(/\.[^/.]+$/, "");
    if (!publicId) return null;
    return { public_id: publicId, resource_type: resourceType, type };
  } catch {
    return null;
  }
};

module.exports = { cloudinary, uploadBuffer, deleteUploadedAsset, uploadedAssetFromUrl };
