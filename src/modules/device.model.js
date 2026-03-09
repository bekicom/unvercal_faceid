const mongoose = require("mongoose");

const deviceSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      required: true,
      index: true, // 🔥 tez qidirish uchun
    },

    name: {
      type: String,
      required: true,
      trim: true,
    },

    deviceKey: {
      type: String,
      required: true,
      unique: true, // 🔥 har device unikal
    },

    floor: {
      type: Number,
      default: 1,
    },

    direction: {
      type: String,
      enum: ["IN", "OUT", "BOTH"],
      default: "IN",
    },

    locationDescription: {
      type: String,
      default: "",
    },

    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Device", deviceSchema);
