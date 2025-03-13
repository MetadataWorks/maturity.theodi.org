const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const SALT_ROUNDS = 12;

const UserSchema = new mongoose.Schema(
  {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    username: { type: String, unique: true },
    password: { type: String, required: true },
    resetPasswordToken: { type: String, default: null },
    resetPasswordExpires: { type: Date, default: null },
  },
  { collection: "users" }
);

// ✅ Ensure password is hashed only when modified
UserSchema.pre("save", async function (next) {
  console.log("🔒 Hashing Password Before Save...");
  this.password = await bcrypt.hash(this.password, SALT_ROUNDS);
  if (!this.username) {
    this.username = this.email.split("@")[0] + Math.floor(Math.random() * 1000); // Example: "john123"
  }
  next();
});

module.exports = mongoose.model("User", UserSchema);
module.exports.SALT_ROUNDS = SALT_ROUNDS;
