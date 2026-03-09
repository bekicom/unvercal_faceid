const mongoose = require("mongoose");

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGO_URI, {
      autoIndex: true, // development uchun true
    });

    console.log(`✅ MongoDB Connected: mazami`);
  } catch (error) {
    console.error("❌ MongoDB connection error:", error.message);
    process.exit(1); // agar DB ulanmasa server ishlamasin
  }
};

module.exports = connectDB;
