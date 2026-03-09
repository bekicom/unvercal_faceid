const mongoose = require("mongoose");

const attendanceSchema = new mongoose.Schema(
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

    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },

    date: {
      type: String, // YYYY-MM-DD
      required: true,
      index: true,
    },

    firstEntry: {
      type: Date,
      required: true,
    },

    currentEntry: {
      type: Date,
      default: null,
    },

    lastExit: {
      type: Date,
      default: null,
    },

    totalHours: {
      type: Number, // soat ko‘rinishida (masalan 12.5)
      default: 0,
    },
  },
  { timestamps: true },
);

// Bir hodim uchun bir kunda bitta record
attendanceSchema.index(
  { organizationId: 1, employee: 1, date: 1 },
  { unique: true },
);

module.exports = mongoose.model("Attendance", attendanceSchema);
