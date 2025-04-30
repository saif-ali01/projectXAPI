const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const dotenv = require("dotenv");
const session = require("express-session");
const passport = require("passport");
const jwt = require("jsonwebtoken");

const bills = require("./routes/bills");
const expensesRouter = require("./routes/expenses");
const partyRoutes = require("./routes/parties");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");

require("./auth/google"); // Google OAuth strategy config
const User = require("./models/User");

dotenv.config();

const app = express();

// Middleware
app.use(cors({
  origin: "http://localhost:3000", // Set this to your frontend URL
  credentials: true,
}));
app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET || "secret",
  resave: false,
  saveUninitialized: false,
}));

app.use(passport.initialize());
app.use(passport.session());

// Health check
app.get("/api/health", async (req, res) => {
  try {
    await mongoose.connection.db.admin().ping();
    res.status(200).json({ status: "ok", message: "MongoDB connected" });
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({ status: "error", message: "MongoDB connection failed" });
  }
});

// Google OAuth routes
app.get("/auth/google",
  passport.authenticate("google", { scope: ["profile", "email"] })
);

app.get("/auth/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: "/login" }),
  (req, res) => {
    const token = jwt.sign(
      { id: req.user._id, role: req.user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );
    res.redirect(`http://localhost:5173/oauth-success?token=${token}`);
  }
);

// Routes
app.use("/api/bills", bills);
app.use("/api/expenses", expensesRouter);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/parties", partyRoutes);
app.use("/api", authRoutes);
app.use("/api/reports", reportRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error("Global error:", {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method,
  });
  res.status(500).json({ message: "Server error" });
});

// Connect to MongoDB and start server
mongoose
  .connect(process.env.MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => {
    console.log("Connected to MongoDB");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });
