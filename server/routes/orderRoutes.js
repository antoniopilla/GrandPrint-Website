const express = require("express");
const router = express.Router();
const { createValidatedUpload } = require("../middleware/uploadValidation");
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
  resendApprovalEmail,
} = require("../controllers/orderController");

// Files are kept in memory then streamed to Cloudinary in the controller.
const upload = createValidatedUpload({
  fieldName: "designFile",
  kind: "design",
  limits: {
    fileSize: 10_000_000,
    files: 1,
    fields: 8,
    parts: 10,
    fieldSize: 64 * 1024,
  },
});

router.get("/", requireAdmin, getOrders);
router.get("/lookup/:orderId", lookupRateLimit, requireOrderAccess, getOrderByOrderId);
router.post("/", upload, createOrder);
router.put("/:id/status", requireAdmin, updateOrderStatus);
router.put("/:id/approve", requireAdmin, approveOrder);
router.post("/:id/access-link", requireAdmin, getOrderAccessLink);
router.post("/:id/access-link/rotate", requireAdmin, rotateOrderAccessLink);
router.post("/:id/approval-email/resend", requireAdmin, resendApprovalEmail);

module.exports = router;
