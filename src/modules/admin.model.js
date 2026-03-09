const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema(
  {
    organizationId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Organization",
      default: null,
    },
    fullName: { type: String, required: true },
    phone: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["SUPER_ADMIN", "ORG_ADMIN"],
      default: "ORG_ADMIN",
    },
  },
  { timestamps: true },
);

module.exports = mongoose.model("Admin", adminSchema);
