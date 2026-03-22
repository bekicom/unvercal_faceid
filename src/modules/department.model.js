const mongoose = require("mongoose");

const normalizeWorkDays = (value) => {
  if (value === undefined) return value;

  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(",")
      : [value];

  const normalized = values.map((day) => Number(day));

  if (normalized.length === 0) {
    return value;
  }

  const isZeroBased = normalized.every(
    (day) => Number.isInteger(day) && day >= 0 && day <= 6,
  );
  const isOneBased = normalized.every(
    (day) => Number.isInteger(day) && day >= 1 && day <= 7,
  );

  if (!isZeroBased && !isOneBased) {
    return value;
  }

  const normalizedToZeroBased = isOneBased
    ? normalized.map((day) => day % 7)
    : normalized;

  return [...new Set(normalizedToZeroBased)].sort((a, b) => a - b);
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

    // Ichkarida 0=Yakshanba ... 6=Shanba saqlanadi.
    // API esa 0..6 yoki 1..7 formatini qabul qiladi.
    workDays: {
      type: [Number],
      default: [1, 2, 3, 4, 5, 6],
      set: normalizeWorkDays,
      validate: {
        validator: function (arr) {
          if (!Array.isArray(arr) || arr.length === 0) return false;
          return arr.every((d) => Number.isInteger(d) && d >= 0 && d <= 6);
        },
        message: "workDays 0..6 yoki 1..7 formatida bo'lishi kerak",
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
