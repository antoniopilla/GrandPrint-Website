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

module.exports = { cloudinary, uploadBuffer };
