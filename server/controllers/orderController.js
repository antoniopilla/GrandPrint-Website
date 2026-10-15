const crypto = require("crypto");
const mongoose = require("mongoose");
const Order = require("../models/Order");
const { uploadBuffer, deleteUploadedAsset, uploadedAssetFromUrl } = require("../config/cloudinary");
const { generateAccessToken } = require("../utils/orderAccess");
const { buildPaymentLink } = require("../config/customerPortal");
const { validateEmailSettings } = require("../utils/emailService");
const { sendApiError } = require("../utils/apiError");
const { validateOrderInput, sendValidationErrors, parseNumber, isValidPrice, isValidEmail } = require("../utils/orderValidation");
const { createEmailAttempt, getApprovalEmailState, serializeAdminOrder, dispatchApprovalEmail } = require("../utils/approvalEmail");

const STATUS_PREDECESSORS = {
  Printing: ["Awaiting Downpayment", "Payment Submitted"],
  Completed: ["Printing"],
  "Fully Paid": ["Completed"],
};
const statusConflict = (res) => res.status(409).json({
  code: "INVALID_TRANSITION",
  message: "Order status has changed or this transition is not allowed. Please refresh and try again.",
});
const invalidResendPrice = (res) => res.status(400).json({
  code: "EMAIL_INVALID_PRICE",
  message: "Cannot resend: this order has a missing or invalid price.",
});
const PRICING_FIELDS = ["productType", "width", "height", "pieces"];
const invalidOrderId = (res) => res.status(400).json({
  code: "INVALID_REQUEST",
  message: "Invalid order details or order ID.",
});
const archivedOrderConflict = (res) => res.status(409).json({
  code: "ORDER_ARCHIVED",
  message: "This order is archived. Restore it before editing.",
});
const quoteLocked = (res, blockedFields) => res.status(409).json({
  code: "QUOTE_LOCKED",
  message: "The design file and size/quantity/product details can't be changed after the order has been approved. Please refresh the order.",
  blockedFields,
});
const cleanupAsset = async (asset, context) => {
  try {
    if (asset && await deleteUploadedAsset(asset)) return true;
  } catch (err) {
    console.error(`${context}:`, err);
    return false;
  }
  console.error(`${context}: unable to delete the uploaded asset.`);
  return false;
};

const provisionAccessToken = async (id) => {
  const order = await Order.findById(id).select("+accessToken");
  if (!order || order.accessToken) return order;

  const provisioned = await Order.findOneAndUpdate(
    {
      _id: id,
      $or: [
        { accessToken: { $exists: false } },
        { accessToken: null },
        { accessToken: "" },
      ],
    },
    { $set: { accessToken: generateAccessToken() } },
    { new: true }
  ).select("+accessToken");
  return provisioned || Order.findById(id).select("+accessToken");
};

const generateOrderId = () => "GP-" + crypto.randomBytes(8).toString("hex").toUpperCase();
const isOrderIdCollision = (error) => {
  const pattern = error?.keyPattern || error?.errorResponse?.keyPattern;
  return error?.code === 11000 && !error.writeConcernError && !error.errorResponse?.writeConcernError &&
    pattern && Object.keys(pattern).length === 1 &&
    Object.prototype.hasOwnProperty.call(pattern, "orderId");
};
const isRejectedWrite = (error) => !error?.writeConcernError && !error?.errorResponse?.writeConcernError && (
  ["ValidationError", "CastError"].includes(error?.name) || error?.code === 11000
);

