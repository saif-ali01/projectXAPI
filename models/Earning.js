// models/Earnings.js
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
});

module.exports = mongoose.model("Earnings", earningsSchema);