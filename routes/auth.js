// authRoutes.js

const express = require("express");
const passport = require("../passport"); // Require the passport module
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const sendResetEmail = require("../lib/sendEmail");
const router = express.Router();
const { retrieveUserByEmail, createNewUser } = require("../controllers/user");
const User = require("../models/user");

router.post("/local", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    if (err) {
      console.error("❌ Login Error:", err);
      return res.status(500).render("pages/auth/localLogin", {
        page: { title: "Login", link: "/auth/local" },
        error: "Internal Server Error. Please try again later.",
      });
    }

    if (!user) {
      return res.status(400).render("pages/auth/localLogin", {
        page: { title: "Login", link: "/auth/local" },
        error: info.message || "Incorrect email or password.",
      });
    }

    req.logIn(user, (err) => {
      if (err) {
        console.error("❌ Login Session Error:", err);
        return res.status(500).render("pages/auth/localLogin", {
          page: { title: "Login", link: "/auth/local" },
          error: "Login session error. Please try again.",
        });
      }
      return res.redirect("/projects"); // Redirect to dashboard after successful login
    });
  })(req, res, next);
});

// Render local login page
router.get("/local", (req, res) => {
  res.render("pages/auth/localLogin", {
    page: { title: "Local Login", link: "/login" },
    error: null, // Ensure error variable is always defined
  });
});

router.post("/register", async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    // ✅ Check if all required fields are provided
    if (!firstName || !lastName || !email || !password) {
      return res.status(400).render("pages/auth/register", {
        page: { title: "Register", link: "/auth/register" },
        error: "All fields are required. Please fill out the form.",
        formData: { firstName, lastName, email }, // Preserve form input
      });
    }

    // ✅ Check if email already exists
    const userExists = await retrieveUserByEmail(email);
    if (userExists) {
      return res.status(400).render("pages/auth/register", {
        page: { title: "Register", link: "/auth/register" },
        error: "User with this email already exists.",
        formData: { firstName, lastName, email }, // Preserve form input
      });
    }

    // ✅ Create new user (username is auto-generated)
    await createNewUser({ firstName, lastName, email, password });

    res.redirect("/auth/local"); // Redirect to login after successful registration
  } catch (err) {
    console.error("❌ Registration Error:", err);

    // ✅ Handle MongoDB duplicate key error (E11000)
    if (err.code === 11000) {
      return res.status(400).render("pages/auth/register", {
        page: { title: "Register", link: "/auth/register" },
        error: "A user with this email already exists.",
        formData: req.body,
      });
    }

    res.status(500).render("pages/auth/register", {
      page: { title: "Register", link: "/auth/register" },
      error: "Internal Server Error. Please try again later.",
      formData: req.body,
    });
  }
});

//render local register page
router.get("/register", (req, res) => {
  res.render("pages/auth/register", {
    page: { title: "Register", link: "/register" },
    error: null, // Ensure error variable is always defined
    formData: {}, // Ensure formData is always an empty object if no data is passed
  });
});

// ✅ Render Forgot Password Page (Public Route)
router.get("/forgot-password", (req, res) => {
  res.render("pages/auth/forgotPassword", {
    page: { title: "Forgot Password", link: "/auth/forgot-password" },
    error: null,
    message: null,
  });
});


// Forgot Password API
router.post("/forgot-password", async (req, res) => {
  const { email } = req.body;

  try {
    console.log("📩 Forgot Password Request for:", email);

    const user = await retrieveUserByEmail(email);
    if (!user) {
      console.log("❌ No user found with that email");
      return res.status(400).render("pages/auth/forgotPassword", {
        page: { title: "Forgot Password" }, // ✅ Fix: Ensure 'page' is defined
        error: "No user found with that email.",
        message: null,
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry
    console.log("🔐 Generated Reset Token:", resetToken);

    await user.save();
    console.log("✅ User updated with reset token");

    // Send reset email
    const resetLink = `http://localhost:3080/auth/reset-password/${resetToken}`;
    console.log("✅ Sending Reset Email to:", user.email);
    console.log("🔗 Reset Link:", resetLink);

    await sendResetEmail(user.email, resetLink);
    console.log("✅ Email sent successfully");

    console.log("✅ Rendering forgotPassword page with success message...");
    
    // ✅ Fix: Pass 'page' to render function
    res.render("pages/auth/forgotPassword", {
      page: { title: "Forgot Password" },
      message: "Password reset link has been sent to your email.",
      error: null,
    });

  } catch (err) {
    console.error("❌ Forgot Password API Error:", err);
    return res.status(500).render("pages/auth/forgotPassword", {
      page: { title: "Forgot Password" }, // ✅ Fix: Ensure 'page' is always defined
      error: "Internal server error. Please try again later.",
      message: null,
    });
  }
});


// Render Reset Password Page
router.get("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  
  try {
    console.log("🔍 Checking reset token:", token);

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // ✅ Ensure token is still valid
    });

    if (!user) {
      console.log("❌ Invalid or expired token");
      return res.status(400).render("pages/auth/resetPassword", {
        page: { title: "Reset Password" },
        error: "Invalid or expired token.",
      });
    }

    console.log("✅ Valid reset token for:", user.email);
    res.render("pages/auth/resetPassword", {
      page: { title: "Reset Password" },
      token, // ✅ Pass the token to the EJS form
      error: null,
    });

  } catch (err) {
    console.error("❌ Reset Password Route Error:", err);
    res.status(500).send("Internal Server Error - Something went wrong.");
  }
});

// Handle New Password Submission

router.post("/reset-password/:token", async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    console.log("🔍 Resetting password for token:", token);

    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() }, // Check if token is still valid
    });

    if (!user) {
      console.log("❌ Invalid or expired reset token.");
      return res.status(400).render("pages/auth/resetPassword", {
        page: { title: "Reset Password" },
        error: "Invalid or expired token.",
      });
    }

    console.log("✅ Valid token found for:", user.email);

    // ✅ Hash new password before saving
    const hashedPassword = await bcrypt.hash(password, 10);
    user.password = hashedPassword;
    user.resetPasswordToken = null; // Clear reset token
    user.resetPasswordExpires = null; // Clear token expiration
    await user.save();

    console.log("✅ Password updated successfully for:", user.email);

    res.redirect("/auth/local"); // Redirect to login page after successful reset
  } catch (err) {
    console.error("❌ Reset Password Submission Error:", err);
    res.status(500).render("pages/auth/resetPassword", {
      page: { title: "Reset Password" },
      error: "Internal server error. Please try again later.",
    });
  }
});


module.exports = router;