// POST /api/orders
exports.createOrder = async (req, res) => {
  let uploadedAsset;
  let saveAttempted = false;
  let orderSaved = false;
  try {
    const { values, errors } = validateOrderInput(req.body);
    if (Object.keys(errors).length) return sendValidationErrors(res, errors);
    const { customerName, email, contactNumber, productType, width, height, pieces, notes } = values;

    const order = new Order({
      orderId: generateOrderId(),
      accessToken: generateAccessToken(),
      customerName,
      email,
      contactNumber,
      productType,
      width,
      height,
      pieces,
      notes,
      designFile: null,
    });

    await order.validate();
    if (req.file) {
      try {
        uploadedAsset = await uploadBuffer(req.file.buffer, "grandprint/designs");
        order.designFile = uploadedAsset.secure_url;
      } catch (uploadError) {
        console.error("Design upload failed:", uploadError);
        if (uploadedAsset) await deleteUploadedAsset(uploadedAsset);
        return res.status(422).json({
          message: "We could not accept this file. Please try another file or message us on Messenger.",
          contactUrl: "https://www.messenger.com/t/61551691632716",
        });
      }
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        saveAttempted = true;
        await order.save();
        orderSaved = true;
        break;
      } catch (error) {
        if (!isOrderIdCollision(error) || attempt === 4) throw error;
        order.orderId = generateOrderId();
      }
    }
    res.status(201).json({ ...order.toObject(), accessToken: order.accessToken });
  } catch (err) {
    if (uploadedAsset && !orderSaved) {
      if (!saveAttempted || isRejectedWrite(err)) await deleteUploadedAsset(uploadedAsset);
      else console.error("Design upload cleanup deferred: database write outcome is unknown.");
    }
    sendApiError(res, err, "Server Error", "createOrder");
  }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const archivedAt = req.query.archived === "true" ? { $ne: null } : null;
    const orders = await Order.find({ archivedAt }).select("+approvalEmail").sort({ createdAt: -1 });
    res.json(orders.map((order) => serializeAdminOrder(order)));
  } catch (err) {
    sendApiError(res, err, "Server Error", "getOrders");
  }
};

// PUT /api/orders/:id — edit customer-submitted details and an optional design.
exports.updateOrder = async (req, res) => {
  let uploadedAsset;
  let uploadPersisted = false;
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return invalidOrderId(res);
    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.archivedAt) return archivedOrderConflict(res);

    // The shared validator returns only explicitly allowed, present detail fields.
    const { values, errors } = validateOrderInput(req.body, { partial: true });
    if (Object.keys(errors).length) return sendValidationErrors(res, errors);
    if (!Object.keys(values).length && !req.file) {
      return sendValidationErrors(res, { fields: "Provide an editable order detail or a replacement design file." });
    }

    const blockedFields = PRICING_FIELDS.filter((field) =>
      Object.prototype.hasOwnProperty.call(values, field) && values[field] !== order[field]
    );
    if (req.file) blockedFields.push("designFile");
    if (blockedFields.length && order.status !== "Pending Approval") return quoteLocked(res, blockedFields);

    // Omit unchanged quote fields so a complete form can still edit contact details
    // after approval, without writing a stale quote back during a concurrent update.
    for (const field of PRICING_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(values, field) && values[field] === order[field]) delete values[field];
    }
    const filter = { _id: order._id, archivedAt: null };
    if (blockedFields.length) filter.status = "Pending Approval";
    if (req.file) {
      // Two replacements must not both clean up the same stale original file.
      filter.designFile = order.designFile || null;
      try {
        uploadedAsset = await uploadBuffer(req.file.buffer, "grandprint/designs");
      } catch (uploadError) {
        console.error("Design replacement upload failed:", uploadError);
        return res.status(422).json({
          message: "We could not accept this file. Please try another file or message us on Messenger.",
          contactUrl: "https://www.messenger.com/t/61551691632716",
        });
      }
      values.designFile = uploadedAsset.secure_url;
    }

    const updatedOrder = await Order.findOneAndUpdate(
      filter,
      { $set: values },
      { new: true, runValidators: true }
    ).select("+approvalEmail");
    if (!updatedOrder) {
      if (uploadedAsset) {
        await cleanupAsset(uploadedAsset, "Unused replacement design cleanup failed");
        uploadedAsset = undefined;
      }
      const currentOrder = await Order.findById(req.params.id);
      if (!currentOrder) return res.status(404).json({ message: "Order not found" });
      if (currentOrder.archivedAt) return archivedOrderConflict(res);
      if (blockedFields.length && currentOrder.status !== "Pending Approval") return quoteLocked(res, blockedFields);
      return res.status(409).json({ code: "ORDER_CONFLICT", message: "The order changed while saving. Please refresh and try again." });
    }
    uploadPersisted = true;

    const response = serializeAdminOrder(updatedOrder);
    if (uploadedAsset && order.designFile && order.designFile !== uploadedAsset.secure_url) {
      const cleanedUp = await cleanupAsset(uploadedAssetFromUrl(order.designFile), "Previous design cleanup failed");
      if (!cleanedUp) response.cleanupWarning = "The order was saved, but the previous design file could not be removed.";
    }
    return res.json(response);
  } catch (err) {
    if (uploadedAsset && !uploadPersisted) await cleanupAsset(uploadedAsset, "Unused replacement design cleanup failed");
    return sendApiError(res, err, "Unable to update order", "updateOrder");
  }
};

