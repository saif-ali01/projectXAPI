// routes/dashboard.js - Fixed Version
const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const Expense = require("../models/Expense");
const Earnings = require("../models/Earnings");
const Party = require("../models/Party");

// Improved error handling middleware
const handleError = (res, error, context) => {
  console.error(`Error in ${context}:`, error);
  res.status(500).json({ 
    message: "Server error",
    error: process.env.NODE_ENV === "development" ? error.message : undefined
  });
};

// Get dashboard summary metrics
router.get("/summary", async (req, res) => {
  try {
    const match = {};
    if (req.query.userId) match.createdBy = req.query.userId;

    // Validate models have required fields
    const requiredFields = {
      Earnings: ["amount", "createdBy"],
      Expense: ["amount", "createdBy"],
      Bill: ["status", "partyName", "createdBy"]
    };

    // Check if models have required fields
    for (const [modelName, fields] of Object.entries(requiredFields)) {
      const model = { Earnings, Expense, Bill }[modelName];
      const instance = new model();
      fields.forEach(field => {
        if (!(field in instance)) throw new Error(`${modelName} model missing required field: ${field}`);
      });
    }

    // Parallelize database calls
    const [totalRevenue, totalExpenses, pendingInvoices, activeClients] = await Promise.all([
      Earnings.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Expense.aggregate([
        { $match: match },
        { $group: { _id: null, total: { $sum: "$amount" } } }
      ]),
      Bill.countDocuments({ ...match, status: { $in: ["pending", "due"] } }),
      Bill.aggregate([
        { $match: match },
        { $group: { _id: "$partyName" } },
        { $count: "activeClients" }
      ])
    ]);

    res.json({
      totalRevenue: totalRevenue[0]?.total || 0,
      totalExpenses: totalExpenses[0]?.total || 0,
      pendingInvoices: pendingInvoices || 0,
      activeClients: activeClients[0]?.activeClients || 0
    });
  } catch (error) {
    handleError(res, error, "dashboard summary");
  }
});

// Get revenue trend (monthly revenue for last 6 months)
router.get("/revenue-trend", async (req, res) => {
  try {
    const match = {};
    if (req.query.userId) match.createdBy = req.query.userId;

    // Validate date field exists in Earnings
    if (!Earnings.schema.paths.date) {
      throw new Error("Earnings model missing date field");
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const revenueData = await Earnings.aggregate([
      {
        $match: {
          ...match,
          date: { $gte: sixMonthsAgo, $lte: new Date() }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" }
          },
          revenue: { $sum: "$amount" }
        }
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } }
    ]);

    // Generate default months array with zero values
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return {
        month: date.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        revenue: 0
      };
    });

    // Merge actual data into default array
    revenueData.forEach(entry => {
      const date = new Date(entry._id.year, entry._id.month - 1);
      const monthStr = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const target = months.find(m => m.month === monthStr);
      if (target) target.revenue = entry.revenue;
    });

    res.json(months);
  } catch (error) {
    handleError(res, error, "revenue trend");
  }
});

module.exports = router;