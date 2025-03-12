const mongoose = require("mongoose");
const bcrypt = require("bcrypt");

const UserSchema = new mongoose.Schema({
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    email: { type: String, required: true, unique: true }, // Email must be unique
    username: { type: String, unique: true }, // ✅ Username is unique but NOT required in the form
    password: { type: String, required: true }
});

// ✅ Generate username before saving
UserSchema.pre("save", async function (next) {
    if (!this.isModified("password")) return next();

    // Hash password
    this.password = await bcrypt.hash(this.password, 10);

    // Auto-generate username if it's not set
    if (!this.username) {
        this.username = this.email.split("@")[0] + Math.floor(Math.random() * 1000); // Example: "john123"
    }

    next();
});

module.exports = mongoose.model("User", UserSchema);
