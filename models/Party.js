const mongoose = require("mongoose");

const partySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Party name is required"],
      trim: true,
      minlength: [1, "Party name cannot be empty"],
    },
    contact: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      type: String,
      trim: true,
      default: "",
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
    },
  },
  { timestamps: true }
);

// Index for faster queries
partySchema.index({ name: 1, createdBy: 1 });

module.exports = mongoose.model("Party", partySchema);