const Transaction = require("../models/Transaction");

const getReports = async (req, res) => {
  const { startDate, endDate, type } = req.query;

  // Validate query parameters
  if (!startDate || !endDate || !type) {
    return res.status(400).json({ message: "Missing required query parameters" });
  }

  try {
    const start = new Date(startDate);
    const end = new Date(endDate);

    // Validate dates
    if (isNaN(start) || isNaN(end)) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    let reportData = [];

    const matchStage = {
      date: { $gte: start, $lte: end },
    };

    switch (type) {
      case "category":
        reportData = await Transaction.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: "$category",
              total: { $sum: "$amount" },
            },
          },
          {
            $project: {
              category: "$_id",
              total: 1,
              _id: 0,
            },
          },
        ]);
        break;

      case "monthly":
        reportData = await Transaction.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: {
                year: { $year: "$date" },
                month: { $month: "$date" },
              },
              total: { $sum: "$amount" },
            },
          },
          {
            $project: {
              month: {
                $concat: [
                  { $toString: "$_id.month" },
                  "/",
                  { $toString: "$_id.year" },
                ],
              },
              total: 1,
              _id: 0,
            },
          },
          { $sort: { "_id.year": 1, "_id.month": 1 } },
        ]);
        break;

      case "yearly":
        reportData = await Transaction.aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: { $year: "$date" },
              total: { $sum: "$amount" },
            },
          },
          {
            $project: {
              year: "$_id",
              total: 1,
              _id: 0,
            },
          },
          { $sort: { year: 1 } },
        ]);
        break;

      default:
        return res.status(400).json({ message: "Invalid report type" });
    }

    return res.json(reportData);
  } catch (error) {
    console.error("Error generating report:", error);
    return res.status(500).json({ message: "Server error" });
  }
};

module.exports = { getReports };