// PUT /api/orders/:id/archive — remove an active order from the working list.
exports.archiveOrder = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return invalidOrderId(res);
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, archivedAt: null },
      { $set: { archivedAt: new Date() } },
      { new: true, runValidators: true }
    ).select("+approvalEmail");
    if (!order) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return res.status(409).json({ code: "ALREADY_ARCHIVED", message: "This order is already archived." });
    }
    return res.json(serializeAdminOrder(order));
  } catch (err) {
    return sendApiError(res, err, "Unable to archive order", "archiveOrder");
  }
};

// PUT /api/orders/:id/restore — return an archived order to the working list.
exports.restoreOrder = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return invalidOrderId(res);
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, archivedAt: { $ne: null } },
      { $set: { archivedAt: null } },
      { new: true, runValidators: true }
    ).select("+approvalEmail");
    if (!order) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return res.status(409).json({ code: "NOT_ARCHIVED", message: "This order is not archived." });
    }
    return res.json(serializeAdminOrder(order));
  } catch (err) {
    return sendApiError(res, err, "Unable to restore order", "restoreOrder");
  }
};

// DELETE /api/orders/:id — permanently remove only an already archived order.
exports.deleteOrder = async (req, res) => {
  try {
    if (!mongoose.isObjectIdOrHexString(req.params.id)) return invalidOrderId(res);
    const order = await Order.findOneAndDelete({ _id: req.params.id, archivedAt: { $ne: null } });
    if (!order) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return res.status(409).json({ code: "NOT_ARCHIVED", message: "Archive this order before permanently deleting it." });
    }

    const cleanupResults = await Promise.all([order.designFile, order.paymentProof]
      .filter(Boolean)
      .map((url) => cleanupAsset(uploadedAssetFromUrl(url), "Deleted order file cleanup failed")));
    const response = { message: "Order permanently deleted.", orderId: order.orderId };
    if (cleanupResults.some((cleanedUp) => !cleanedUp)) {
      response.cleanupWarning = "The order was deleted, but some uploaded files could not be removed.";
    }
    return res.json(response);
  } catch (err) {
    return sendApiError(res, err, "Unable to delete order", "deleteOrder");
  }
};

// GET /api/orders/lookup/:orderId — authorized customer payment lookup
exports.getOrderByOrderId = async (req, res) => {
  const order = req.order;
  res.json({
    orderId: order.orderId,
    productType: order.productType,
    width: order.width,
    height: order.height,
    pieces: order.pieces,
    price: order.price,
    status: order.status,
  });
};

// POST /api/orders/:id/access-link — reuse a token or provision one for a legacy order
exports.getOrderAccessLink = async (req, res) => {
  try {
    const order = await provisionAccessToken(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json({ orderId: order.orderId, paymentLink: buildPaymentLink(order.orderId, order.accessToken) });
  } catch (err) {
    sendApiError(res, err, "Unable to create payment link", "getOrderAccessLink");
  }
};

// POST /api/orders/:id/access-link/rotate — invalidate the previous private link
exports.rotateOrderAccessLink = async (req, res) => {
  try {
    const order = await Order.findOneAndUpdate(
      {
        _id: req.params.id,
        $nor: [{ "approvalEmail.state": "sending", "approvalEmail.leaseExpiresAt": { $gt: new Date() } }],
      },
      { $set: { accessToken: generateAccessToken() } },
      { new: true }
    ).select("+accessToken");
    if (!order) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return res.status(409).json({
        code: "LINK_ROTATION_IN_PROGRESS",
        message: "Cannot rotate: an approval email is being sent. Please wait and refresh.",
      });
    }
    res.json({ orderId: order.orderId, paymentLink: buildPaymentLink(order.orderId, order.accessToken) });
  } catch (err) {
    sendApiError(res, err, "Unable to rotate payment link", "rotateOrderAccessLink");
  }
};

// PUT /api/orders/:id/status  — advance the approved lifecycle (no email)
exports.updateOrderStatus = async (req, res) => {
  try {
    const status = req.body?.status;
    if (typeof status !== "string" || !Order.schema.path("status").enumValues.includes(status)) {
      return sendValidationErrors(res, { status: "Select a valid order status." });
    }
    const previousStatuses = STATUS_PREDECESSORS[status];
    if (!previousStatuses) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return statusConflict(res);
    }
    const order = await Order.findOneAndUpdate(
      { _id: req.params.id, status: { $in: previousStatuses } },
      { $set: { status } },
      { new: true, runValidators: true }
    );
    if (!order) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return statusConflict(res);
    }
    res.json(order);
  } catch (err) {
    sendApiError(res, err, "Error updating status", "updateOrderStatus");
  }
};

