const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require("../models/userModel"); // Adjust the path as necessary

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
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
}, async (accessToken, refreshToken, profile, done) => {
    try {
        // Check if user already exists in our db
        const existingUser = await User.findOne({ googleId: profile.id });

        if (existingUser) {
            console.log('Existing user:', existingUser);
            return done(null, existingUser); // User exists, return the user
        }

        // If user does not exist, check if email is already registered with a different method
        const existingEmailUser = await User.findOne({ email: profile.emails[0].value });

        if (existingEmailUser) {
            // Log that the email already exists
            
            
            // Optional: Here you could handle merging or linking accounts
            // For now, just return the existing user
            return done(null, existingEmailUser); 
        }

        // Create a new user in our db
        const newUser = await new User({
            googleId: profile.id, // Store googleId
            name: profile.displayName,
            email: profile.emails[0].value,
            // Password field is not required when signing up via Google
        }).save();
        console.log('New user:', newUser);
        done(null, newUser);
    } catch (err) {
        console.error(err);
        done(err, null);
    }
}));
