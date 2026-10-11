const PUBLIC_API_MESSAGES = {
  VALIDATION_ERROR: "Please check the order details and try again.",
  INVALID_REQUEST: "Invalid order details or order ID.",
  ORDER_CONFLICT: "The order could not be saved because it conflicts with an existing order. Please try again.",
  INVALID_TRANSITION: "Order status has changed or this transition is not allowed. Please refresh and try again.",
  INVALID_UPLOAD: "Invalid upload request. Please check your file and try again.",
  EMAIL_INVALID_RECIPIENT: "Cannot resend: this order has a missing or invalid email address.",
  EMAIL_IN_PROGRESS: "An approval email is already being sent. Please wait and refresh.",
  EMAIL_DUPLICATE_CONFIRMATION: "This email may already have been accepted. Confirm before resending.",
  EMAIL_RESEND_NOT_ALLOWED: "Approval emails can only be resent while awaiting downpayment.",
  EMAIL_CONFIGURATION: "Approval email settings are missing or invalid. Check the email setup on Render.",
};

export const getApiErrorMessage = (error, fallback) => {
  const code = error.response?.data?.code;
  return [400, 409].includes(error.response?.status) &&
    typeof code === "string" && Object.prototype.hasOwnProperty.call(PUBLIC_API_MESSAGES, code)
    ? PUBLIC_API_MESSAGES[code]
    : fallback;
};
