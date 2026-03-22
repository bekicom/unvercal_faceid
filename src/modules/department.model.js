const mongoose = require("mongoose");

const normalizeWorkDays = (value) => {
  if (value === undefined) return value;

  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [value];

  const normalized = values.map((day) => Number(day));

  if (
    normalized.length === 0 ||
    normalized.some((day) => !Number.isInteger(day) || day < 0 || day > 6)
  ) {
    return value;
  }

  return [...new Set(normalized)].sort((a, b) => a - b);
};

const departmentSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    checkInTime: {
      type: String, // "08:00"
      required: true,
    },

    checkOutTime: {
      type: String, // "21:00"
      required: true,
    },

    lateAfterMinutes: {
      type: Number,
      default: 0,
    },

    earlyLeaveMinutes: {
      type: Number,
      default: 0,
    },

    useLatePenalty: {
      type: Boolean,
      default: false,
    },

    useEarlyLeavePenalty: {
      type: Boolean,
      default: false,
    },

    latePenaltyPerMinute: {
      type: Number,
      default: 0,
      min: 0,
    },

    earlyLeavePenaltyPerMinute: {
      type: Number,
      default: 0,
      min: 0,
    },

    // Yagona jarima: kech qolish + erta ketishga bir xil qoida
    useTimePenalty: {
      type: Boolean,
      default: false,
    },

    penaltyPerMinute: {
      type: Number,
      default: 0,
      min: 0,
    },

    defaultSalary: {
      type: Number,
      default: 0,
      min: 0,
    },

    // 0=Yakshanba ... 6=Shanba
    workDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5, 6],
      set: normalizeWorkDays,
      validate: {
        validator: function (arr) {
          if (!Array.isArray(arr) || arr.length === 0) return false;
          return arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        },
        message: "workDays 0..6 oralig'idagi kunlardan iborat bo'lishi kerak",
      },
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

// 🔥 bir organization ichida department nomi unique
departmentSchema.index({ organizationId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("Department", departmentSchema);
