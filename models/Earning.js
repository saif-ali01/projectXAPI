const mongoose = require("mongoose");

const earningsSchema = new mongoose.Schema(
  {
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    amount: {
      type: Number,
      required: true,
      min: 0,
    },
    type: {
      type: String,
      required: true,
      enum: ["Sales", "Investment", "Other"],
    },
    source: {
      type: String,
      required: true,
    },
    reference: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bill",
      required: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Earnings", earningsSchema);