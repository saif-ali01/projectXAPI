const express = require("express");
const router = express.Router();
const Bill = require("../models/Bill");
const Earnings = require("../models/Earning");
const mongoose = require("mongoose");

// Utility to escape regex characters
const escapeRegex = (text) => {
  return text.replace(/[-[\]{}()*+?.,\\^$|#\s]/g, "\\$&");
};

// Generate serial number
const getNextSerialNumber = async () => {
  const lastBill = await Bill.findOne().sort({ serialNumber: -1 }).lean();
  return lastBill ? lastBill.serialNumber + 1 : 1;
};

// Create bill
router.post("/", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const {
      partyName,
      rows,
      due = 0,
      advance = 0,
      previousBalance = 0,
      status = "pending",
      note = "",
    } = req.body;

    if (!partyName?.trim()) {
      return res.status(400).json({ message: "Party name is required" });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "At least one row is required" });
    }

    const normalizedPartyName = partyName.trim().toLowerCase();
    const total = rows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    const isPaid = status.toLowerCase() === "paid";
    const balance = isPaid ? 0 : total + Number(previousBalance) - Number(advance);
    const serialNumber = await getNextSerialNumber();

    const bill = new Bill({
      serialNumber,
      partyName: normalizedPartyName,
      rows: rows.map((row) => ({
        id: Number(row.id) || 1,
        particulars: row.particulars?.trim() || "",
        type: row.type || "",
        size: row.size || "",
        customType: row.customType?.trim() || "",
        customSize: row.customSize?.trim() || "",
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        total: Number(row.total) || 0,
      })),
      total,
      due: isPaid ? 0 : Number(due),
      advance: Number(advance),
      balance,
      previousBalance: Number(previousBalance),
      status: status.toLowerCase(),
      note: note?.trim() || "",
    });

    const savedBill = await bill.save({ session });

    // If bill is created as paid, add to earnings
    if (isPaid) {
      const earning = new Earnings({
        date: new Date(),
        amount: savedBill.total,
        type: "Sales",
        source: `Bill #${savedBill.serialNumber}`,
        reference: savedBill._id,
      });
      await earning.save({ session });
    }

    await session.commitTransaction();
    res.status(201).json(savedBill);
  } catch (error) {
    await session.abortTransaction();
    console.error("Error creating bill:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      res.status(400).json({ message: "Validation failed", errors });
    } else {
      res.status(400).json({ message: error.message });
    }
  } finally {
    session.endSession();
  }
});

// Get all bills
router.get("/", async (req, res) => {
  try {
    const { page = 1, limit = 10, sortBy = "newest", search = "" } = req.query;
    const query = search.trim()
      ? { partyName: { $regex: escapeRegex(search), $options: "i" } }
      : {};

    const sortOptions = {
      newest: { date: -1 },
      oldest: { date: 1 },
      "highest-amount": { total: -1 },
      "lowest-amount": { total: 1 },
    };

    const bills = await Bill.find(query)
      .sort(sortOptions[sortBy] || { date: -1 })
      .limit(Number(limit))
      .skip((Number(page) - 1) * Number(limit))
      .lean();

    const count = await Bill.countDocuments(query);

    res.json({
      bills: bills.map((bill) => ({
        ...bill,
        date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : "",
      })),
      totalPages: Math.ceil(count / Number(limit)),
      currentPage: Number(page),
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({ message: "Failed to fetch bills", error: error.message });
  }
});

// Get a bill by ID
router.get("/id/:id", async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }

    const bill = await Bill.findById(req.params.id).lean();
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    res.json({
      ...bill,
      date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : "",
    });
  } catch (error) {
    console.error("Error fetching bill by ID:", error);
    res.status(500).json({ message: "Failed to fetch bill", error: error.message });
  }
});

