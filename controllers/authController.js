const { Router } = require("express");
const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const jwt = require("jsonwebtoken");
const winston = require("winston");

const router = Router();

// Logger setup
const logger = winston.createLogger({
  level: "error",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: "logs/error.log" }),
    new winston.transports.Console(),
  ],
});

// Validation middleware for signup and login
const validateAuth = (method) => {
  switch (method) {
    case "signup":
      return [
        body("name")
          .trim()
          .notEmpty()
          .withMessage("Name is required")
          .escape(), // Sanitize input to prevent XSS
        body("email")
          .isEmail()
          .normalizeEmail()
          .withMessage("Invalid email address"),
        body("password")
          .isLength({ min: 8 })
          .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
          .withMessage(
            "Password must be at least 8 characters, including uppercase, lowercase, number, and special character"
          ),
      ];
    case "login":
      return [
        body("email")
          .isEmail()
          .normalizeEmail()
          .withMessage("Invalid email address"),
        body("password")
          .notEmpty()
          .withMessage("Password is required"),
      ];
    default:
      return [];
  }
};

// Consistent error response helper
const sendError = (res, status, message, details = null) => {
  const response = { error: { message } };
  if (details) response.error.details = details;
  return res.status(status).json(response);
};

// Signup route
router.post("/signup", validateAuth("signup"), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error("Signup validation failed", {
      errors: errors.array(),
      body: req.body,
    });
    return sendError(res, 400, "Validation failed", errors.array());
  }

  const { name, email, password } = req.body;
  try {
    // Check if email already exists
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return sendError(res, 400, "Email already exists");
    }

    // Create new user
    const user = new User({ name, email, password, role: "user" });
    await user.save();

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Set JWT in HttpOnly cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    logger.error("Signup error", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    sendError(res, 500, "Server error");
  }
});

// Login route
router.post("/login", validateAuth("login"), async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    logger.error("Login validation failed", {
      errors: errors.array(),
      body: req.body,
    });
    return sendError(res, 400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;
  try {
    // Find user and include password
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return sendError(res, 400, "Invalid credentials");
    }

    // Verify password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 400, "Invalid credentials");
    }

    // Generate JWT
    const token = jwt.sign(
      { id: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "1d" }
    );

    // Set JWT in HttpOnly cookie
    res.cookie("authToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 24 * 60 * 60 * 1000, // 1 day
    });

    res.json({ message: "Login successful" });
  } catch (error) {
    logger.error("Login error", {
      error: error.message,
      stack: error.stack,
      body: req.body,
    });
    sendError(res, 500, "Server error");
  }
});

module.exports = router;