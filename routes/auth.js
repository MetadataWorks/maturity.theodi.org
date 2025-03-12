// authRoutes.js

const express = require("express");
const passport = require("../passport"); // Require the passport module

const {
  retrieveUserByEmail,
  createNewUser,
} = require("../controllers/user");

const router = express.Router();

router.post(
  "/local",
  passport.authenticate("local", {
    successRedirect: "/projects",
    failureRedirect: "/auth/local",
  })
);

// Render local login page
router.get("/local", (req, res) => {
  res.render("pages/auth/localLogin", {
    page: {
      title: "Local Login",
      link: "/login",
    },
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

module.exports = router;
