const Earnings = require("../models/Earnings");
const asyncHandler = require("express-async-handler");

const getEarnings = asyncHandler(async (req, res) => {
  const { startDate, endDate, source } = req.query;
  const query = {};

  if (startDate && endDate) {
    query.date = {
      $gte: new Date(startDate),
      $lte: new Date(endDate),
    };
  }
  if (source) {
    query.source = source;
  }

  const earnings = await Earnings.find(query).populate("reference");
  res.json({
    success: true,
    data: earnings.map((e) => ({
      id: e._id,
      date: e.date,
      amount: e.amount,
      type: e.type,
      source: e.source,
      reference: e.reference,
      createdBy: e.createdBy,
    })),
  });
});

module.exports = { getEarnings };