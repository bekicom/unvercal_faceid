const mongoose = require("mongoose");

const payrollRecordSchema = new mongoose.Schema(
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

    baseSalary: { type: Number, default: 0 },
    workingDaysInMonth: { type: Number, default: 0 },
    presentDays: { type: Number, default: 0 },
    absentDays: { type: Number, default: 0 },
    totalWorkedMinutes: { type: Number, default: 0 },
    totalLateMinutes: { type: Number, default: 0 },
    totalEarlyLeaveMinutes: { type: Number, default: 0 },

    lateDates: [
      {
        date: String,
        minutes: Number,
      },
    ],
    earlyLeaveDates: [
      {
        date: String,
        minutes: Number,
      },
    ],
    absentDates: [String],

    deductions: {
      lateDeduction: { type: Number, default: 0 },
      earlyLeaveDeduction: { type: Number, default: 0 },
      absenceDeduction: { type: Number, default: 0 },
      totalDeduction: { type: Number, default: 0 },
      minuteRate: { type: Number, default: 0 },
      policy: {
        useTimePenalty: { type: Boolean, default: false },
        penaltyPerMinute: { type: Number, default: 0 },
      },
    },

    netSalary: { type: Number, default: 0 },
    carryFromPrevious: { type: Number, default: 0 },
    totalDue: { type: Number, default: 0 },
    paidAmount: { type: Number, default: 0 },
    remainingAmount: { type: Number, default: 0 },

    status: {
      type: String,
      enum: ["DRAFT", "APPROVED", "PARTIAL_PAID", "PAID"],
      default: "DRAFT",
    },
    approvedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Admin",
      default: null,
    },
    approvedAt: {
      type: Date,
      default: null,
    },
    lastCalculatedAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true },
);

payrollRecordSchema.index(
  { organizationId: 1, employee: 1, year: 1, month: 1 },
  { unique: true },
);

module.exports = mongoose.model("PayrollRecord", payrollRecordSchema);
