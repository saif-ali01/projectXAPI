// models/Earning.js
const mongoose = require("mongoose");

const earningsSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  type: {
    type: String,
    enum: ["Sales", "Investment", "Other"],
    required: true,
  },
  source: {
    type: String,
    required: true,
  },
  reference: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Bill",
  }
});

module.exports = mongoose.model("Earnings", earningsSchema);