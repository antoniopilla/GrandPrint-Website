const LOGIN_LIMIT = 10;
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ENTRIES = 5000;

// Disabled until trusted proxy/client IP handling is confirmed by the owner.
const createAdminLoginRateLimit = ({ now = Date.now } = {}) => {
  const attempts = new Map();

  return (req, res, next) => {
    if (process.env.ADMIN_LOGIN_RATE_LIMIT_ENABLED !== "true") return next();

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

      if (attempts.size >= MAX_ENTRIES) {
        res.set("Retry-After", String(Math.ceil(WINDOW_MS / 1000)));
        return res.status(429).json({
          message: "Too many login attempts. Please try again later.",
        });
      }

      entry = { count: 0, expiresAt: time + WINDOW_MS };
      attempts.set(key, entry);
    }

    if (entry.count >= LOGIN_LIMIT) {
      res.set("Retry-After", String(Math.ceil((entry.expiresAt - time) / 1000)));
      return res.status(429).json({
        message: "Too many login attempts. Please try again later.",
      });
    }

    entry.count += 1;
    next();
  };
};

const adminLoginRateLimit = createAdminLoginRateLimit();

module.exports = { createAdminLoginRateLimit, adminLoginRateLimit };
