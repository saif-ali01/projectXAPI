// controllers/reportController.js
const Transaction = require("../models/Transaction");
const { isValidDate } = require("../utils/helpers");

const getReports = async (req, res) => {
  try {
    const { startDate, endDate, type } = req.query;

    // Validate input parameters
    if (!startDate || !endDate || !type) {
      return res.status(400).json({
        success: false,
        message: "Missing required parameters: startDate, endDate, type",
      });
    }

    if (!["category", "monthly", "yearly"].includes(type)) {
      return res.status(400).json({
        success: false,
        message: "Invalid report type. Valid values: category, monthly, yearly",
      });
    }

    const start = new Date(startDate);
    const end = new Date(endDate);

    if (!isValidDate(start) || !isValidDate(end)) {
      return res.status(400).json({
        success: false,
        message: "Invalid date format. Use ISO format (YYYY-MM-DD)",
      });
    }

    if (start > end) {
      return res.status(400).json({
        success: false,
        message: "Start date must be before end date",
      });
    }

    const matchStage = {
      date: { $gte: start, $lte: end },
    };

    let pipeline;

    switch (type) {
      case "category":
        pipeline = [
          { $match: matchStage },
          { $group: { _id: "$category", total: { $sum: "$amount" } } },
          { $project: { _id: 0, category: "$_id", total: 1 } },
          { $sort: { total: -1 } },
        ];
        break;

      case "monthly":
        pipeline = [
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
              _id: 0,
              month: {
                $dateToString: {
                  format: "%Y-%m",
                  date: {
                    $dateFromParts: {
                      year: "$_id.year",
                      month: "$_id.month",
                      day: 1,
                    },
                  },
                },
              },
              total: 1,
            },
          },
          { $sort: { month: 1 } },
        ];
        break;

      case "yearly":
        pipeline = [
          { $match: matchStage },
          {
            $group: {
              _id: { $year: "$date" },
              total: { $sum: "$amount" },
            },
          },
          { $project: { _id: 0, year: "$_id", total: 1 } },
          { $sort: { year: 1 } },
        ];
        break;
    }

    const reportData = await Transaction.aggregate(pipeline);

    if (reportData.length === 0) {
      return res.status(404).json({
        success: false,
        message: "No transactions found in the selected date range",
      });
    }

    res.json({
      success: true,
      data: reportData,
      meta: {
        startDate: start.toISOString().split("T")[0],
        endDate: end.toISOString().split("T")[0],
        reportType: type,
        count: reportData.length,
      },
    });
  } catch (error) {
    console.error("Report generation error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to generate report",
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
    });
  }
};

module.exports = {
  getReports,
};