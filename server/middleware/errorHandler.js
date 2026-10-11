const { mapApiError } = require("../utils/apiError");

const errorHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  console.error("Request failed:", error);

  if (error?.name === "MulterError") {
    return res.status(400).json({
      code: "INVALID_UPLOAD",
      message: "Invalid upload request. Please check your file and try again.",
    });
  }
  if (error?.type === "entity.parse.failed") {
    return res.status(400).json({ code: "INVALID_REQUEST", message: "Invalid request body." });
  }
  if (error?.type === "entity.too.large") {
    return res.status(413).json({ code: "INVALID_REQUEST", message: "Request body is too large." });
  }

  const { status, body } = mapApiError(error);
  return res.status(status).json(body);
};

module.exports = errorHandler;
