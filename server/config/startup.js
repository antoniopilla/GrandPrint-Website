const { getCustomerPortalUrl } = require("./customerPortal");

const REQUIRED_SETTINGS = [
  "ADMIN_PASSWORD",
  "JWT_SECRET",
  "CLOUDINARY_CLOUD_NAME",
  "CLOUDINARY_API_KEY",
  "CLOUDINARY_API_SECRET",
];

const getStartupConfig = (env = process.env) => {
  const invalid = REQUIRED_SETTINGS.filter(
    (name) => typeof env[name] !== "string" || !env[name].trim()
  );

  let mongoUri = "mongodb://127.0.0.1:27017/printingPOS";
  if (env.MONGO_URI !== undefined) {
    if (
      typeof env.MONGO_URI !== "string" ||
      !/^mongodb(?:\+srv)?:\/\/\S+$/.test(env.MONGO_URI.trim())
    ) {
      invalid.push("MONGO_URI");
    } else {
      mongoUri = env.MONGO_URI.trim();
    }
  } else if (env.NODE_ENV === "production") {
    invalid.push("MONGO_URI");
  }

  let port = 5000;
  if (env.PORT !== undefined) {
    const value = typeof env.PORT === "string" ? env.PORT.trim() : "";
    port = Number(value);
    if (!/^\d+$/.test(value) || !Number.isInteger(port) || port < 1 || port > 65535) {
      invalid.push("PORT");
    }
  }

  try {
    getCustomerPortalUrl(env);
  } catch {
    invalid.push("CUSTOMER_PORTAL_URL");
  }

  if (invalid.length) {
    throw new Error(`Missing or invalid server configuration: ${invalid.join(", ")}`);
  }

  return { mongoUri, port };
};

module.exports = { getStartupConfig };
