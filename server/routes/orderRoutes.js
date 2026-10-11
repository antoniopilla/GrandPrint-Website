const express = require("express");
const router = express.Router();
const multer = require("multer");
const requireAdmin = require("../middleware/auth");
const requireOrderAccess = require("../middleware/orderAccess");
const { lookupRateLimit } = require("../middleware/orderAccessRateLimit");
const {
  createOrder,
  getOrders,
  getOrderByOrderId,
  updateOrderStatus,
  approveOrder,
  getOrderAccessLink,
  rotateOrderAccessLink,
} = require("../controllers/orderController");

// Files are kept in memory then streamed to Cloudinary in the controller.
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
});

router.get("/", requireAdmin, getOrders);
router.get("/lookup/:orderId", lookupRateLimit, requireOrderAccess, getOrderByOrderId);
router.post("/", upload.single("designFile"), createOrder);
router.put("/:id/status", requireAdmin, updateOrderStatus);
router.put("/:id/approve", requireAdmin, approveOrder);
router.post("/:id/access-link", requireAdmin, getOrderAccessLink);
router.post("/:id/access-link/rotate", requireAdmin, rotateOrderAccessLink);

module.exports = router;
