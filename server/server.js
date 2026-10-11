const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { getCustomerPortalUrl } = require("./config/customerPortal");
getCustomerPortalUrl();
const connectDB = require("./config/db");
const orderRoutes = require("./routes/orderRoutes");
const adminRoutes = require("./routes/adminRoutes");
const customerRoutes = require("./routes/customerRoutes");

const app = express();

connectDB();

// CORS: restrict to the allowed origins from CLIENT_URL (comma-separated).
// When unset (local dev), allow all origins.
const allowedOrigins = (process.env.CLIENT_URL || "")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Order-Access-Token"],
  })
);
app.use(express.json());

app.use("/api/orders", orderRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/customers", customerRoutes);

app.get("/", (req, res) => res.send("GrandPrint API is running."));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
