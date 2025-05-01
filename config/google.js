const passport = require("passport");
const GoogleStrategy = require("passport-google-oauth20").Strategy;
const User = require("../models/User");

// Configure Google Strategy
passport.use(
  new GoogleStrategy(
    {
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: process.env.GOOGLE_CALLBACK_URL,
    },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Validate profile data
        if (!profile.emails || !profile.emails[0]?.value) {
          return done(new Error("No email provided by Google"), null);
        }
        if (!profile.displayName) {
          return done(new Error("No display name provided by Google"), null);
        }

        // Find or create user
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          // Update existing user
          user.name = profile.displayName;
          user.isGoogleUser = true;
          await user.save();
          return done(null, user);
        }

        // Create new user
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          isGoogleUser: true,
          role: "user",
        });
        await user.save();
        return done(null, user);
      } catch (err) {
        console.error("Google Strategy error:", err);
        return done(err, null);
      }
    }
  )
);

// Serialize user to store in session
passport.serializeUser((user, done) => {
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    done(null, user);
  } catch (err) {
    done(err, null);
  }
});