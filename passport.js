const bcrypt = require("bcrypt");
const passport = require("passport");
const LocalStrategy = require("passport-local").Strategy;
const { retrieveUserByEmail } = require("./controllers/user");
const User = require("./models/user");

passport.use(
  "local",
  new LocalStrategy(
    { usernameField: "email" },
    async (email, password, done) => {
      try {
        const user = await retrieveUserByEmail(email);
        if (!user) {
          console.log("❌ User not found");
          return done(null, false, { message: "Incorrect email or password" });
        }

        // ✅ Compare passwords correctly
        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) {
          console.log("❌ Password does not match");
          return done(null, false, { message: "Incorrect email or password" });
        }

        return done(null, user);
      } catch (err) {
        console.error("❌ Error in LocalStrategy:", err);
        return done(err);
      }
    }
  )
);

passport.serializeUser((user, done) => done(null, user.id));

passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id).select("-password"); // Exclude password from session
    if (!user) {
      console.error("❌ User not found during deserialization");
      return done(null, false);
    }
    done(null, user);
  } catch (err) {
    console.error("❌ Error in deserializeUser:", err);
    done(err);
  }
});

module.exports = passport;
