const Work = require("../models/Work");
const Client = require("../models/Client");
const Earnings = require("../models/Earnings"); // Import Earnings model
const asyncHandler = require("express-async-handler");
const createError = require("http-errors");
const moment = require("moment-timezone");

// @desc    Create new work entry
// @route   POST /api/works
// @access  Public
const createWork = asyncHandler(async (req, res) => {
  const {
    particulars,
    type,
    size,
    party,
    dateAndTime,
    quantity,
    rate,
    currency = "INR",
    paid = false,
  } = req.body;

  // Validate currency
  if (currency !== "INR") {
    throw createError(400, "Currency must be INR");
  }

  // Find client by party name
  const client = await Client.findOne({ name: party });
  if (!client) {
    throw createError(400, "Party not found");
  }

  try {
    const work = await Work.create({
      particulars,
      type,
      size,
      party,
      partyId: client._id,
      dateAndTime: dateAndTime ? new Date(dateAndTime) : Date.now(),
      quantity,
      rate,
      currency,
      paid,
    });

    // If work is marked as paid, create an Earnings entry
    if (paid) {
      await Earnings.create({
        date: work.dateAndTime,
        amount: quantity * rate,
        type: "Sales",
        source: "Work",
        reference: work._id,
        createdBy: null, // Replace with req.user._id if authentication is implemented
      });
    }

    res.status(201).json({
      success: true,
      data: {
        id: work._id,
        particulars: work.particulars,
        type: work.type,
        size: work.size,
        party: work.party,
        partyId: work.partyId,
        dateAndTime: moment(work.dateAndTime)
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        quantity: work.quantity,
        rate: work.rate,
        currency: work.currency,
        paid: work.paid,
      },
    });
  } catch (error) {
    console.error("Create work error:", error);
    if (error.name === "ValidationError") {
      throw createError(
        400,
        `Validation failed: ${Object.values(error.errors)
          .map((e) => e.message)
          .join(", ")}`
      );
    }
    throw createError(500, `Failed to create work: ${error.message}`);
  }
});

// @desc    Get all works
// @route   GET /api/works
// @access  Public
const getAllWorks = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, search = "", type, sort } = req.query;
  const pageNumber = parseInt(page, 10);
  const limitNumber = parseInt(limit, 10);

  const query = {};

  if (search) {
    query.$or = [
      { particulars: { $regex: search, $options: "i" } },
      { party: { $regex: search, $options: "i" } },
    ];
  }

  if (type && type !== "All") {
    query.type = type;
  }

  const options = {
    page: pageNumber,
    limit: limitNumber,
    sort: sort ? { [sort]: 1 } : { createdAt: -1 },
  };

  const works = await Work.paginate(query, options);

  res.json({
    success: true,
    data: {
      docs: works.docs.map((doc) => ({
        id: doc._id,
        particulars: doc.particulars,
        type: doc.type,
        size: doc.size,
        party: doc.party,
        partyId: doc.partyId,
        dateAndTime: moment(doc.dateAndTime)
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DD HH:mm:ss"),
        quantity: doc.quantity,
        rate: doc.rate,
        currency: doc.currency,
        paid: doc.paid,
      })),
      totalDocs: works.totalDocs,
      limit: works.limit,
      page: works.page,
      totalPages: works.totalPages,
      hasPrevPage: works.hasPrevPage,
      hasNextPage: works.hasNextPage,
      prevPage: works.prevPage,
      nextPage: works.nextPage,
    },
  });
});

// @desc    Get single work
// @route   GET /api/works/:id
// @access  Public
const getWork = asyncHandler(async (req, res) => {
  const work = await Work.findById(req.params.id);

  if (!work) throw createError(404, "Work not found");

  res.status(200).json({
    success: true,
    data: {
      id: work._id,
      particulars: work.particulars,
      type: work.type,
      size: work.size,
      party: work.party,
      partyId: work.partyId,
      dateAndTime: moment(work.dateAndTime)
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss"),
      quantity: work.quantity,
      rate: work.rate,
      currency: work.currency,
      paid: work.paid,
    },
  });
});

