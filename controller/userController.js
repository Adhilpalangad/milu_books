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


const renderSignupPage =  (req, res) => {
    res.render('user/signup', { error: null, message: null });
}

//Signup

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const userSignup = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body;

    if (!name && !email && !password && !confirmPassword) {
        return res.render('user/signup', { error: null, message: null });
    }

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

        req.session.tempUser = { name, email, password }; 
        console.log('Temp user set in session :', req.session.tempUser);
        
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
        req.session.otp = otp;
        req.session.otpExpires = new Date(Date.now() + 60 * 1000); 
        console.log('otp is',otp);
        
        await sendOtpToEmail(email, otp); 
        
        return res.redirect('/verify-otp'); 
    } catch (error) {
        console.error('Error signing up:', error);
        return res.render('user/signup', { error: 'Error signing up. Please try again.', message: null });
    }
};

//verify page

const verifyOtpPage = (req, res) => {
    try {
        const email = req.session.tempUser ? req.session.tempUser.email : null;
        console.log( req.session.tempUser.email);
        
        res.render('user/verifyOtp', { error: null, email: email });
    } catch (error) {
        console.log("Error rendering verify OTP page:", error);
        res.render('user/verifyOtp', { error: 'Error rendering the page.',email:null });
    }
};

//verify otp

const verifyOtp = async (req, res) => {
    const { otp } = req.body;

    
    if (!req.session.otp || new Date() > req.session.otpExpires) {
        return res.render('user/verifyOtp', { error: 'OTP is invalid or has expired.', message: null,email:null });
    }

    
    if (otp !== req.session.otp) {
        return res.render('user/verifyOtp', { error: 'Invalid OTP. Please try again.', message: null,email:null });
    }

    
    const { name, email, password } = req.session.tempUser; 

    const user = new User({ name, email, password }); 
    await user.save(); 

    delete req.session.tempUser;
    delete req.session.otp;
    delete req.session.otpExpires;

    return res.render('user/login', { error: null, message: 'Signup successful! log in Now.' });
};

//resend otp

const resendOtp = async (req, res) => {
    const { email } = req.body; 

    try {
        // Check if the user exists
        // const existingUser = await User.findOne({ email });
        // if (!existingUser) {
        //     return res.status(404).json({ success: false, message: 'User does not exist' });
        // }

     
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
        req.session.otp = otp; 
        req.session.otpExpires = new Date(Date.now() + 60 * 1000); 

        await sendOtpToEmail(email, otp); 
        console.log(otp);
        
        return res.status(200).json({ success: true, message: 'OTP resent successfully!' });
    } catch (error) {
        console.error('Error resending OTP:', error);
        return res.status(500).json({ success: false, message: 'Error resending OTP. Please try again.' });
    }
};



//user login

const userLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email: email, isAdmin: false});
        console.log("user details is ", user);
        
        if (user.isBlocked == true) {
            return res.render('user/login', { error: 'Your account is blocked', message: null })
        }

        if (user == null) {
            return res.render('user/login',{error:'Fileds are required',message:""})
        }

        if (user) {
            const isMatch = await bcrypt.compare(password, user.password);
            console.log(isMatch);
            const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  

            if (isMatch) {
                req.session.user = {
                    id: user._id,
                    email: user.email,
                    
                };

                
                if (user.id) {
                
                   
                    return res.redirect('/home'); 
                
                } else {
                    return res.render('user/login', { error: "Invalid password.",message:"" })
                }
            } else {
                return res.render('user/login', { error: 'Invalid email or password.',message:"" });
            }
        }
    } catch (error) {
        console.error(error); 
        return res.render('user/login', { error: 'An error occurred. Please try again.' });
    }
}

//google login

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

//home page

const getHome = async (req, res) => {
        try {
            const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  
            res.render('user/home', { product });
        } catch (error) {
            console.error('Error fetching products or categories:', error);
            res.status(500).send("Error fetching products or categories");
        }
    }

//landing page

const getLand = async (req, res) => {
    try {
        const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  
        // const categories = await Category.find({ isActive: true });  
        console.log(product);
        
        res.render('user/landing', { product });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");   
    }
}

//product page

const getProducts = async (req, res) => {
    try {
        const products = await Book.find({ isActive: true });  
        const categories = await Category.find({ isActive: true });  
        res.render('user/products', { products, categories });  
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");
    }
};

//product details

const getProductDetail = async (req, res) => {
    try {
        const productId = req.params.id; 
        console.log(productId);
        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).json({ message: "Bad request" });
        }


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

const renderLoginPage = (req, res) => {
    res.render('user/login', { error: "", message: "" });
}

const logout = (req, res) => {
    try {
        req.session.destroy((err) => {
            if (err) {
                console.log('Error destroying session:', err);
                return res.redirect('/?error=Logout failed');
            }
            return res.redirect('/login');
        });
    } catch (error) {
        console.log("Error in logout process:", error);
        return res.redirect('/?error=Something went wrong');
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
    verifyOtpPage,
    renderSignupPage,
    renderLoginPage,
    logout


}