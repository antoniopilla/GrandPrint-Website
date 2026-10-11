const mapApiError = (error, fallbackMessage = "Server Error") => {
  if (error?.name === "ValidationError") {
    return {
      status: 400,
      body: { code: "VALIDATION_ERROR", message: "Please check the order details and try again." },
    };
  }
  if (error?.name === "CastError") {
    return {
      status: 400,
      body: { code: "INVALID_REQUEST", message: "Invalid order details or order ID." },
    };
  }
  if (error?.code === 11000) {
    return {
      status: 409,
      body: { code: "ORDER_CONFLICT", message: "The order could not be saved because it conflicts with an existing order. Please try again." },
    };
  }
  return { status: 500, body: { code: "SERVER_ERROR", message: fallbackMessage } };
};

const sendApiError = (res, error, fallbackMessage = "Server Error", context = "Request failed") => {
  console.error(`${context}:`, error);
  const { status, body } = mapApiError(error, fallbackMessage);
  return res.status(status).json(body);
};

module.exports = { mapApiError, sendApiError };
