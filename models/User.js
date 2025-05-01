const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, select: false },
  role: { type: String, default: "user" },
  isGoogleUser: { type: Boolean, default: false },
  resetPasswordToken: String,
  resetPasswordExpires: Date,
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password") || this.isGoogleUser) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model("User", userSchema);