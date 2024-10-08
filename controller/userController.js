const User = require("../models/userModel")
const router = require("../route/adminRoute")
const bcrypt = require('bcrypt')
const Book = require('../models/productModel');
const axios = require('axios');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
//For User Signup
const userSignup = async (req, res) => {
    const { name, email, password, confirmPassword } = req.body
    
    if (password !== confirmPassword) {
        return res.render('user/signup', { error: 'Passwords do not match.',message:null });
    }
    try {
        const existingUser = await User.findOne({ email })
        if (existingUser) {
            return res.render('user/signup',{error:'User Already Exist',message:null})
        }

        const user = new User({ name, email, password })
        await user.save()
        res.render('user/signup',{error:null,message:'Signup Succesful Please  Login'})
    } catch {
        res.render('user/signup', { error: 'Error signing up. Please try again.' });
    }
}

const userLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        // Check if the user exists
        const user = await User.findOne({ email: email });
        console.log(user);

        if (user) {
            // Compare the provided password with the stored hashed password
            const isMatch = await bcrypt.compare(password, user.password);
            console.log(isMatch);

            if (isMatch) {
                // Check if the user is an admin or regular user
                if (user.isAdmin) {
                    return res.render('admin/home'); // Use return to stop further execution
                } else {
                    return res.render('user/home'); // Use return to stop further execution
                }
            } else {
                // Password does not match
                return res.render('user/login', { error: "Invalid password." });
            }
        } else {
            // User not found
            return res.render('user/login', { error: 'Invalid email or password.' });
        }
    } catch (error) {
        console.error(error); // Log the error for debugging
        return res.render('user/login', { error: 'An error occurred. Please try again.' });
    }
}

const getProducts = async (req, res) => {
    try {
        const products = await Book.find();  // Fetch products from the database
        res.render('user/products', { products });  // Pass the products to the EJS template
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send("Error fetching products");
    }
};







module.exports = {
    userSignup,
    userLogin,
    getProducts,

}