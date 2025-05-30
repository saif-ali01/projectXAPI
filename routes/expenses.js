const express = require("express");
const router = express.Router();
const Expense = require("../models/Expense");
const Earnings = require("../models/Earning");
const moment = require("moment-timezone");

// Get expense summary
router.get("/summary", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { type: { $in: ["Personal", "Professional"] } };
    if (startDate && endDate) {
      match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    } else {
      // Default to current month
      const now = moment().tz("Asia/Kolkata");
      match.date = {
        $gte: now.clone().startOf("month").toDate(),
        $lte: now.clone().endOf("month").toDate(),
      };
    }

    // Fetch expenses summary
    const summary = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$type",
          total: { $sum: "$amount" },
        },
      },
    ]);

    const totalPersonal = summary.find((s) => s._id === "Personal")?.total || 0;
    const totalProfessional = summary.find((s) => s._id === "Professional")?.total || 0;

    // Fetch monthly budget for budget used calculation
    const budgetResponse = await Earnings.find({
      source: "Work",
      date: { $gte: match.date.$gte, $lte: match.date.$lte },
    });
    const totalEarnings = budgetResponse.reduce((sum, e) => sum + e.amount, 0);
    const totalExpenses = totalPersonal + totalProfessional;
    const monthlyBudget = totalEarnings - totalExpenses;
    const budgetUsed = totalEarnings > 0 ? (totalExpenses / totalEarnings) * 100 : 0;

    // Fetch highest category
    const highestCategory = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          total: { $sum: "$amount" },
        },
      },
      { $sort: { total: -1 } },
      { $limit: 1 },
    ]);

    res.json([
      {
        title: "Total Personal",
        value: `₹${totalPersonal.toLocaleString("en-IN")}`,
        icon: "💰",
      },
      {
        title: "Total Professional",
        value: `₹${totalProfessional.toLocaleString("en-IN")}`,
        icon: "📊",
      },
      {
        title: "Budget Used",
        value: `${budgetUsed.toFixed(0)}%`,
        icon: "📈",
      },
      {
        title: "Highest Category",
        value: highestCategory[0]?._id || "None",
        icon: "🧭",
      },
    ]);
  } catch (error) {
    console.error("Error fetching expense summary:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get expense over time
router.get("/over-time", async (req, res) => {
  try {
    const { startDate, endDate, timeFrame = "monthly" } = req.query;
    const match = { type: { $in: ["Personal", "Professional"] } };
    if (startDate && endDate) {
      match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    let groupFormat =
      timeFrame === "daily" ? "%Y-%m-%d" : timeFrame === "yearly" ? "%Y" : "%Y-%m";
    let dateKey =
      timeFrame === "daily" ? "date" : timeFrame === "yearly" ? "year" : "month";

    const data = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: {
            [dateKey]: { $dateToString: { format: groupFormat, date: "$date" } },
            type: "$type",
          },
          total: { $sum: "$amount" },
        },
      },
      {
        $group: {
          _id: `$_id.${dateKey}`,
          expenses: {
            $push: {
              type: "$_id.type",
              total: "$total",
            },
          },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const result = data.map((item) => ({
      [dateKey]: item._id,
      personal: item.expenses.find((e) => e.type === "Personal")?.total || 0,
      professional: item.expenses.find((e) => e.type === "Professional")?.total || 0,
    }));

    res.json(result);
  } catch (error) {
    console.error("Error fetching expense over time:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get expense by category
router.get("/categories", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const match = { type: { $in: ["Personal", "Professional"] } };
    if (startDate && endDate) {
      match.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const categories = await Expense.aggregate([
      { $match: match },
      {
        $group: {
          _id: "$category",
          value: { $sum: "$amount" },
        },
      },
      {
        $project: {
          name: "$_id",
          value: 1,
          _id: 0,
        },
      },
      { $sort: { value: -1 } },
    ]);

    res.json(categories);
  } catch (error) {
    console.error("Error fetching expense categories:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get recent transactions
router.get("/transactions", async (req, res) => {
  try {
    const { startDate, endDate, sortBy = "date", order = "desc", category, type } = req.query;
    const query = {};
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }
    if (category) query.category = category;
    if (type) query.type = type;

    const sortOptions = {};
    sortOptions[sortBy] = order === "desc" ? -1 : 1;

    const transactions = await Expense.find(query)
      .sort(sortOptions)
      .limit(10)
      .lean();

    res.json(
      transactions.map((tx) => ({
        id: tx._id,
        date: tx.date,
        description: tx.description,
        category: tx.category,
        amount: tx.amount,
        type: tx.type,
      }))
    );
  } catch (error) {
    console.error("Error fetching transactions:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get earnings
router.get("/earnings", async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const query = { source: "Work" }; // Filter by Work source
    if (startDate && endDate) {
      query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
    }

    const earnings = await Earnings.find(query).lean();

    res.json(
      earnings.map((e) => ({
        id: e._id,
        date: e.date,
        amount: e.amount,
        type: e.type,
        source: e.source,
        reference: e.reference,
      }))
    );
  } catch (error) {
    console.error("Error fetching earnings:", error);
    res.status(500).json({ message: error.message });
  }
});

// Create expense
router.post("/", async (req, res) => {
  try {
    const { date, description, category, amount, type } = req.body;
    if (!date || !description || !category || !amount || !type) {
      return res.status(400).json({ message: "All fields are required" });
    }
    const parsedDate = new Date(date);
    if (isNaN(parsedDate)) {
      return res.status(400).json({ message: "Invalid date format" });
    }
    if (isNaN(amount) || amount <= 0) {
      return res.status(400).json({ message: "Amount must be a positive number" });
    }
    if (!["Personal", "Professional"].includes(type)) {
      return res.status(400).json({ message: "Invalid type" });
    }
    if (!["Food", "Travel", "Equipment", "Other"].includes(category)) {
      return res.status(400).json({ message: "Invalid category" });
    }
    const expense = new Expense({
      date: parsedDate,
      description,
      category,
      amount,
      type,
      createdBy: null, // Replace with req.user._id if authenticated
    });
    const savedExpense = await expense.save();
    res.status(201).json(savedExpense);
  } catch (error) {
    console.error("Error creating expense:", error);
    res.status(400).json({ message: error.message });
  }
});

// Update expense
router.put("/:id", async (req, res) => {
  try {
    const { date, description, category, amount, type } = req.body;
    const expense = await Expense.findByIdAndUpdate(
      req.params.id,
      {
        date: new Date(date),
        description,
        category,
        amount,
        type,
        createdBy: null, // Replace with req.user._id if authenticated
      },
      { new: true, runValidators: true }
    );
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json(expense);
  } catch (error) {
    console.error("Error updating expense:", error);
    res.status(400).json({ message: error.message });
  }
});

// Delete expense
router.delete("/:id", async (req, res) => {
  try {
    const expense = await Expense.findByIdAndDelete(req.params.id);
    if (!expense) {
      return res.status(404).json({ message: "Expense not found" });
    }
    res.json({ message: "Expense deleted" });
  } catch (error) {
    console.error("Error deleting expense:", error);
    res.status(500).json({ message: error.message });
  }
});

// Create earnings (for testing)
router.post("/earnings", async (req, res) => {
  try {
    const { date, amount, type, source, reference } = req.body;
    if (!date || !amount || !type || !source) {
      return res.status(400).json({ message: "Date, amount, type, and source are required" });
    }
    const earnings = new Earnings({
      date: new Date(date),
      amount,
      type,
      source,
      reference,
      createdBy: null, // Replace with req.user._id if authenticated
    });
    const savedEarnings = await earnings.save();
    res.status(201).json(savedEarnings);
  } catch (error) {
    console.error("Error creating earnings:", error);
    res.status(400).json({ message: error.message });
  }
});

module.exports = router;