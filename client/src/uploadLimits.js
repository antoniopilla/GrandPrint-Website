export const MAX_UPLOAD_BYTES = 10_000_000;
export const MESSENGER_URL = "https://www.messenger.com/t/61551691632716";
export const FILE_SIZE_MESSAGE = "File too large. Max 10 MB. Please message us on Messenger for larger files.";

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
