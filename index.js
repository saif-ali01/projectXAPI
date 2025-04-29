const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const bills = require("./routes/bills");
const expensesRouter = require("./routes/expenses");
const partyRoutes = require("./routes/parties");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: "*", // Update to your frontend URL in production
  credentials: false,
}));
app.use(express.json());

// Health check endpoint
app.get("/api/health", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: "ok", message: "MongoDB connected" });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ status: "error", message: "MongoDB connection failed" });
  }
});

// Routes
app.use("/api/bills", bills);
app.use("/api/expenses", expensesRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api", authRoutes);
app.use("/api/reports", reportRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error("Global error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ message: "Server error" });
});

// Connect to MongoDB
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));