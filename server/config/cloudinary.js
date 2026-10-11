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

module.exports = { cloudinary, uploadBuffer, deleteUploadedAsset };
