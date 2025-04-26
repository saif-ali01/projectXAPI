const express = require("express");
const router = express.Router();
const mongoose = require("mongoose");
const Bill = require("../models/Bill");
const Expense = require("../models/Expense");
const Earnings = require("../models/Earning");
const Party = require("../models/Party");

// Error handling middleware
const handleError = (res, error, context, req) => {
  console.error(`Error in ${context}:`, {
    message: error.message,
    stack: error.stack,
    name: error.name,
    request: {
      method: req.method,
      url: req.originalUrl,
      query: req.query,
      headers: req.headers,
    },
  });
  res.status(500).json({
    message: "Server error",
    error:
      process.env.NODE_ENV === "development"
        ? { message: error.message, stack: error.stack, name: error.name }
        : undefined,
  });
};

// Get dashboard summary metrics
router.get("/summary", async (req, res) => {
  try {
    console.log("Processing /dashboard/summary", { query: req.query });
    const match = {};
    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) {
        return res.status(400).json({ message: "Invalid userId format" });
      }
      match.createdBy = req.query.userId;
    }

    // Validate models have required fields
    const requiredFields = {
      Earnings: ["amount", "createdBy"],
      Expense: ["amount", "createdBy"],
      Bill: ["status", "partyName", "createdBy"],
    };

    for (const [modelName, fields] of Object.entries(requiredFields)) {
      const model = { Earnings, Expense, Bill }[modelName];
      const instance = new model();
      fields.forEach((field) => {
        if (!(field in instance)) {
          throw new Error(`${modelName} model missing required field: ${field}`);
        }
      });
    }

    // Check if collections exist
    const collections = await mongoose.connection.db.listCollections().toArray();
    const collectionNames = collections.map((c) => c.name);
    const requiredCollections = ["earnings", "expenses", "bills"];
    for (const coll of requiredCollections) {
      if (!collectionNames.includes(coll)) {
        console.warn(`Collection ${coll} does not exist`);
      }
    }

    // Parallelize database calls
    const [totalRevenue, totalExpenses, pendingInvoices, activeClients] = await Promise.all([
      Earnings.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]).catch(
        (err) => {
          console.error("Earnings aggregation error:", err);
          return [{ total: 0 }];
        }
      ),
      Expense.aggregate([{ $match: match }, { $group: { _id: null, total: { $sum: "$amount" } } }]).catch(
        (err) => {
          console.error("Expense aggregation error:", err);
          return [{ total: 0 }];
        }
      ),
      Bill.countDocuments({ ...match, status: { $in: ["pending", "due"] } }).catch((err) => {
        console.error("Bill count error:", err);
        return 0;
      }),
      Bill.aggregate([{ $match: match }, { $group: { _id: "$partyName" } }, { $count: "activeClients" }]).catch(
        (err) => {
          console.error("Active clients aggregation error:", err);
          return [{ activeClients: 0 }];
        }
      ),
    ]);

    const response = {
      totalRevenue: totalRevenue[0]?.total || 0,
      totalExpenses: totalExpenses[0]?.total || 0,
      pendingInvoices: pendingInvoices || 0,
      activeClients: activeClients[0]?.activeClients || 0,
    };
    console.log("Dashboard summary response:", response);
    res.json(response);
  } catch (error) {
    handleError(res, error, "dashboard summary", req);
  }
});

// Get revenue trend (monthly revenue for last 6 months)
router.get("/revenue-trend", async (req, res) => {
  try {
    console.log("Processing /dashboard/revenue-trend", { query: req.query });
    const match = {};
    if (req.query.userId) {
      if (!mongoose.isValidObjectId(req.query.userId)) {
        return res.status(400).json({ message: "Invalid userId format" });
      }
      match.createdBy = req.query.userId;
    }

    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

    const revenueData = await Earnings.aggregate([
      {
        $match: {
          ...match,
          date: { $gte: sixMonthsAgo, $lte: new Date() },
        },
      },
      {
        $group: {
          _id: {
            year: { $year: "$date" },
            month: { $month: "$date" },
          },
          revenue: { $sum: "$amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]).catch((err) => {
      console.error("Revenue trend aggregation error:", err);
      return [];
    });

    // Generate default months array
    const months = Array.from({ length: 6 }, (_, i) => {
      const date = new Date();
      date.setMonth(date.getMonth() - (5 - i));
      return {
        month: date.toLocaleString("en-US", { month: "short", year: "2-digit" }),
        revenue: 0,
      };
    });

    // Merge actual data
    revenueData.forEach((entry) => {
      const date = new Date(entry._id.year, entry._id.month - 1);
      const monthStr = date.toLocaleString("en-US", { month: "short", year: "2-digit" });
      const target = months.find((m) => m.month === monthStr);
      if (target) target.revenue = entry.revenue;
    });

    console.log("Revenue trend response:", months);
    res.json(months);
  } catch (error) {
    handleError(res, error, "revenue trend", req);
  }
});

module.exports = router;