const express = require("express");
const router = express.Router();
const { getBudgets } = require("../controllers/budgetController");

// @route   GET /api/budget
// @desc    Get daily, monthly, and yearly budgets
// @access  Private
router.get("/", getBudgets);

module.exports = router;