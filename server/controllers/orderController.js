const Order = require("../models/Order");
const sendApprovalEmail = require("../utils/emailService");
const { uploadBuffer } = require("../config/cloudinary");

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
      const result = await uploadBuffer(req.file.buffer, "grandprint/designs");
      designFile = result.secure_url;
    }

    const order = new Order({
      orderId: await generateOrderId(),
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
    res.status(201).json(order);
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

// GET /api/orders/lookup/:orderId — public, sanitized lookup for the customer payment page
exports.getOrderByOrderId = async (req, res) => {
  try {
    const order = await Order.findOne({ orderId: req.params.orderId }).select(
      "orderId customerName productType price status width height pieces createdAt"
    );
    if (!order) return res.status(404).json({ message: "Order not found" });
    res.json(order);
  } catch (err) {
    res.status(500).json({ message: "Server Error" });
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

    order.price = Number(price);
    order.status = "Awaiting Downpayment";
    await order.save();

    // Reply immediately — don't make the admin wait on SMTP/email delivery.
    res.json({ order });

    // Send the approval email in the background; log (don't crash) if it fails.
    sendApprovalEmail(order).catch((emailErr) =>
      console.error("Email failed (order still approved):", emailErr.message)
    );
  } catch (err) {
    console.error("approveOrder:", err);
    res.status(500).json({ message: "Server error", detail: err.message });
  }
};