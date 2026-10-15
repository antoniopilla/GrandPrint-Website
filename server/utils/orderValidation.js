const PRODUCT_TYPES = ["Tarpaulin", "Sintra Board", "Sticker"];
const LIMITS = {
  customerName: 120,
  email: 254,
  contactNumber: 30,
  notes: 5000,
  dimension: 100,
  pieces: 10000,
};

const isValidEmail = (value) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value);
const isValidDimension = (value) => Number.isFinite(value) && value > 0 && value <= LIMITS.dimension;
const isValidPieces = (value) => Number.isInteger(value) && value >= 1 && value <= LIMITS.pieces;
const isValidPrice = (value) => Number.isFinite(value) && value > 0;

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (typeof value !== "string" || !/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(value.trim())) {
    return NaN;
  }
  return Number(value.trim());
};

const validateOrderInput = (body = {}, { partial = false } = {}) => {
  const values = {};
  const errors = {};
  const includesField = (field) => !partial || Object.prototype.hasOwnProperty.call(body || {}, field);
  for (const [field, label] of [
    ["customerName", "Customer name"],
    ["email", "Email address"],
    ["contactNumber", "Contact number"],
  ]) {
    if (!includesField(field)) continue;
    const value = typeof body?.[field] === "string" ? body[field].trim() : "";
    values[field] = value;
    if (!value) errors[field] = `${label} is required.`;
    else if (value.length > LIMITS[field]) errors[field] = `${label} must be ${LIMITS[field]} characters or fewer.`;
  }
  if (includesField("email") && !errors.email && !isValidEmail(values.email)) errors.email = "Enter a valid email address.";

  if (includesField("productType")) {
    values.productType = typeof body?.productType === "string" ? body.productType.trim() : "";
    if (!PRODUCT_TYPES.includes(values.productType)) errors.productType = "Select a valid product type.";
  }
  for (const field of ["width", "height"]) {
    if (!includesField(field)) continue;
    values[field] = parseNumber(body?.[field]);
    if (!isValidDimension(values[field])) errors[field] = "Enter a dimension greater than 0 and at most 100 feet.";
  }
  if (includesField("pieces")) {
    values.pieces = parseNumber(body?.pieces);
    if (!isValidPieces(values.pieces)) errors.pieces = "Enter a whole number of pieces from 1 to 10,000.";
  }

  if (includesField("notes")) {
    values.notes = body?.notes === undefined ? "" : typeof body.notes === "string" ? body.notes.trim() : "";
    if (body?.notes !== undefined && typeof body.notes !== "string") errors.notes = "Notes must be text.";
    else if (values.notes.length > LIMITS.notes) errors.notes = "Notes must be 5,000 characters or fewer.";
  }
  return { values, errors };
};

const sendValidationErrors = (res, errors) => res.status(400).json({
  message: "Please check the order details and try again.",
  code: "VALIDATION_ERROR",
  errors,
});

module.exports = { PRODUCT_TYPES, LIMITS, isValidEmail, isValidDimension, isValidPieces, isValidPrice, parseNumber, validateOrderInput, sendValidationErrors };
