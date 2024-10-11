const User = require("../models/userModel")
const router = require("../route/adminRoute")
const bcrypt = require('bcrypt')
const mongoose = require("mongoose")
const Book = require('../models/productModel');
const axios = require('axios');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const sendOtpToEmail = require('../config/sendOtpToEmail');


//For User Signup

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const userSignup = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    // Check if this is the first request or form submission
    if (!name && !email && !password && !confirmPassword) {
        // Initial GET request to display the signup page
        return res.render('user/signup', { error: null, message: null });
    }

    // Now check form submission input
    if (!isNaN(name)) {
        return res.render('user/signup', { error: 'Name must contain only characters.', message: null });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        return res.render('user/signup', { error: 'Please enter a valid email address.', message: null });
    }

    if (password !== confirmPassword) {
        return res.render('user/signup', { error: 'Passwords do not match.', message: null });
    }

    try {
        const existingUser = await User.findOne({ email });
        if (existingUser) {
            return res.render('user/signup', { error: 'User Already Exist', message: null });
        }

        // Store user info in session temporarily
        req.session.tempUser = { name, email, password }; // Save temporary user data
        console.log('Temp user set in session :', req.session.tempUser);
        // Send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a 6-digit OTP
        req.session.otp = otp;
        req.session.otpExpires = new Date(Date.now() + 60 * 1000); // OTP valid for 1 minute
        console.log('otp is',otp);
        
        await sendOtpToEmail(email, otp); // Send OTP to email

        // Redirect to OTP verification page
        return res.redirect('/verify-otp'); // Redirect to the OTP verification page
    } catch (error) {
        console.error('Error signing up:', error);
        return res.render('user/signup', { error: 'Error signing up. Please try again.', message: null });
    }
};

const verifyOtpPage = (req, res) => {
    try {
        // Retrieve email from session tempUser
        const email = req.session.tempUser ? req.session.tempUser.email : null;
        console.log( req.session.tempUser.email);
        
        res.render('user/verifyOtp', { error: null, email: email });
    } catch (error) {
        console.log("Error rendering verify OTP page:", error);
        res.render('user/verifyOtp', { error: 'Error rendering the page.',email:null });
    }
};


// OTP verification route
const verifyOtp = async (req, res) => {
    const { otp } = req.body;

    // Check if the OTP exists in the session and is valid
    if (!req.session.otp || new Date() > req.session.otpExpires) {
        return res.render('user/verifyOtp', { error: 'OTP is invalid or has expired.', message: null });
    }

    // Verify the OTP
    if (otp !== req.session.otp) {
        return res.render('user/verifyOtp', { error: 'Invalid OTP. Please try again.', message: null });
    }

    // If OTP is valid, save user details to the database
    const { name, email, password } = req.session.tempUser; // Get user data from session

    const user = new User({ name, email, password }); // Create new user
    await user.save(); // Save to database

    // Clear session data
    delete req.session.tempUser;
    delete req.session.otp;
    delete req.session.otpExpires;

    return res.render('user/login', { error: null, message: 'Signup successful! log in Now.' });
};

const resendOtp = async (req, res) => {
    const { email } = req.body; // Get email from the request body

    try {
        // Check if the user exists
        // const existingUser = await User.findOne({ email });
        // if (!existingUser) {
        //     return res.status(404).json({ success: false, message: 'User does not exist' });
        // }

        // Generate a new OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // Generate a new 6-digit OTP
        req.session.otp = otp; // Update session with new OTP
        req.session.otpExpires = new Date(Date.now() + 60 * 1000); // Update expiry to 1 minute

        await sendOtpToEmail(email, otp); // Send the new OTP to the user's email

        return res.status(200).json({ success: true, message: 'OTP resent successfully!' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, message: 'Error resending OTP. Please try again.' });
    }
};





const userLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if the user exists
        const user = await User.findOne({ email: email, isAdmin: false});
        console.log("user details is ", user);
        
        if (user.isBlocked == true) {
            return res.render('user/login', { error: 'Your account is blocked', message: null })
        }

        if (user == null) {
            return res.render('user/login',{error:'Fileds are required',message:""})
        }

        if (user) {
            // Compare the provided password with the stored hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            console.log(isMatch);
            const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  // Fetch products from the database

            if (isMatch) {
                // Store user information in session
                req.session.user = {
                    id: user._id,
                    email: user.email,
                    
                };

                
                if (user.id) {
                
                   
                    return res.redirect('/home'); // User home page
                
                } else {
                    // Password does not match
                    return res.render('user/login', { error: "Invalid password.",message:"" })
                }
            } else {
                // User not found
                return res.render('user/login', { error: 'Invalid email or password.',message:"" });
            }
        }
    } catch (error) {
        console.error(error); // Log the error for debugging
        return res.render('user/login', { error: 'An error occurred. Please try again.' });
    }
}

const googleLogin = (req, res) => {

    if (req.user.isBlocked == true) {
        return res.render('user/login', { error: 'Your account is blocked', message: null })
    }

    if (req.isAuthenticated()) {
    
        req.session.user = req.user; 
        
        
        
        return res.redirect('/home');
    }

    return res.redirect('/login?error=Authentication failed');
};
    const getHome = async (req, res) => {
        try {
            const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  
            res.render('user/home', { product });
        } catch (error) {
            console.error('Error fetching products or categories:', error);
            res.status(500).send("Error fetching products or categories");
        }
    }


const getLand = async (req, res) => {
    try {
        const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  // Fetch products from the database
        // const categories = await Category.find({ isActive: true });  // Fetch only active categories
        console.log(product);
        
        res.render('user/landing', { product });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");   
    }
}

const getProducts = async (req, res) => {
    try {
        const products = await Book.find({ isActive: true });  // Fetch products from the database
        const categories = await Category.find({ isActive: true });  // Fetch only active categories
        res.render('user/products', { products, categories });  // Pass the products and active categories to the EJS template
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");
    }
};

const getProductDetail = async (req, res) => {
    try {
        const productId = req.params.id; // Get the ID from the URL
        console.log(productId);
        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: "Bad request" });
        }

        // Convert the ID to an ObjectId before querying
        const product = await Book.findById(productId).populate('categoryId');
        const products = await Book.find()
        if (!product) {
            return res.status(404).send('Product not found');
        }
        console.log(product);
        res.render('user/product-details', { product,products });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};











module.exports = {
    userSignup,
    userLogin,
    getProducts,
    getProductDetail,
    getHome,
    getLand,
    googleLogin,
    verifyOtp,
    resendOtp,
    verifyOtpPage


}