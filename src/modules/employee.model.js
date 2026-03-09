const mongoose = require("mongoose");

const employeeSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true,
    },

    fullName: {
      type: String,
      required: true,
      trim: true,
    },

    employeeCode: {
      type: String,
      required: true,
      trim: true,
    },

    phone: {
      type: String,
      required: true,
      trim: true,
    },

    position: {
      type: String,
      trim: true,
    },

    salary: {
      type: Number,
      default: 0,
    },

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

/* 🔥 Bir organization ichida employeeCode unique */
employeeSchema.index({ organizationId: 1, employeeCode: 1 }, { unique: true });

module.exports = mongoose.model("Employee", employeeSchema);