// Get cumulative balance and latest bill by party name
router.get("/party/:partyName", async (req, res) => {
  try {
    const partyName = req.params.partyName?.trim();
    const { exact = "false" } = req.query;
    if (!partyName) {
      return res.status(400).json({ message: "Party name is required" });
    }

    const normalizedPartyName = partyName.toLowerCase();
    const escapedName = escapeRegex(normalizedPartyName);
    const regexPattern = exact === "true" ? `^${escapedName}$` : escapedName;
    const bills = await Bill.find({
      partyName: { $regex: regexPattern, $options: "i" },
    })
      .sort({ date: -1 })
      .lean();

    if (!bills.length) {
      return res.status(404).json({
        message: `No bills found for party "${partyName}"`,
        partyName,
        balance: 0,
        matchedPartyNames: [],
      });
    }

    const balanceAggregation = await Bill.aggregate([
      {
        $match: {
          partyName: { $regex: regexPattern, $options: "i" },
          status: { $ne: "paid" },
        },
      },
      {
        $group: {
          _id: null,
          totalBalance: { $sum: "$balance" },
        },
      },
    ]);

    const totalBalance = balanceAggregation[0]?.totalBalance || 0;
    const latestBill = bills[0];
    const matchedPartyNames = [...new Set(bills.map((bill) => bill.partyName))];

    res.json({
      ...latestBill,
      date: latestBill.date ? new Date(latestBill.date).toISOString().split("T")[0] : "",
      balance: totalBalance,
      matchedPartyNames,
    });
  } catch (error) {
    console.error(`Error fetching bills for party "${req.params.partyName}":`, error);
    res.status(500).json({
      message: `Failed to fetch bills for party "${req.params.partyName}"`,
      error: error.message,
    });
  }
});

// Get a bill by serial number
router.get("/serial/:serialNumber", async (req, res) => {
  try {
    const serialNumber = Number(req.params.serialNumber);
    if (isNaN(serialNumber)) {
      return res.status(400).json({ message: "Invalid serial number" });
    }

    const bill = await Bill.findOne({ serialNumber }).lean();
    if (!bill) {
      return res.status(404).json({ message: "Bill not found" });
    }

    res.json({
      ...bill,
      date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : "",
    });
  } catch (error) {
    console.error("Error fetching bill by serial:", error);
    res.status(500).json({ message: "Failed to fetch bill", error: error.message });
  }
});

// Update a bill
router.put("/id/:id", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    console.log("PUT /bills/id/:id - Request body:", req.body); // Log payload for debugging
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }

    // Get previous bill state
    const previousBill = await Bill.findById(req.params.id).session(session);
    if (!previousBill) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Bill not found" });
    }
    const wasPaid = previousBill.status === "paid";

    const {
      partyName,
      rows,
      advance = 0,
      status = "pending",
      note = "",
      due = 0,
      previousBalance = 0,
    } = req.body;

    if (!partyName?.trim()) {
      return res.status(400).json({ message: "Party name is required" });
    }

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return res.status(400).json({ message: "At least one row is required" });
    }

    const normalizedPartyName = partyName.trim().toLowerCase();
    const total = rows.reduce((acc, row) => acc + (Number(row.total) || 0), 0);
    const isPaid = status.toLowerCase() === "paid";
    const balance = isPaid ? 0 : total + Number(previousBalance) - Number(advance);

    const updateData = {
      partyName: normalizedPartyName,
      rows: rows.map((row) => ({
        id: Number(row.id) || 1,
        particulars: row.particulars?.trim() || "",
        type: row.type || "",
        size: row.size || "",
        customType: row.customType?.trim() || "",
        customSize: row.customSize?.trim() || "",
        quantity: Number(row.quantity) || 0,
        rate: Number(row.rate) || 0,
        total: Number(row.total) || 0,
      })),
      total,
      advance: Number(advance),
      balance,
      due: isPaid ? 0 : Number(due),
      previousBalance: Number(previousBalance),
      status: status.toLowerCase(),
      note: note?.trim() || "",
    };

    const bill = await Bill.findByIdAndUpdate(req.params.id, updateData, {
      new: true,
      session,
      runValidators: true,
    });

    // Handle earnings
    if (!wasPaid && isPaid) {
      // Create new earnings entry if bill is newly marked as paid
      const earning = new Earnings({
        date: new Date(),
        amount: bill.total,
        type: "Sales",
        source: `Bill #${bill.serialNumber}`,
        reference: bill._id,
      });
      await earning.save({ session });
    } else if (wasPaid && !isPaid) {
      // Remove earnings entry if bill is changed from paid to non-paid
      await Earnings.deleteOne({ reference: bill._id }).session(session);
    } else if (wasPaid && isPaid) {
      // Update existing earnings if bill remains paid but total changes
      await Earnings.findOneAndUpdate(
        { reference: bill._id },
        { amount: bill.total, date: new Date() },
        { session }
      );
    }

    await session.commitTransaction();
    res.json({
      ...bill.toObject(),
      date: bill.date ? bill.date.toISOString().split("T")[0] : "",
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error updating bill:", error);
    if (error.name === "ValidationError") {
      const errors = Object.values(error.errors).map((err) => err.message);
      res.status(400).json({ message: "Validation failed", errors });
    } else {
      res.status(400).json({ message: error.message });
    }
  } finally {
    session.endSession();
  }
});

