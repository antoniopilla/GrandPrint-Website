const crypto = require("crypto");

const generateAccessToken = () => crypto.randomBytes(32).toString("base64url");

const isValidAccessToken = (token) =>
  typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);

const compareAccessTokens = (providedToken, storedToken) => {
  if (!isValidAccessToken(providedToken) || !isValidAccessToken(storedToken)) {
    return false;
  }
  return crypto.timingSafeEqual(
    Buffer.from(providedToken),
    Buffer.from(storedToken)
  );
};

module.exports = { generateAccessToken, isValidAccessToken, compareAccessTokens };
