const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  serialNumber: {
    type: Number,
    unique: true,
    required: [true, "Serial number is required"],
  },
  partyName: {
    type: String,
    required: [true, "Party name is required"],
    trim: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  rows: [
    {
      id: { type: Number, required: [true, "Row ID is required"] },
      particulars: {
        type: String,
        required: [true, "Particulars are required"],
        trim: true,
      },
      type: {
        type: String,
        enum: ["Book", "Pad", "Tag", "Register", "Other", ""],
        default: "",
      },
      size: {
        type: String,
        enum: ["1/3", "1/4", "1/5", "1/6", "1/8", "1/10", "1/12", "1/16", "Other", ""],
        default: "",
      },
      customType: { type: String, trim: true, default: "" },
      customSize: { type: String, trim: true, default: "" },
      quantity: { type: Number, min: [0, "Quantity cannot be negative"], default: 0 },
      rate: { type: Number, min: [0, "Rate cannot be negative"], default: 0 },
      total: { type: Number, min: [0, "Total cannot be negative"], default: 0 },
    },
  ],
  total: {
    type: Number,
    min: [0, "Total cannot be negative"],
    default: 0,
  },
  advance: {
    type: Number,
    min: [0, "Advance cannot be negative"],
    default: 0,
  },
  balance: {
    type: Number,
    min: [0, "Balance cannot be negative"],
    default: 0,
  },
  due: {
    type: Number,
    min: [0, "Due cannot be negative"],
    default: 0,
  },
  previousBalance: {
    type: Number,
    min: [0, "Previous balance cannot be negative"],
    default: 0,
  },
  status: {
    type: String,
    enum: ["pending", "due", "paid"],
    default: "pending",
  },
  note: {
    type: String,
    trim: true,
    default: "",
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
  },
});

billSchema.index({ serialNumber: 1 }, { unique: true });
billSchema.index({ partyName: 1, date: -1 });
billSchema.index({ createdBy: 1, status: 1 });

module.exports = mongoose.model("Bill", billSchema);