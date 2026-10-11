const express = require("express");
const cors = require("cors");
require("dotenv").config();
const mongoose = require("mongoose");
const { getStartupConfig } = require("./config/startup");
const connectDB = require("./config/db");

const startServer = async () => {
  let config;
  try {
    config = getStartupConfig();
  } catch (err) {
    console.error(err.message);
    process.exit(1);
    return;
  }

  const orderRoutes = require("./routes/orderRoutes");
  const adminRoutes = require("./routes/adminRoutes");
  const customerRoutes = require("./routes/customerRoutes");
  const errorHandler = require("./middleware/errorHandler");
  const app = express();

  // CORS: restrict to the allowed origins from CLIENT_URL (comma-separated).
  // When unset (local dev), allow all origins.
  app.use(
    cors({
      origin: config.allowedOrigins.length ? config.allowedOrigins : true,
      allowedHeaders: ["Content-Type", "Authorization", "X-Order-Access-Token"],
    })
  );
  app.use(express.json());

  app.use("/api/orders", orderRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/customers", customerRoutes);

  app.get("/", (req, res) => {
    if (mongoose.connection.readyState !== 1) {
      return res.status(503).send("GrandPrint API is not ready.");
    }
    return res.send("GrandPrint API is running.");
  });
  app.use(errorHandler);

  try {
    await connectDB(config.mongoUri);
  } catch {
    console.error("MongoDB connection failed. Check MONGO_URI and database access.");
    process.exit(1);
    return;
  }

  app.listen(config.port, () =>
    console.log(`Server running on http://localhost:${config.port}`)
  );
};

startServer();
