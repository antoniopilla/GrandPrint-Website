const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const multer = require("multer");
const { uploadBuffer } = require("../config/cloudinary");
const requireOrderAccess = require("../middleware/orderAccess");
const { paymentRateLimit } = require("../middleware/orderAccessRateLimit");

// Payment proof is held in memory then streamed to Cloudinary below.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 20 * 1024 * 1024,
    files: 1,
    fields: 0,
    parts: 2,
    fieldSize: 64 * 1024,
  },
});

// PATCH route to submit payment proof
router.patch("/pay/:orderId", paymentRateLimit, requireOrderAccess, upload.single("paymentProof"), async (req, res) => {
  try {
    const order = req.order;

    if (!req.file) return res.status(400).json({ message: "Payment proof is required" });

    if (order.status !== "Awaiting Downpayment") {
      return res.status(400).json({
        message: `Order is not awaiting payment (current status: ${order.status}).`,
      });
    }

    const result = await uploadBuffer(req.file.buffer, "grandprint/payments");
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, accessToken: order.accessToken },
      { $set: { paymentProof: result.secure_url, status: "Payment Submitted" } },
      { new: true }
    );
    if (!updatedOrder) {
      return res.status(404).json({
        message: "This payment link is invalid or outdated. Please contact GrandPrint",
      });
    }

    res.json({ orderId: updatedOrder.orderId, status: updatedOrder.status });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

module.exports = router;
