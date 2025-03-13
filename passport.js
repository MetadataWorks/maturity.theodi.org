const bcrypt = require("bcrypt");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { retrieveUserByEmail } = require("./controllers/user");
const User = require("./models/user");

passport.use(
  "local",
  new LocalStrategy({ usernameField: "email" }, async (email, password, done) => {
    try {
      console.log("🔍 Checking login for:", email);

      const user = await retrieveUserByEmail(email);
      if (!user) {
        console.log("❌ User not found");
        return done(null, false, { message: "Incorrect email or password" });
      }

      console.log("🔑 Stored Hashed Password:", user.password);
      console.log("🔑 Entered Password (Plain Text):", password);

      // ✅ Compare passwords correctly
      const isMatch = await bcrypt.compare(password, user.password);
      console.log("🔍 bcrypt.compare result:", isMatch);

      if (!isMatch) {
        console.log("❌ Password does not match");
        return done(null, false, { message: "Incorrect email or password" });
      }

      console.log("✅ Login successful for:", user.email);
      return done(null, user);
    } catch (err) {
      console.error("❌ Error in LocalStrategy:", err);
      return done(err);
    }
  })
);


passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err);
  }
});

module.exports = passport;
