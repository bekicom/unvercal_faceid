const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const routes = require("./router/router");

const app = express();

app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

/* ROUTES */
app.use("/api", routes); // 🔥 SHU YERGA KO‘CHIRDIK

/* HEALTH CHECK */
app.get("/", (req, res) => {
  res.status(200).json({
    success: true,
    message: "🚀 FaceID SaaS Core Running",
  });
});

/* 404 HANDLER */
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: "Route not found",
  });
});

/* GLOBAL ERROR HANDLER */
app.use((err, req, res, next) => {
  console.error("❌ Error:", err);
  res.status(err.status || 500).json({
    success: false,
    message: err.message || "Internal Server Error",
  });
});

module.exports = app;
