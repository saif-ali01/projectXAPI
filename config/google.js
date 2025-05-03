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
        console.log("Google OAuth profile received:", {
          id: profile.id,
          displayName: profile.displayName,
          emails: profile.emails,
        });
        // Validate profile data
        if (!profile.emails || !profile.emails[0]?.value) {
          console.error("Google OAuth error: No email provided");
          return done(new Error("No email provided by Google"), null);
        }
        if (!profile.displayName) {
          console.error("Google OAuth error: No display name provided");
          return done(new Error("No display name provided by Google"), null);
        }

        // Find or create user
        let user = await User.findOne({ email: profile.emails[0].value });

        if (user) {
          console.log("Existing user found:", user.email);
          user.name = profile.displayName;
          user.isGoogleUser = true;
          await user.save();
          return done(null, user);
        }

        console.log("Creating new user:", profile.emails[0].value);
        user = new User({
          name: profile.displayName,
          email: profile.emails[0].value,
          isGoogleUser: true,
          role: "user",
        });
        await user.save();
        console.log("New user created:", user.email);
        return done(null, user);
      } catch (err) {
        console.error("Google Strategy error:", {
          message: err.message,
          stack: err.stack,
        });
        return done(err, null);
      }
    }
  )
);

// Serialize user to store in session
passport.serializeUser((user, done) => {
  console.log("Serializing user:", user.id);
  done(null, user.id);
});

// Deserialize user from session
passport.deserializeUser(async (id, done) => {
  try {
    const user = await User.findById(id);
    console.log("Deserializing user:", user ? user.email : "Not found");
    done(null, user);
  } catch (err) {
    console.error("Deserialize error:", err);
    done(err, null);
  }
});