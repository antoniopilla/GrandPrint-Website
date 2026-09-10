const express = require("express");
const router = express.Router();
const multer = require("multer");
const requireAdmin = require("../middleware/auth");
const {
  createOrder,
  getOrders,
  getOrderByOrderId,
  updateOrderStatus,
  approveOrder,
} = require("../controllers/orderController");

// Files are kept in memory then streamed to Cloudinary in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.get("/", requireAdmin, getOrders);
router.get("/lookup/:orderId", getOrderByOrderId);
router.post("/", upload.single("designFile"), createOrder);
router.put("/:id/status", requireAdmin, updateOrderStatus);
router.put("/:id/approve", requireAdmin, approveOrder);

module.exports = router;
