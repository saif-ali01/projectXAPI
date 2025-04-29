const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");

router.post("/auth/signup", signup);
router.post("/auth/login", login);
router.post("/auth/reset-password", requestPasswordReset);
router.post("/auth/reset-password/confirm", resetPassword);

module.exports = router;