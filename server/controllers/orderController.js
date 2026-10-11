const Order = require("../models/Order");
const sendApprovalEmail = require("../utils/emailService");
const { uploadBuffer } = require("../config/cloudinary");
const { generateAccessToken } = require("../utils/orderAccess");
const { buildPaymentLink } = require("../config/customerPortal");

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
    const { customerName, email, contactNumber, productType, width, height, pieces, notes } =
      req.body;

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
      width: Number(width),
      height: Number(height),
      pieces: Number(pieces),
      notes: notes || "",
      designFile,
    });

    await order.save();
    res.status(201).json({ ...order.toObject(), accessToken: order.accessToken });
  } catch (err) {
    console.error("createOrder:", err);
    res.status(500).json({ message: "Server Error", detail: err.message });
  }
};

// GET /api/orders
exports.getOrders = async (req, res) => {
  try {
    const orders = await Order.find().sort({ createdAt: -1 });
    res.json(orders);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
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
    res.status(500).json({ message: "Unable to create payment link" });
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
    res.status(500).json({ message: "Unable to rotate payment link" });
  }
};

// PUT /api/orders/:id/status  — simple status change (no email)
exports.updateOrderStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Error updating status" });
  }
};

// PUT /api/orders/:id/approve  — set price + send email to client
exports.approveOrder = async (req, res) => {
  try {
    const { price } = req.body;

    if (!price || isNaN(price) || Number(price) <= 0) {
      return res.status(400).json({ message: "A valid price is required." });
    }

    const order = await Order.findById(req.params.id);
    if (!order) return res.status(404).json({ message: "Order not found" });

    if (order.status !== "Pending Approval") {
      return res.status(400).json({ message: "Order is not pending approval." });
    }

    const accessOrder = await provisionAccessToken(order._id);
    if (!accessOrder) return res.status(404).json({ message: "Order not found" });

    order.price = Number(price);
    order.status = "Awaiting Downpayment";
    await order.save();

    // Reply immediately — don't make the admin wait on SMTP/email delivery.
    res.json({ order });

    // Send the approval email in the background; log (don't crash) if it fails.
    sendApprovalEmail({ ...order.toObject(), accessToken: accessOrder.accessToken }).catch((emailErr) =>
      console.error("Email failed (order still approved):", emailErr.message)
    );
  } catch (err) {
    console.error("approveOrder:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
};
