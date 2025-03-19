const express = require("express");
const passport = require("../passport"); // Require the passport module
const crypto = require("crypto");
const sendResetEmail = require("../lib/sendEmail");
const router = express.Router();
const { retrieveUserByEmail, createNewUser } = require("../controllers/user");
const User = require("../models/user");
const { redirectIfAuthenticated } = require("../middleware/auth");
const { createHubspotContact } = require("../controllers/hubspot");

router.post("/local", redirectIfAuthenticated, (req, res, next) => {
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
router.get("/local", redirectIfAuthenticated, (req, res) => {
  res.render("pages/auth/localLogin", {
    page: { title: "Local Login", link: "/login" },
    error: null,
  });
});

router.get("/register", redirectIfAuthenticated, (req, res) => {
  res.render("pages/auth/register", {
    page: { title: "Register", link: "/auth/register" },
    error: null,
    formData: {},
  });
});

router.post("/register", redirectIfAuthenticated, async (req, res) => {
  try {
    const { firstName, lastName, email, password } = req.body;

    if (!firstName || !lastName || !email || !password) {
      return res.status(400).render("pages/auth/register", {
        page: { title: "Register", link: "/auth/register" },
        error: "All fields are required.",
        formData: { firstName, lastName, email },
      });
    }

    const userExists = await retrieveUserByEmail(email);
    if (userExists) {
      return res.status(400).render("pages/auth/register", {
        page: { title: "Register", link: "/auth/register" },
        error: "User with this email already exists.",
        formData: { firstName, lastName, email },
      });
    }

    const user = await createNewUser({ firstName, lastName, email, password });
    if(user) {
      await createHubspotContact(user);
    }
    res.redirect("/auth/local");
  } catch (err) {
    console.error("❌ Registration Error:", err);
    return res.status(500).render("pages/auth/register", {
      page: { title: "Register", link: "/auth/register" },
      error: "Internal Server Error. Please try again later.",
      formData: req.body,
    });
  }
});

// Render Forgot Password Page
router.get("/forgot-password", redirectIfAuthenticated, (req, res) => {
  res.render("pages/auth/forgotPassword", {
    page: { title: "Forgot Password", link: "/auth/forgot-password" },
    error: null,
    message: null,
  });
});

// Forgot Password API
router.post("/forgot-password", redirectIfAuthenticated, async (req, res) => {
  const { email } = req.body;
  const apiUrl = process.env.BASE_URL || "http://localhost:3080";

  try {
    const user = await retrieveUserByEmail(email);
    if (!user) {
      return res.status(400).render("pages/auth/forgotPassword", {
        page: { title: "Forgot Password" },
        error: "No user found with that email.",
        message: null,
      });
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(20).toString("hex");
    user.resetPasswordToken = resetToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour expiry

    await user.save();

    // Send reset email
    const resetLink = `${apiUrl}/auth/reset-password/${resetToken}`;
    await sendResetEmail(user.email, resetLink);

    res.render("pages/auth/forgotPassword", {
      page: { title: "Forgot Password" },
      message: "Password reset link has been sent to your email.",
      error: null,
    });
  } catch (err) {
    console.error("❌ Forgot Password API Error:", err);
    return res.status(500).render("pages/auth/forgotPassword", {
      page: { title: "Forgot Password" },
      error: "Internal server error. Please try again later.",
      message: null,
    });
  }
});

// Render Reset Password Page
router.get("/reset-password/:token", redirectIfAuthenticated, async (req, res) => {
  const { token } = req.params;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).render("pages/auth/resetPassword", {
        page: { title: "Reset Password" },
        error: "Invalid or expired token.",
      });
    }

    res.render("pages/auth/resetPassword", {
      page: { title: "Reset Password" },
      token,
      error: null,
    });
  } catch (err) {
    console.error("❌ Reset Password Route Error:", err);
    res.status(500).send("Internal Server Error - Something went wrong.");
  }
});

// Handle New Password Submission
router.post("/reset-password/:token", redirectIfAuthenticated, async (req, res) => {
  const { token } = req.params;
  const { password } = req.body;

  try {
    const user = await User.findOne({
      resetPasswordToken: token,
      resetPasswordExpires: { $gt: Date.now() },
    });

    if (!user) {
      return res.status(400).render("pages/auth/resetPassword", {
        page: { title: "Reset Password" },
        error: "Invalid or expired token.",
      });
    }

    user.password = password;
    user.resetPasswordToken = null;
    user.resetPasswordExpires = null;

    await user.save();

    req.logout(function (err) {
      if (err) return next(err);
    
      // ✅ Destroy all active sessions after reset
      req.session.destroy(() => {
        res.redirect("/auth/local"); // Redirect to login page
      });
    });
  } catch (err) {
    console.error("❌ Reset Password Submission Error:", err);
    res.status(500).render("pages/auth/resetPassword", {
      page: { title: "Reset Password" },
      error: "Internal server error. Please try again later.",
    });
  }
});

module.exports = router;
