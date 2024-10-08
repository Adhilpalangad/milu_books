const express = require('express');
const passport = require('passport'); // Import passport
const router = express.Router();
const userController = require('../controller/userController');

// Landing Page
router.get('/', (req, res) => {
    res.render('user/landing');
});

// Signup Page
router.get('/signup', (req, res) => {
    res.render('user/signup', { error: null, message: null });
});

// Google Authentication
router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'], // Scope to request user profile and email
}));

// Google Callback
router.get('/auth/google/callback', passport.authenticate('google', {
    failureRedirect: '/login', // Redirect to login if authentication fails
}), (req, res) => {
    // Successful authentication, redirect to desired page
    res.redirect('/'); // Change this to your desired route after login
});

// Login Page
router.get('/login', (req, res) => {
    res.render('user/login', { error: null });
});

// Products Page
router.get('/products', userController.getProducts);

// Signup and Login Handlers
router.post('/signup', userController.userSignup);
router.post('/login', userController.userLogin);

module.exports = router;