// PUT /api/orders/:id/approve  — set price + send email to client
exports.approveOrder = async (req, res) => {
  try {
    const price = parseNumber(req.body?.price);
    if (!isValidPrice(price)) {
      return sendValidationErrors(res, { price: "Enter a finite price greater than zero." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Pending Approval") {
      return statusConflict(res);
    }

    const accessOrder = await provisionAccessToken(order._id);
    if (!accessOrder) return res.status(404).json({ message: "Order not found" });

    const approvedOrder = await Order.findOneAndUpdate(
      { _id: req.params.id, status: "Pending Approval" },
      { $set: { price, status: "Awaiting Downpayment", approvalEmail: createEmailAttempt() } },
      { new: true, runValidators: true }
    ).select("+accessToken +approvalEmail");
    if (!approvedOrder) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return statusConflict(res);
    }

    // Reply immediately without waiting for the email provider.
    res.json({ order: serializeAdminOrder(approvedOrder) });

    // Send the approval email in the background; log (don't crash) if it fails.
    dispatchApprovalEmail(approvedOrder);
  } catch (err) {
    sendApiError(res, err, "Server error", "approveOrder");
  }
};

// POST /api/orders/:id/approval-email/resend — send the current quote again
exports.resendApprovalEmail = async (req, res) => {
  try {
    const order = await Order.findById(req.params.id).select("+approvalEmail");
    if (!order) return res.status(404).json({ message: "Order not found" });
    if (order.status !== "Awaiting Downpayment") {
      return res.status(409).json({ code: "EMAIL_RESEND_NOT_ALLOWED", message: "Approval emails can only be resent while awaiting downpayment." });
    }
    if (typeof order.email !== "string" || order.email.trim().length > 254 || !isValidEmail(order.email.trim())) {
      return res.status(400).json({ code: "EMAIL_INVALID_RECIPIENT", message: "Cannot resend: this order has a missing or invalid email address." });
    }
    if (!isValidPrice(order.price)) return invalidResendPrice(res);

    const now = Date.now();
    const state = getApprovalEmailState(order, now);
    if (state === "sending") {
      return res.status(409).json({ code: "EMAIL_IN_PROGRESS", message: "An approval email is already being sent. Please wait and refresh." });
    }
    if (["accepted", "unknown"].includes(state) && req.body?.confirmDuplicate !== true) {
      return res.status(409).json({ code: "EMAIL_DUPLICATE_CONFIRMATION", message: "This email may already have been accepted. Confirm before resending." });
    }
    try {
      validateEmailSettings();
    } catch {
      return res.status(400).json({ code: "EMAIL_CONFIGURATION", message: "Approval email settings are missing or invalid. Check the email setup on Render." });
    }

    const accessOrder = await provisionAccessToken(order._id);
    if (!accessOrder) return res.status(404).json({ message: "Order not found" });
    const filter = { _id: req.params.id, status: "Awaiting Downpayment", email: order.email, price: order.price };
    if (order.approvalEmail) {
      filter["approvalEmail.attemptId"] = order.approvalEmail.attemptId;
      filter["approvalEmail.state"] = order.approvalEmail.state;
      if (order.approvalEmail.state === "sending") filter["approvalEmail.leaseExpiresAt"] = { $lte: new Date(now) };
    } else {
      filter.$or = [{ approvalEmail: { $exists: false } }, { approvalEmail: null }];
    }
    const claimedOrder = await Order.findOneAndUpdate(
      filter,
      { $set: { approvalEmail: createEmailAttempt(now) } },
      { new: true, runValidators: true }
    ).select("+accessToken +approvalEmail");
    if (!claimedOrder) {
      const currentOrder = await Order.findById(req.params.id);
      if (!currentOrder) return res.status(404).json({ message: "Order not found" });
      if (!isValidPrice(currentOrder.price)) return invalidResendPrice(res);
      return res.status(409).json({ code: "EMAIL_IN_PROGRESS", message: "An approval email is already being sent. Please wait and refresh." });
    }
    res.status(202).json({ order: serializeAdminOrder(claimedOrder) });
    dispatchApprovalEmail(claimedOrder);
  } catch (err) {
    sendApiError(res, err, "Unable to resend approval email", "resendApprovalEmail");
  }
};
