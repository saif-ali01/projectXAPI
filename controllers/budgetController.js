const Earnings = require("../models/Earning");
const Expense = require("../models/Expense");
const asyncHandler = require("express-async-handler");
const moment = require("moment-timezone");

// @desc    Get daily, monthly, and yearly budgets
// @route   GET /api/budget
// @access  Private
const getBudgets = asyncHandler(async (req, res) => {
  const { date = moment().tz("Asia/Kolkata").format("YYYY-MM-DD") } = req.query;
  const userId = req.user?._id; // From auth middleware

  if (!userId) {
    res.status(401);
    throw new Error("User not authenticated");
  }

  // Parse the input date
  const targetDate = moment.tz(date, "Asia/Kolkata");

  // Define time ranges
  const dailyStart = targetDate.clone().startOf("day").toDate();
  const dailyEnd = targetDate.clone().endOf("day").toDate();
  const monthlyStart = targetDate.clone().startOf("month").toDate();
  const monthlyEnd = targetDate.clone().endOf("month").toDate();
  const yearlyStart = targetDate.clone().startOf("year").toDate();
  const yearlyEnd = targetDate.clone().endOf("year").toDate();

  // Fetch earnings for each period (source: "Work", createdBy: userId)
  const [dailyEarnings, monthlyEarnings, yearlyEarnings] = await Promise.all([
    Earnings.find({
      source: "Work",
      createdBy: userId,
      date: { $gte: dailyStart, $lte: dailyEnd },
    }),
    Earnings.find({
      source: "Work",
      createdBy: userId,
      date: { $gte: monthlyStart, $lte: monthlyEnd },
    }),
    Earnings.find({
      source: "Work",
      createdBy: userId,
      date: { $gte: yearlyStart, $lte: yearlyEnd },
    }),
  ]);

  // Fetch expenses for each period (createdBy: userId)
  const [dailyExpenses, monthlyExpenses, yearlyExpenses] = await Promise.all([
    Expense.find({
      createdBy: userId,
      date: { $gte: dailyStart, $lte: dailyEnd },
    }),
    Expense.find({
      createdBy: userId,
      date: { $gte: monthlyStart, $lte: monthlyEnd },
    }),
    Expense.find({
      createdBy: userId,
      date: { $gte: yearlyStart, $lte: yearlyEnd },
    }),
  ]);

  // Calculate totals
  const dailyTotalEarnings = dailyEarnings.reduce(
    (sum, earning) => sum + earning.amount,
    0
  );
  const monthlyTotalEarnings = monthlyEarnings.reduce(
    (sum, earning) => sum + earning.amount,
    0
  );
  const yearlyTotalEarnings = yearlyEarnings.reduce(
    (sum, earning) => sum + earning.amount,
    0
  );

  const dailyTotalExpenses = dailyExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const monthlyTotalExpenses = monthlyExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );
  const yearlyTotalExpenses = yearlyExpenses.reduce(
    (sum, expense) => sum + expense.amount,
    0
  );

  // Calculate budgets
  const dailyBudget = dailyTotalEarnings - dailyTotalExpenses;
  const monthlyBudget = monthlyTotalEarnings - monthlyTotalExpenses;
  const yearlyBudget = yearlyTotalEarnings - yearlyTotalExpenses;

  res.json({
    success: true,
    data: {
      daily: {
        date: targetDate.format("YYYY-MM-DD"),
        totalEarnings: dailyTotalEarnings,
        totalExpenses: dailyTotalExpenses,
        budget: dailyBudget,
      },
      monthly: {
        month: targetDate.format("MMMM YYYY"),
        totalEarnings: monthlyTotalEarnings,
        totalExpenses: monthlyTotalExpenses,
        budget: monthlyBudget,
      },
      yearly: {
        year: targetDate.format("YYYY"),
        totalEarnings: yearlyTotalEarnings,
        totalExpenses: yearlyTotalExpenses,
        budget: yearlyBudget,
      },
    },
  });
});

module.exports = { getBudgets };