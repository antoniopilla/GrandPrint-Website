export const PRODUCT_TYPES = ["Tarpaulin", "Sintra Board", "Sticker"];

const dimensionError = (value, label) => {
  const dimension = Number(value);
  return Number.isFinite(dimension) && dimension > 0 && dimension <= 100
    ? null
    : `${label} must be greater than 0 and no more than 100 feet.`;
};

// Shared by the customer form and the admin editor so their detail rules agree.
export const validateOrderFields = {
  customerName: (v) => {
    if (!v.trim()) return "Full name is required.";
    if (v.trim().length > 120) return "Name must be no more than 120 characters.";
    if (v.trim().length < 2) return "Name must be at least 2 characters.";
    if (/^\d+$/.test(v.trim())) return "Name cannot be only numbers.";
    return null;
  },
  email: (v) => {
    if (!v.trim()) return "Email address is required.";
    if (v.trim().length > 254) return "Email must be no more than 254 characters.";
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()))
      return "Enter a valid email address (e.g. you@email.com).";
    return null;
  },
  contactNumber: (v) => {
    if (!v.trim()) return "Contact number is required.";
    if (v.trim().length > 30) return "Contact number must be no more than 30 characters.";
    const digits = v.replace(/[\s-]/g, "");
    if (!/^(\+63|0)(9\d{9})$/.test(digits))
      return "Enter a valid PH mobile number (e.g. 09171234567).";
    return null;
  },
  productType: (v) => PRODUCT_TYPES.includes(v.trim()) ? null : "Please choose a product type.",
  width: (v) => dimensionError(v, "Width"),
  height: (v) => dimensionError(v, "Height"),
  pieces: (v) => Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 10000
    ? null
    : "Pieces must be a whole number from 1 to 10,000.",
  notes: (v) => v.trim().length <= 5000 ? null : "Notes must be no more than 5,000 characters.",
};
