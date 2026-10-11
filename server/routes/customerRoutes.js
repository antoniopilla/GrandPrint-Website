const express = require("express");
const router = express.Router();
const Order = require("../models/Order");
const { createValidatedUpload } = require("../middleware/uploadValidation");
const { uploadBuffer, deleteUploadedAsset } = require("../config/cloudinary");
const requireOrderAccess = require("../middleware/orderAccess");
const { paymentRateLimit } = require("../middleware/orderAccessRateLimit");
const { sendApiError } = require("../utils/apiError");

// Payment proof is held in memory then streamed to Cloudinary below.
const upload = createValidatedUpload({
  fieldName: "paymentProof",
  kind: "receipt",
  limits: {
    fileSize: 10_000_000,
    files: 1,
    fields: 0,
    parts: 2,
    fieldSize: 64 * 1024,
  },
});

// PATCH route to submit payment proof
router.patch("/pay/:orderId", paymentRateLimit, requireOrderAccess, upload, async (req, res) => {
  let uploadedAsset;
  let uploadPersisted = false;
  let writeAttempted = false;
  try {
    const order = req.order;

    if (!req.file) return res.status(400).json({ code: "VALIDATION_ERROR", message: "Payment proof is required" });

    if (order.status !== "Awaiting Downpayment") {
      return res.status(409).json({
        code: "INVALID_TRANSITION",
        message: "Order status has changed or this transition is not allowed. Please refresh and try again.",
      });
    }

    let result;
    try {
      result = await uploadBuffer(req.file.buffer, "grandprint/payments");
    } catch (uploadError) {
      console.error("Payment proof upload failed:", uploadError);
      return res.status(422).json({
        message: "We could not accept this file. Please try another file or message us on Messenger.",
        contactUrl: "https://www.messenger.com/t/61551691632716",
      });
    }
    uploadedAsset = result;
    writeAttempted = true;
    const updatedOrder = await Order.findOneAndUpdate(
      { _id: order._id, accessToken: order.accessToken, status: "Awaiting Downpayment" },
      { $set: { paymentProof: result.secure_url, status: "Payment Submitted" } },
      { new: true, runValidators: true }
    );
    if (!updatedOrder) {
      await deleteUploadedAsset(uploadedAsset);
      uploadedAsset = undefined;
      if (await Order.exists({ _id: order._id, accessToken: order.accessToken })) {
        return res.status(409).json({
          code: "INVALID_TRANSITION",
          message: "Order status has changed or this transition is not allowed. Please refresh and try again.",
        });
      }
      return res.status(404).json({
        message: "This payment link is invalid or outdated. Please contact GrandPrint",
      });
    }
    uploadPersisted = true;

    res.json({ orderId: updatedOrder.orderId, status: updatedOrder.status });
  } catch (err) {
    if (uploadedAsset && !uploadPersisted) {
      const writeRejected = ["ValidationError", "CastError"].includes(err?.name) || err?.code === 11000;
      const writeConcernFailure = Boolean(err?.writeConcernError || err?.errorResponse?.writeConcernError);
      if (!writeAttempted || (writeRejected && !writeConcernFailure)) {
        await deleteUploadedAsset(uploadedAsset);
      } else {
        console.error("Payment proof cleanup deferred: persistence could not be confirmed.");
      }
    }
    sendApiError(res, err, "Server Error", "Payment submission failed");
  }
});

module.exports = router;
