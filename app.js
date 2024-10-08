const express = require('express');
const app = express();
const path = require('path');
const port = 3000;
const adminRoute = require('./route/adminRoute');
const userRoute = require('./route/userRoute');
const connectDb = require('./db/dbConnect');
const passport = require('passport');
require('./config/passportConfig');

// Connect to the database
connectDb();

// Built-in middleware for parsing JSON and URL-encoded form data
app.use(express.json()); // For parsing application/json
app.use(express.urlencoded({ extended: true })); // For parsing application/x-www-form-urlencoded

const session = require('express-session');

app.use(session({
    secret: 'yehfgeiw32', // Change this to a random secret
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } // Set secure to true in production with HTTPS
}));

app.use(passport.initialize());
app.use(passport.session());

// Serve static files from the "public" and "uploads" directories
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));

// Set up view engine
app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Routes
app.use('/', userRoute);
app.use('/admin', adminRoute);

// Example route
app.get('/', (req, res) => res.send('Hello World!'));

// Start the server
app.listen(port, () => console.log(`App listening on port ${port}!`));
