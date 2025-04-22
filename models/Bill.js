const mongoose = require("mongoose");

const billSchema = new mongoose.Schema({
  serialNumber: {
    type: Number,
    unique: true,
    required: true,
  },
  partyName: {
    type: String,
    required: true,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  rows: [
    {
      id: { type: Number, required: true },
      particulars: { type: String, required: true },
      type: { type: String, enum: ["Book", "Pad", "Tag", "Register", "Other"] },
      size: { type: String, enum: ["1/3", "1/4", "1/5", "1/6", "1/8", "1/10", "1/12", "1/16", "Other"] },
      customType: String,
      customSize: String,
      quantity: { type: Number, min: 0 },
      rate: { type: Number, min: 0 },
      total: { type: Number, min: 0 }
    }
  ],
  total: Number,
  advance: Number,
  balance: Number,
  due: Number,
  status: {
    type: String,
    enum: ["pending", "due", "paid"],
    required: true,
    default: "pending"
  },
  note: {
    type: String,
    default: ""
  }
});

billSchema.index({ serialNumber: 1 }, { unique: true });

module.exports = mongoose.model("Bill", billSchema);