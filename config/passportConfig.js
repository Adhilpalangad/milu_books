// passport-setup.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userModel") // Adjust the path as necessary

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    const user = await User.findById(id);
    done(null, user);
});

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL, // Ensure this matches what you set in Google Developer Console
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists in our db
        const existingUser = await User.findOne({ googleId: profile.id });
        
        if (existingUser) {
            return done(null, existingUser); // User exists, return the user
        }
        
        // If not, create a new user in our db
        const newUser = await new User({
            name: profile.displayName,
            email: profile.emails[0].value,
            password: profile.id, // Store the googleId
        }).save();
        
        done(null, newUser);
    } catch (err) {
        console.error(err);
        done(err, null);
    }
}));
