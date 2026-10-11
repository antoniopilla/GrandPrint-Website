const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { adminLoginRateLimit } = require("../middleware/adminLoginRateLimit");

router.post("/login", adminLoginRateLimit, (req, res) => {
  const password = req.body?.password;
  if (typeof password !== "string" || !password) {
    return res.status(400).json({ message: "Password required" });
  }

  const providedHash = crypto
    .createHash("sha256")
    .update(password, "utf16le")
    .digest();
  const storedHash = crypto
    .createHash("sha256")
    .update(process.env.ADMIN_PASSWORD || "", "utf16le")
    .digest();

  if (crypto.timingSafeEqual(providedHash, storedHash)) {
    const token = jwt.sign({ role: "admin" }, process.env.JWT_SECRET, { expiresIn: "12h" });
    res.json({ success: true, token });
  } else {
    res.status(401).json({ success: false, message: "Incorrect password" });
  }
});

module.exports = router;