// Delete a bill
router.delete("/id/:id", async (req, res) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid bill ID" });
    }

    const bill = await Bill.findByIdAndDelete(req.params.id).session(session);
    if (!bill) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Bill not found" });
    }

    // Remove associated earnings if bill was paid
    if (bill.status === "paid") {
      await Earnings.deleteOne({ reference: bill._id }).session(session);
    }

    await session.commitTransaction();
    res.json({ message: "Bill deleted successfully" });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error deleting bill:", error);
    res.status(500).json({ message: "Failed to delete bill", error: error.message });
  } finally {
    session.endSession();
  }
});

// Get bill statistics for chart
router.get("/stats", async (req, res) => {
  try {
    const { startDate, endDate, timeFrame = "daily" } = req.query;
    const end = endDate ? new Date(endDate) : new Date();
    const start = startDate
      ? new Date(startDate)
      : new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);

    const groupFormat =
      timeFrame === "monthly" ? "%Y-%m" : timeFrame === "yearly" ? "%Y" : "%Y-%m-%d";

    const stats = await Bill.aggregate([
      { $match: { status: "paid", date: { $gte: start, $lte: end } } },
      {
        $group: {
          _id: { $dateToString: { format: groupFormat, date: "$date" } },
          totalRevenue: { $sum: "$total" },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    const dateRange = [];
    let currentDate = new Date(start);
    while (currentDate <= end) {
      const dateStr =
        groupFormat === "%Y-%m-%d"
          ? currentDate.toISOString().split("T")[0]
          : groupFormat === "%Y-%m"
          ? `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}`
          : `${currentDate.getFullYear()}`;
      const found = stats.find((stat) => stat._id === dateStr);
      dateRange.push({
        date: dateStr,
        totalRevenue: found ? found.totalRevenue : 0,
      });
      if (timeFrame === "yearly") currentDate.setFullYear(currentDate.getFullYear() + 1);
      else if (timeFrame === "monthly") currentDate.setMonth(currentDate.getMonth() + 1);
      else currentDate.setDate(currentDate.getDate() + 1);
    }

    res.json(dateRange);
  } catch (error) {
    console.error("Error fetching bill stats:", error);
    res.status(500).json({ message: "Failed to fetch stats", error: error.message });
  }
});

// Get unique party names for autocomplete
router.get("/parties", async (req, res) => {
  try {
    const parties = await Bill.distinct("partyName");
    if (!parties.length) {
      return res.status(200).json([]);
    }
    const normalizedParties = parties.map((name) => name.toLowerCase());
    const uniqueParties = [...new Set(normalizedParties)];
    res.json(uniqueParties);
  } catch (error) {
    console.error("Error fetching party names:", error);
    res.status(500).json({ message: "Failed to fetch party names", error: error.message });
  }
});

module.exports = router;