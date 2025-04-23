const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const mongoose = require("mongoose");

// Generate serial number
const getNextSerialNumber = async () => {
  const lastBill = await Bill.findOne().sort({ serialNumber: -1 });
  return lastBill ? lastBill.serialNumber + 1 : 1;
};

// Create bill
router.post("/", async (req, res) => {
  try {
    const { partyName, rows, due = 0, advance = 0, previousBalance = 0, status = "pending", note = "" } = req.body;
    const total = rows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    const balance = total + previousBalance - advance;
    const serialNumber = await getNextSerialNumber();

    const bill = new Bill({
      serialNumber,
      partyName,
      rows: rows.map(row => ({
        ...row,
        id: Number(row.id) || 1,
        particulars: row.particulars || "",
        type: row.type || "",
        size: row.size || "",
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        total: Number(row.total) || 0
      })),
      total,
      due: status.toLowerCase() === "paid" ? 0 : due,
      advance,
      balance: status.toLowerCase() === "paid" ? 0 : balance,
      previousBalance,
      status: status.toLowerCase(),
      note
    });

    const savedBill = await bill.save();
    res.status(201).json(savedBill);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get all bills
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = "newest", search = "" } = req.query;

    const query = {};
    if (search) {
      query.partyName = { $regex: search, $options: "i" };
    }

    const sortOptions = {
      newest: { date: -1 },
      oldest: { date: 1 },
      "highest-amount": { total: -1 },
      "lowest-amount": { total: 1 }
    };

    const bills = await Bill.find(query)
      .sort(sortOptions[sortBy] || { date: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .lean();

    const count = await Bill.countDocuments(query);

    res.json({
      bills: bills.map(bill => ({
        ...bill,
        date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : ""
      })),
      totalPages: Math.ceil(count / limit),
      currentPage: page
    });
  } catch (error) {
    console.error("Error in GET /api/bills:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get a bill by ID
router.get("/id/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({
        message: "Invalid ID format",
        receivedId: req.params.id,
        expectedFormat: "MongoDB ObjectId"
      });
    }

    const bill = await Bill.findById(req.params.id)
      .orFail(new Error("Bill not found"));

    if (!bill) {
      console.error("Bill not found in database:", req.params.id);
      return res.status(404).json({ message: "Bill not found" });
    }

    const response = {
      ...bill.toObject(),
      createdAt: undefined,
      updatedAt: undefined,
      __v: undefined
    };

    res.json(response);
  } catch (error) {
    console.error("Error Details:", {
      params: req.params,
      error: error.message,
      stack: error.stack
    });

    const statusCode = error.message.includes("not found") ? 404 : 500;
    res.status(statusCode).json({
      message: error.message,
      errorType: error.name,
      ...(process.env.NODE_ENV === 'development' && { stack: error.stack })
    });
  }
});

// Get the latest bill by party name (exact match)
router.get("/party/:partyName", async (req, res) => {
  try {
    const partyName = req.params.partyName.trim();
    if (!partyName) {
      return res.status(400).json({ message: "Party name is required" });
    }
    const bill = await Bill.findOne({ partyName })
      .sort({ date: -1 })
      .lean();
    if (!bill) {
      return res.status(404).json({ message: "No bill found for this party" });
    }
    res.json({
      ...bill,
      date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : "",
    });
  } catch (error) {
    console.error("Error fetching latest bill by party:", error);
    res.status(500).json({ message: error.message });
  }
});

// Get a bill by serial number
router.get("/serial/:serialNumber", async (req, res) => {
  try {
    const bill = await Bill.findOne({ serialNumber: req.params.serialNumber });
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json(bill);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update a bill
router.put("/id/:id", async (req, res) => {
  try {
    const { partyName, rows, advance, status, note } = req.body;
    const total = rows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    const isPaid = status.toLowerCase() === "paid";
    const numericAdvance = isPaid ? 0 : Number(advance || 0);
    const balance = isPaid ? 0 : total - numericAdvance;

    const updateData = {
      partyName,
      rows: rows.map(row => ({
        ...row,
        id: Number(row.id) || 1,
        particulars: row.particulars || "",
        type: row.type || "",
        size: row.size || "",
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        total: Number(row.total) || 0
      })),
      total,
      status: status.toLowerCase(),
      advance: numericAdvance,
      due: balance,
      balance,
      note
    };

    const bill = await Bill.findByIdAndUpdate(
      req.params.id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    if (!bill) return res.status(404).json({ message: "Bill not found" });

    res.json({
      ...bill.toObject(),
      status: bill.status,
      advance: bill.advance,
      due: bill.due,
      balance: bill.balance,
      note: bill.note
    });
  } catch (error) {
    res.status(400).json({
      message: error.message,
      ...(error.errors && { details: error.errors })
    });
  }
});

// Delete a bill
router.delete("/id/:id", async (req, res) => {
  try {
    const bill = await Bill.findByIdAndDelete(req.params.id);
    if (!bill) return res.status(404).json({ message: "Bill not found" });
    res.json({ message: "Bill deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get bill statistics for chart
router.get("/stats", async (req, res) => {
  try {
    const { startDate, endDate, timeFrame = "daily" } = req.query;
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate ? new Date(startDate) : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    let groupFormat;
    if (timeFrame === "monthly") groupFormat = "%Y-%m";
    else if (timeFrame === "yearly") groupFormat = "%Y";
    else groupFormat = "%Y-%m-%d";

    const stats = await Bill.aggregate([
      { $match: { status: "paid", date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$date" } },
          totalRevenue: { $sum: "$total" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Fill missing periods
    const dateRange = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr = groupFormat === "%Y-%m-%d" ? currentDate.toISOString().split("T")[0] :
                      groupFormat === "%Y-%m" ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}` :
                      `${currentDate.getFullYear()}`;
      const found = stats.find(stat => stat._id === dateStr);
      dateRange.push({
        date: dateStr,
        totalRevenue: found ? found.totalRevenue : 0
      });
      if (timeFrame === "yearly") currentDate.setFullYear(currentDate.getFullYear() + 1);
      else if (timeFrame === "monthly") currentDate.setMonth(currentDate.getMonth() + 1);
      else currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(dateRange);
  } catch (error) {
    console.error("Error fetching bill stats:", error);
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;