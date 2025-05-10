const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const passport = require("passport");
const jwt = require("jsonwebtoken");
const dotenv = require("dotenv");
const cookieParser = require("cookie-parser");
const User = require("./models/User");
const bills = require("./routes/bills");
const clientRoutes = require('./routes/clientRoutes');
const expensesRouter = require("./routes/expenses");
const partyRoutes = require("./routes/parties");
const dashboardRoutes = require("./routes/dashboard");
const authRoutes = require("./routes/authRoutes");
const reportRoutes = require("./routes/reportRoutes");

dotenv.config();

// Log environment variables for debugging
console.log("Environment variables:", {
  GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ? "Set" : "Not set",
  GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ? "Set" : "Not set",
  GOOGLE_CALLBACK_URL: process.env.GOOGLE_CALLBACK_URL,
  FRONTEND_URL: process.env.FRONTEND_URL,
  JWT_SECRET: process.env.JWT_SECRET ? "Set" : "Not set",
  MONGODB_URI: process.env.MONGODB_URI ? "Set" : "Not set",
  PORT: process.env.PORT,
});

const app = express();

// Middleware
app.use(express.static("public")); // Serve static files (e.g., favicon.ico)
app.use(cookieParser());
app.use(
  cors({
    origin: [
      process.env.FRONTEND_URL,
      "https://projectx600.netlify.app",
      "http://localhost:5173",
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS","PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);
app.use(express.json());
app.use(passport.initialize());
console.log("Passport initialized");
try {
  require("./config/google");
  console.log("Google Strategy loaded");
} catch (err) {
  console.error("Failed to load Google Strategy:", err);
}

// Log all incoming requests for debugging
app.use((req, res, next) => {
  console.log(`Request: ${req.method} ${req.url}`);
  next();
});

// Handle favicon.ico to prevent 404
app.get("/favicon.ico", (req, res) => {
  console.log("Requested favicon.ico");
  res.status(204).end();
});

// Google OAuth route
app.get(
  "/auth/google",
  (req, res, next) => {
    console.log("Hit /auth/google, redirect URI:", process.env.GOOGLE_CALLBACK_URL);
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.error("Google OAuth misconfigured: Missing client ID or secret");
      return res.status(500).json({ message: "Server configuration error" });
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(req, res, next);
  }
);

// Google OAuth callback
app.get(
  "/auth/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${process.env.FRONTEND_URL}/signup?error=auth_failed`,
  }),
  async (req, res) => {
    try {
      console.log("Google callback processed, user:", req.user?.email);
      if (!req.user) {
        throw new Error("No user data from passport");
      }
      if (!process.env.JWT_SECRET) {
        throw new Error("JWT_SECRET is not defined");
      }
      const token = jwt.sign(
        { id: req.user._id, role: req.user.role, email: req.user.email },
        process.env.JWT_SECRET,
        { expiresIn: "1h" }
      );
      const refreshToken = jwt.sign(
        { id: req.user._id },
        process.env.JWT_SECRET,
        { expiresIn: "7d" }
      );
      req.user.refreshToken = refreshToken;
      await req.user.save();
      res.cookie("authToken", token, {
        httpOnly: true,
        secure: true, // Must be true in production
        sameSite: "none", // Required for cross-domain cookies
        maxAge: 60 * 60 * 1000,
      });
      
      res.cookie("refreshToken", refreshToken, {
        httpOnly: true,
        secure: true,
        sameSite: "none",
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
      console.log("Redirecting to:", `${process.env.FRONTEND_URL}/`);
      res.redirect(`${process.env.FRONTEND_URL}/`);
    } catch (err) { 
      console.error("Google callback error:", {
        message: err.message,
        stack: err.stack,
        user: req.user,
      });
      res.redirect(`${process.env.FRONTEND_URL}/signup?error=server_error`);
    }
  }
);

// Root route
app.get("/", (req, res) => {
  console.log("Hit root route");
  res.status(200).json({ message: "ProjectX API is running" });
});

// Authentication middleware
const protect = async (req, res, next) => {
  try {
    // Debug logging
    console.log('Received cookies:', req.cookies);
    
    const token = req.cookies.authToken || req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      console.log('No token found');
      return res.status(401).json({ message: "No token provided" });
    }

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('Decoded token:', decoded);

    // Find user with refresh token validation
    const user = await User.findOne({
      _id: decoded.id,
      refreshToken: { $exists: true }
    }).select("-password");

    if (!user) {
      console.log('User not found with valid refresh token');
      return res.status(401).json({ message: "User session expired" });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error('JWT Error:', err.message);
    res.status(401).json({ message: "Invalid token" });
  }
};
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

// User info endpoint
app.get("/api/me", protect, async (req, res) => {
  try {
    res.json({
      id: req.user._id,
      email: req.user.email,
      name: req.user.name,
      role: req.user.role,
    });
  } catch (err) {
    console.error("Get user error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Refresh token
app.post("/api/refresh-token", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (!refreshToken) {
      return res.status(401).json({ message: "No refresh token provided" });
    }
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    if (!user || user.refreshToken !== refreshToken) {
      return res.status(401).json({ message: "Invalid refresh token" });
    }
    const newToken = jwt.sign(
      { id: user._id, role: user.role, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: "1h" }
    );
    res.cookie("authToken", newToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 1000,
    });
    res.json({ message: "Token refreshed" });
  } catch (err) {
    console.error("Refresh token error:", err);
    res.status(401).json({ message: "Invalid refresh token" });
  }
});

// Logout
app.post("/api/logout", async (req, res) => {
  try {
    const refreshToken = req.cookies.refreshToken;
    if (refreshToken) {
      await User.findOneAndUpdate(
        { refreshToken },
        { $unset: { refreshToken: "" } }
      );
    }
    res.clearCookie("authToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.clearCookie("refreshToken", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
    });
    res.json({ message: "Logged out successfully" });
  } catch (err) {
    console.error("Logout error:", err);
    res.status(500).json({ message: "Server error" });
  }
});

// Protected routes
app.use("/api/bills", protect, bills);
app.use("/api/expenses",  expensesRouter);
app.use("/api/parties", protect, partyRoutes);
app.use("/api/dashboard",  dashboardRoutes);
app.use("/api/reports", protect, reportRoutes);
app.use("/api", authRoutes);
app.use('/api/clients',protect, clientRoutes);
app.use("/api/works",protect,  require("./routes/workRoutes"));
app.use("/api/earnings", require("./routes/earnings"));
app.use("/api/budget",protect, require("./routes/budget"));
// Catch-all route for debugging
app.use((req, res) => {
  console.log("Unhandled route:", req.method, req.url);
  res.status(404).json({ message: "Route not found" });
});

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

// MongoDB connection with retry
const connectWithRetry = async () => {
  let retries = 5;
  while (retries) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("Connected to MongoDB");
      return;
    } catch (err) {
      console.error(`MongoDB connection error (${retries} retries left):`, err);
      retries -= 1;
      if (retries === 0) {
        console.error("MongoDB connection failed after retries");
        process.exit(1);
      }
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

connectWithRetry();

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));