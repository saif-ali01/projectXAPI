const mongoose = require("mongoose");
const mongoosePaginate = require("mongoose-paginate-v2");

const workSchema = new mongoose.Schema({
  particulars: { type: String, required: true },
  type: { type: String, enum: ["Book", "Pad", "Tag", "Tog"], required: true },
  size: { type: String, enum: ["1/4", "1/3", "1/5", "1/2"], required: true },
  party: { type: String, required: true },
  partyId: { type: mongoose.Schema.Types.ObjectId, required: true, ref: "Client" },
  dateAndTime: { type: Date, required: true },
  quantity: { type: Number, required: true, min: 1 },
  rate: { type: Number, required: true, min: 0.01 },
  currency: { type: String, default: "INR", enum: ["INR"] },
  paid: { type: Boolean, default: false },
});

workSchema.plugin(mongoosePaginate);

module.exports = mongoose.model("Work", workSchema);