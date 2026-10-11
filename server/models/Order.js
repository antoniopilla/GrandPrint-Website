const mongoose = require("mongoose");
const { PRODUCT_TYPES, LIMITS, isValidEmail, isValidDimension, isValidPieces, isValidPrice } = require("../utils/orderValidation");

const approvalEmailSchema = new mongoose.Schema({
  state: { type: String, enum: ["sending", "accepted", "failed", "unknown"], required: true },
  attemptId: { type: String, required: true },
  lastAttemptAt: { type: Date, required: true },
  acceptedAt: { type: Date },
  leaseExpiresAt: { type: Date, required: true },
}, { _id: false });

const orderSchema = new mongoose.Schema(
  {
    orderId: { type: String, required: true, unique: true },
    accessToken: { type: String, select: false },
    approvalEmail: { type: approvalEmailSchema, default: undefined, select: false },
    customerName: { type: String, required: true, trim: true, maxlength: LIMITS.customerName },
    email: { type: String, required: true, trim: true, maxlength: LIMITS.email, validate: isValidEmail },
    contactNumber: { type: String, required: true, trim: true, maxlength: LIMITS.contactNumber },
    productType: {
      type: String,
      required: true,
      trim: true,
      enum: PRODUCT_TYPES,
    },
    width: { type: Number, required: true, validate: isValidDimension },
    height: { type: Number, required: true, validate: isValidDimension },
    pieces: { type: Number, required: true, validate: isValidPieces },
    notes: { type: String, default: "", trim: true, maxlength: LIMITS.notes },
    designFile: { type: String },
    price: { type: Number, validate: isValidPrice },
    paymentProof: { type: String },
    status: {
      type: String,
      default: "Pending Approval",
      enum: [
        "Pending Approval",
        "Awaiting Downpayment",
        "Payment Submitted",
        "Printing",
        "Completed",
        "Fully Paid",
      ],
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        delete ret.accessToken;
        delete ret.approvalEmail;
        return ret;
      },
    },
    toObject: {
      transform: (_doc, ret) => {
        delete ret.accessToken;
        delete ret.approvalEmail;
        return ret;
      },
    },
  }
);

module.exports = mongoose.model("Order", orderSchema);
