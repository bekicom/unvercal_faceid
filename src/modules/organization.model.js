const mongoose = require("mongoose");

const organizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    address: { type: String },
    entryDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
    exitDevice: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Device",
      default: null,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Organization", organizationSchema);
