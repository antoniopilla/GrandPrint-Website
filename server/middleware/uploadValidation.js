const multer = require("multer");
const { extname } = require("node:path");

const formats = {
  pdf: { mimeTypes: ["application/pdf"], signatures: [Buffer.from("%PDF")] },
  png: { mimeTypes: ["image/png"], signatures: [Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])] },
  jpg: { mimeTypes: ["image/jpeg", "image/jpg", "image/pjpeg"], signatures: [Buffer.from([0xff, 0xd8, 0xff])] },
  psd: { mimeTypes: ["image/vnd.adobe.photoshop", "image/x-photoshop", "image/photoshop", "image/psd", "image/x-psd", "application/photoshop", "application/x-photoshop", "application/psd"], signatures: [Buffer.from("8BPS")] },
  ai: { mimeTypes: ["application/pdf", "application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/x-illustrator"], signatures: [Buffer.from("%PDF"), Buffer.from("%!PS")] },
  eps: { mimeTypes: ["application/postscript", "application/eps", "application/x-eps", "image/eps", "image/x-eps"], signatures: [Buffer.from("%!PS"), Buffer.from([0xc5, 0xd0, 0xd3, 0xc6])] },
};
formats.jpeg = formats.jpg;

const policies = {
  design: {
    extensions: ["pdf", "png", "jpg", "jpeg", "psd", "ai", "eps"],
    message: "Please upload a valid PDF, PNG, JPG, PSD, AI, or EPS file.",
  },
  receipt: {
    extensions: ["pdf", "png", "jpg", "jpeg"],
    message: "Please upload a valid JPG, PNG, or PDF file.",
  },
};

const createValidatedUpload = ({ fieldName, kind, limits }) => {
  const policy = policies[kind];
  const fileFormat = (file) => {
    const extension = extname(file.originalname || "").slice(1).toLowerCase();
    return policy.extensions.includes(extension) ? formats[extension] : null;
  };
  const upload = multer({
    storage: multer.memoryStorage(),
    limits,
    fileFilter: (_req, file, cb) => {
      const format = fileFormat(file);
      const mimeType = (file.mimetype || "").toLowerCase();
      if (!format || !["", "application/octet-stream", ...format.mimeTypes].includes(mimeType)) {
        const error = new Error(policy.message);
        error.code = "INVALID_UPLOAD_FORMAT";
        return cb(error);
      }
      cb(null, true);
    },
  }).single(fieldName);

  return (req, res, next) => {
    upload(req, res, (err) => {
      if (err) {
        if (err.code === "INVALID_UPLOAD_FORMAT") {
          return res.status(400).json({ message: policy.message });
        }
        return next(err);
      }
      if (req.file) {
        const format = fileFormat(req.file);
        const buffer = req.file.buffer;
        if (!format || !Buffer.isBuffer(buffer) || !format.signatures.some((signature) =>
          buffer.length >= signature.length && buffer.subarray(0, signature.length).equals(signature)
        )) {
          return res.status(400).json({ message: policy.message });
        }
      }
      next();
    });
  };
};

module.exports = { createValidatedUpload };
