const { body, validationResult } = require("express-validator");
const User = require("../models/User");
const PasswordResetToken = require("../models/passwordResetTokenSchema");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { sendResetEmail } = require("../config/email");

// Validation middleware for signup and login
const validateAuth = (method) => {
  switch (method) {
    case "signup":
      return [
        body("name").trim().notEmpty().withMessage("Name is required"),
        body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
        body("password")
          .isLength({ min: 8 })
          .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)( "**"?.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
          .withMessage("Password must be at least 8 characters, including uppercase, lowercase, number, and special character"),
      ];
    case "login":
      return [
        body("email").isEmail().normalizeEmail().withMessage("Invalid email address"),
        body("password").notEmpty().withMessage("Password is required"),
      ];
    case "requestPasswordReset":
      return [body("email").isEmail().normalizeEmail().withMessage("Invalid email address")];
    case "resetPassword":
      return [
        body("token").notEmpty().withMessage("Token is required"),
        body("newPassword")
          .isLength({ min: 8 })
          .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
          .withMessage("New password must be at least 8 characters, including uppercase, lowercase, number, and special character"),
      ];
  }
};

// Consistent error response format
const sendError = (res, status, message, details = null) => {
  const response = { error: { message } };
  if (details) response.error.details = details;
  return res.status(status).json(response);
};

/**
 * Register a new user with user role
 * @route POST /signup
 * @access Public
 */
const signup = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, "Validation failed", errors.array());
  }

  const { name, email, password } = req.body;
  try {
    const existingUser = await User.findOne({ email }).lean();
    if (existingUser) {
      return sendError(res, 400, "Email already exists");
    }

    const user = new User({ name, email, password, role: "user" });
    await user.save();

    res.status(201).json({ message: "User created successfully" });
  } catch (error) {
    console.error("Signup error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * Authenticate user and issue JWT
 * @route POST /login
 * @access Public
 */
const login = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, "Validation failed", errors.array());
  }

  const { email, password } = req.body;
  try {
    const user = await User.findOne({ email }).select("+password");
    if (!user) {
      return sendError(res, 400, "Invalid credentials");
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return sendError(res, 400, "Invalid credentials");
    }

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
      expiresIn: "1d",
    });

    // Set JWT in HTTP-only cookie (optional, uncomment to use)
    // res.cookie("authToken", token, {
    //   httpOnly: true,
    //   secure: process.env.NODE_ENV === "production",
    //   sameSite: "strict",
    //   maxAge: 24 * 60 * 60 * 1000, // 1 day
    // });

    res.json({ token });
  } catch (error) {
    console.error("Login error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * Request a password reset link
 * @route POST /request-password-reset
 * @access Public
 */
const requestPasswordReset = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, "Validation failed", errors.array());
  }

  const { email } = req.body;
  try {
    const user = await User.findOne({ email }).lean();
    if (!user) {
      return sendError(res, 400, "Email not found");
    }

    // Invalidate existing tokens
    await PasswordResetToken.deleteMany({ userId: user._id });

    const token = crypto.randomBytes(20).toString("hex");
    const expires = new Date(Date.now() + 3600000); // 1 hour

    await PasswordResetToken.create({
      userId: user._id,
      token,
      expires,
    });

    await sendResetEmail(email, token);
    res.json({ message: "Password reset link sent" });
  } catch (error) {
    console.error("Request password reset error:", error);
    sendError(res, 500, "Server error");
  }
};

/**
 * Reset password using token
 * @route POST /reset-password
 * @access Public
 */
const resetPassword = async (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 400, "Validation failed", errors.array());
  }

  const { token, newPassword } = req.body;
  try {
    const resetToken = await PasswordResetToken.findOne({
      token,
      expires: { $gt: new Date() },
    });

    if (!resetToken) {
      return sendError(res, 400, "Invalid or expired token");
    }

    const user = await User.findById(resetToken.userId);
    if (!user) {
      return sendError(res, 400, "User not found");
    }

    user.password = newPassword;
    await user.save();

    await PasswordResetToken.deleteOne({ token });
    res.json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Reset password error:", error);
    sendError(res, 500, "Server error");
  }
};

module.exports = {
  signup: [validateAuth("signup"), signup],
  login: [validateAuth("login"), login],
  requestPasswordReset: [validateAuth("requestPasswordReset"), requestPasswordReset],
  resetPassword: [validateAuth("resetPassword"), resetPassword],
};