export const MAX_UPLOAD_BYTES = 10_000_000;
export const MESSENGER_URL = "https://www.messenger.com/t/61551691632716";
export const FILE_SIZE_MESSAGE = "File too large. Max 10 MB. Please message us on Messenger for larger files.";
export const DESIGN_FILE_ACCEPT = ".pdf,.png,.jpg,.jpeg,.psd,.ai,.eps";
const DESIGN_FILE_MESSAGE = "Please upload a valid PDF, PNG, JPG, PSD, AI, or EPS file.";
const DESIGN_MIME_TYPES = {
  pdf: ["application/pdf"],
  png: ["image/png"],
  jpg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  jpeg: ["image/jpeg", "image/jpg", "image/pjpeg"],
  psd: ["image/vnd.adobe.photoshop", "image/x-photoshop", "image/photoshop", "image/psd", "image/x-psd", "application/photoshop", "application/x-photoshop", "application/psd"],
  ai: ["application/pdf", "application/postscript", "application/illustrator", "application/vnd.adobe.illustrator", "application/x-illustrator"],
  eps: ["application/postscript", "application/eps", "application/x-eps", "image/eps", "image/x-eps"],
};

export const validateDesignFile = (file) => {
  if (!file) return "";
  if (file.size > MAX_UPLOAD_BYTES) return FILE_SIZE_MESSAGE;
  const extension = file.name.match(/\.([^.]+)$/)?.[1].toLowerCase() || "";
  const allowedTypes = Object.prototype.hasOwnProperty.call(DESIGN_MIME_TYPES, extension) ? DESIGN_MIME_TYPES[extension] : null;
  return allowedTypes && ["", "application/octet-stream", ...allowedTypes].includes(file.type.toLowerCase())
    ? ""
    : DESIGN_FILE_MESSAGE;
};

const PUBLIC_UPLOAD_MESSAGES = new Set([
  FILE_SIZE_MESSAGE,
  "Image is too large (max 25 megapixels). Please message us on Messenger for large artwork.",
  "Please upload a valid PDF, PNG, JPG, PSD, AI, or EPS file.",
  "Please upload a valid JPG, PNG, or PDF file.",
  "We could not accept this file. Please try another file or message us on Messenger.",
]);

export const getUploadErrorMessage = (error, fallback) => {
  const message = error.response?.data?.message;
  return [400, 422].includes(error.response?.status) && PUBLIC_UPLOAD_MESSAGES.has(message)
    ? message
    : fallback;
};
