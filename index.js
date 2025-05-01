const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const jwt = require("jsonwebtoken");
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
app.use(
  cors({
    origin: ["http://localhost:5173", "https://projectx90.netlify.app"],
    credentials: true,
  })
);
app.use(express.json());
app.use(passport.initialize());
require("./config/google");

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

// Google OAuth routes
app.get(
  "/auth/google",
  (req, res, next) => {
    console.log("Initiating Google OAuth, redirect URI:", process.env.GOOGLE_CALLBACK_URL);
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  }
);

app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/signup?error=auth_failed`,
  }),
  (req, res) => {
    try {
      console.log("Google callback processed, user:", req.user.email);
      const token = jwt.sign(
        { id: req.user._id, role: req.user.role },
        process.env.JWT_SECRET,
        { expiresIn: "1d" }
      );
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });
      res.redirect(`${process.env.FRONTEND_URL}/`);
    } catch (err) {
      console.error("Google callback error:", err);
      res.redirect(`${process.env.FRONTEND_URL}/signup?error=auth_failed`);
    }
  }
);

// Routes
app.use("/api/bills", bills);
app.use("/api/expenses", expensesRouter);
app.use("/api/parties", partyRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api/reports", reportRoutes);
app.use("/api", authRoutes);

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
  .then(() => {
    console.log("Connected to MongoDB");
    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error("MongoDB connection error:", err);
    process.exit(1);
  });