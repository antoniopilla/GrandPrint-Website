// Disabled until trusted proxy/client IP handling is confirmed by the owner.
const createOrderAccessRateLimit = ({ limit, windowMs, maxEntries = 5000, now = Date.now }) => {
  const attempts = new Map();
  return (req, res, next) => {
    if (process.env.ORDER_ACCESS_RATE_LIMIT_ENABLED !== "true") return next();

    const time = now();
    const key = req.ip || req.socket?.remoteAddress || "unknown";
    let entry = attempts.get(key);
    if (entry && time >= entry.expiresAt) {
      attempts.delete(key);
      entry = null;
    }
    if (!entry) {
      for (const [address, attempt] of attempts) {
        if (time >= attempt.expiresAt) attempts.delete(address);
      }
      if (attempts.size >= maxEntries) {
        res.set("Retry-After", String(Math.ceil(windowMs / 1000)));
        return res.status(429).json({ message: "Too many requests. Please try again later." });
      }
      entry = { count: 0, expiresAt: time + windowMs };
      attempts.set(key, entry);
    }
    if (entry.count >= limit) {
      res.set("Retry-After", String(Math.ceil((entry.expiresAt - time) / 1000)));
      return res.status(429).json({ message: "Too many requests. Please try again later." });
    }
    entry.count += 1;
    next();
  };
};

const lookupRateLimit = createOrderAccessRateLimit({ limit: 30, windowMs: 60 * 1000 });
const paymentRateLimit = createOrderAccessRateLimit({ limit: 5, windowMs: 10 * 60 * 1000 });

module.exports = { createOrderAccessRateLimit, lookupRateLimit, paymentRateLimit };