// @desc    Update work
// @route   PATCH /api/works/:id
// @access  Public
const updateWork = asyncHandler(async (req, res) => {
  const { particulars, type, size, party, dateAndTime, quantity, rate, currency, paid } = req.body;

  // Validate currency if provided
  if (currency && currency !== "INR") {
    throw createError(400, "Currency must be INR");
  }

  // Find client by party name if party is provided
  let partyId;
  if (party) {
    const client = await Client.findOne({ name: party });
    if (!client) {
      throw createError(400, "Party not found");
    }
    partyId = client._id;
  }

  const updateData = {
    particulars,
    type,
    size,
    party,
    partyId,
    dateAndTime: dateAndTime ? new Date(dateAndTime) : undefined,
    quantity,
    rate,
    currency,
    paid,
  };

  // Remove undefined fields
  Object.keys(updateData).forEach((key) => updateData[key] === undefined && delete updateData[key]);

  const work = await Work.findById(req.params.id);
  if (!work) throw createError(404, "Work not found");

  // Check if paid status has changed
  const wasPaid = work.paid;
  const isPaid = paid !== undefined ? paid : wasPaid;

  // Update the work
  const updatedWork = await Work.findByIdAndUpdate(req.params.id, updateData, {
    new: true,
    runValidators: true,
  });

  // Handle Earnings update
  if (isPaid && !wasPaid) {
    // Work was marked as paid: create Earnings entry
    await Earnings.create({
      date: updatedWork.dateAndTime,
      amount: updatedWork.quantity * updatedWork.rate,
      type: "Sales",
      source: "Work",
      reference: updatedWork._id,
      createdBy: null, // Replace with req.user._id if authentication is implemented
    });
  } else if (!isPaid && wasPaid) {
    // Work was marked as unpaid: remove Earnings entry
    await Earnings.deleteOne({ reference: updatedWork._id, source: "Work" });
  } else if (isPaid && wasPaid) {
    // Work remains paid but other fields (e.g., quantity, rate) may have changed: update Earnings
    await Earnings.updateOne(
      { reference: updatedWork._id, source: "Work" },
      {
        date: updatedWork.dateAndTime,
        amount: updatedWork.quantity * updatedWork.rate,
        type: "Sales",
        source: "Work",
      }
    );
  }

  res.status(200).json({
    success: true,
    data: {
      id: updatedWork._id,
      particulars: updatedWork.particulars,
      type: updatedWork.type,
      size: updatedWork.size,
      party: updatedWork.party,
      partyId: updatedWork.partyId,
      dateAndTime: moment(updatedWork.dateAndTime)
        .tz("Asia/Kolkata")
        .format("YYYY-MM-DD HH:mm:ss"),
      quantity: updatedWork.quantity,
      rate: updatedWork.rate,
      currency: updatedWork.currency,
      paid: updatedWork.paid,
    },
  });
});

// @desc    Delete work
// @route   DELETE /api/works/:id
// @access  Public
const deleteWork = asyncHandler(async (req, res) => {
  const work = await Work.findById(req.params.id);

  if (!work) throw createError(404, "Work not found");

  // If work was paid, remove the corresponding Earnings entry
  if (work.paid) {
    await Earnings.deleteOne({ reference: work._id, source: "Work" });
  }

  await Work.findByIdAndDelete(req.params.id);

  res.status(200).json({
    success: true,
    data: {},
  });
});

// Helper function for sorting
const getSort = (sort) => {
  const sortOptions = {
    quantity: { quantity: -1 },
    rate: { rate: -1 },
    total: { $expr: { $multiply: ["$quantity", "$rate"] } },
  };
  return sortOptions[sort] || { createdAt: -1 };
};

module.exports = {
  createWork,
  getAllWorks,
  getWork,
  updateWork,
  deleteWork,
  getSort,
};