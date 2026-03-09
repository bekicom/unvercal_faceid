const mongoose = require("mongoose");

const payrollPaymentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },
    employee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Employee",
      required: true,
      index: true,
    },
    payrollRecord: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "PayrollRecord",
      required: true,
      index: true,
    },
    year: {
      type: Number,
      required: true,
      min: 2000,
    },
    month: {
      type: Number,
      required: true,
      min: 1,
      max: 12,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      enum: ["ADVANCE", "PARTIAL", "FINAL"],
      default: "PARTIAL",
    },
    paymentDate: {
      type: Date,
      default: Date.now,
    },
    note: {
      type: String,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("PayrollPayment", payrollPaymentSchema);
