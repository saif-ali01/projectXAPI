const mongoose = require("mongoose");

const expenseSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  category: {
    type: String,
    enum: ["Food", "Travel", "Equipment", "Other"],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
    min: 0,
  },
  type: {
    type: String,
    enum: ["Personal", "Professional"],
    required: true,
  },
});

expenseSchema.index({ createdBy: 1, date: -1 });

module.exports = mongoose.model("Expense", expenseSchema);