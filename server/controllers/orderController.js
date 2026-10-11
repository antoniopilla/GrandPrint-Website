const Order = require("../models/Order");
const sendApprovalEmail = require("../utils/emailService");
const { uploadBuffer } = require("../config/cloudinary");
const { generateAccessToken } = require("../utils/orderAccess");
const { buildPaymentLink } = require("../config/customerPortal");
const { sendApiError } = require("../utils/apiError");
const { validateOrderInput, sendValidationErrors, parseNumber, isValidPrice } = require("../utils/orderValidation");

const STATUS_PREDECESSORS = {
  Printing: ["Awaiting Downpayment", "Payment Submitted"],
  Completed: ["Printing"],
  "Fully Paid": ["Completed"],
};
const statusConflict = (res) => res.status(409).json({
  code: "INVALID_TRANSITION",
  message: "Order status has changed or this transition is not allowed. Please refresh and try again.",
});

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

const generateOrderId = async () => {
  let id, exists = true;
  while (exists) {
    id = "GP-" + Math.floor(100000 + Math.random() * 900000);
    exists = await Order.exists({ orderId: id });
  }
  return id;
};

// POST /api/orders
exports.createOrder = async (req, res) => {
  try {
    const { values, errors } = validateOrderInput(req.body);
    if (Object.keys(errors).length) return sendValidationErrors(res, errors);
    const { customerName, email, contactNumber, productType, width, height, pieces, notes } = values;

    let designFile = null;
    if (req.file) {
      try {
        const result = await uploadBuffer(req.file.buffer, "grandprint/designs");
        designFile = result.secure_url;
      } catch (uploadError) {
        console.error("Design upload failed:", uploadError);
        return res.status(422).json({
          message: "We could not accept this file. Please try another file or message us on Messenger.",
          contactUrl: "https://www.messenger.com/t/61551691632716",
        });
      }
    }

    const order = new Order({
      orderId: await generateOrderId(),
      accessToken: generateAccessToken(),
      customerName,
      email,
      contactNumber,
      productType,
      width,
      height,
      pieces,
      notes,
      designFile,
    });

    await order.save();
    res.status(201).json({ ...order.toObject(), accessToken: order.accessToken });
  } catch (err) {
    sendApiError(res, err, "Server Error", "createOrder");
  }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    sendApiError(res, err, "Server Error", "getOrders");
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
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { $set: { accessToken: generateAccessToken() } },
      { new: true }
    ).select("+accessToken");
    if (!order) return res.status(404).json({ message: "Order not found" });
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
      { $set: { price, status: "Awaiting Downpayment" } },
      { new: true, runValidators: true }
    ).select("+accessToken");
    if (!approvedOrder) {
      if (!await Order.exists({ _id: req.params.id })) return res.status(404).json({ message: "Order not found" });
      return statusConflict(res);
    }

    // Reply immediately — don't make the admin wait on SMTP/email delivery.
    res.json({ order: approvedOrder });

    // Send the approval email in the background; log (don't crash) if it fails.
    sendApprovalEmail({ ...approvedOrder.toObject(), accessToken: approvedOrder.accessToken }).catch((emailErr) =>
      console.error("Email failed (order still approved):", emailErr.message)
    );
  } catch (err) {
    sendApiError(res, err, "Server error", "approveOrder");
  }
};
