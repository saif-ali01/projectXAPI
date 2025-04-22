const express = require("express");
const router = express.Router();
const {
  signup,
  login,
  requestPasswordReset,
  resetPassword,
} = require("../controllers/authController");

router.post("/signup", signup);
router.post("/login", login);
router.post("/reset-password", requestPasswordReset);
router.post("/reset-password/confirm", resetPassword);

module.exports = router;