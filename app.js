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
app.use(express.json()); 
app.use(express.urlencoded({ extended: true })); 

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        message: 'Internal server error',
        errorDetails: err.message
    });
});


const session = require('express-session');

app.use(session({
    secret: 'yehfgeiw32', 
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false } 
}));

app.use((req, res, next) => {
    res.locals.session = req.session; 
    next();
});

app.use(passport.initialize());
app.use(passport.session());

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'uploads')));

const nocache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };
  
  app.use(['/login', '/home' ,'/admin','/admin/home'], nocache);

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");

// Routes
app.use('/', userRoute);
app.use('/admin', adminRoute);



// Start the server
app.listen(port, () => console.log(`App listening on port ${port}!`));
