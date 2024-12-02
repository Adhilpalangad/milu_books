const User = require("../models/userModel")
const router = require("../route/adminRoute")
const bcrypt = require('bcrypt')
const mongoose = require("mongoose")
const Book = require('../models/productModel');
const Address = require('../models/addressModel')
const axios = require('axios');
require('dotenv').config();
const { OAuth2Client } = require('google-auth-library')
const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);
const Category = require('../models/categoryModel');
const nodemailer = require('nodemailer');
const sendOtpToEmail = require('../config/sendOtpToEmail');
const Wishlist = require('../models/wishListModel')
const Offer = require('../models/offerModel')
const Wallet = require('../models/walletModel');
const Cart = require('../models/cartModel')

const renderSignupPage =  (req, res) => {
    res.render('user/signup', { error: null, message: null });
}

//Signup

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}


const userSignup = async (req, res) => {
    const { name, email, password, confirmPassword, referralCode } = req.body;

    if (!name || !email || !password || !confirmPassword) {
        return res.render('user/signup', { error: 'All fields are required.', message: null });
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
            return res.render('user/signup', { error: 'User already exists.', message: null });
        }

        let referredBy = null;

        // Validate referral code and process referral bonus
        if (referralCode) {
            const referrer = await User.findOne({ referralCode });
            if (!referrer) {
                return res.render('user/signup', { error: 'Invalid referral code.', message: null });
            }

            referredBy = referrer._id;

            // Credit ₹100 to the referrer's wallet
            let wallet = await Wallet.findOne({ userId: referredBy });
            if (!wallet) {
                wallet = new Wallet({ userId: referredBy });
            }

            wallet.balance += 100; // Add referral bonus to the wallet
            wallet.transactions.push({
                amount: 100,
                transactionType: 'credit',
                message: 'Referral bonus credited for referring a new user.',
            });

            await wallet.save();
        }

        // Save temp user in session for OTP verification
        req.session.tempUser = { name, email, password, referredBy };
        console.log('Temp user set in session:', req.session.tempUser);

        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        req.session.otp = otp;
        req.session.otpExpires = new Date(Date.now() + 60 * 1000);
        console.log('OTP is', otp);

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
        // Check if the user exists
        const user = await User.findOne({ email: email, isAdmin: false });

        if (!user) {
            // User not found
            return res.render('user/login', { error: 'Invalid email or password.', message: "" });
        }

        // Check if the user is blocked
        if (user.isBlocked) {
            return res.render('user/login', { error: 'Your account is blocked.', message: null });
        }

        // Validate password
        const isMatch = await bcrypt.compare(password, user.password);
        console.log("is match is ", isMatch);
        
        if (!isMatch) {
            // Password does not match
            
            return res.render('user/login', { error: 'Invalid email or password.', message: "" });
        }

        // Set user session
        req.session.user = {
            id: user._id,
            email: user.email,
        };

        // Redirect to home
        return res.redirect('/home');

    } catch (error) {
        console.error("Login Error:", error);

        // Handle unexpected errors
        return res.render('user/login', { error: 'An error occurred. Please try again.', message: "" });
    }
};


//google login

const googleLogin = (req, res) => {
    if (req.isAuthenticated()) {
        if (req.user.isBlocked) {
            return res.render('user/login', { error: 'Your account is blocked', message: null });
        }

        // Store user in session after successful authentication
        req.session.user = { id: req.user._id }; // Ensure the ID is properly stored in the session
        return res.redirect('/home');
    }

    return res.redirect('/login?error=Authentication failed');
};



//home page

const getHome = async (req, res) => {
    try {
        const userId = req.session.user?.id;
        
        // Fetch active products and populate their category
        const products = await Book.find({ isActive: true }).populate('categoryId', 'name');
        const wallet = await Wallet.find({ userId });

        // Fetch active offers
        const offers = await Offer.find({ isActive: true });

        const currentDate = new Date(); // Get the current date

        const productsWithOffers = products.map(product => {
            let maxDiscountedPrice = product.price; // Start with the original price
            let hasDiscount = false;
        
            offers.forEach(offer => {
                const isOfferActive = !offer.validUntil || offer.validUntil > currentDate; // Check if the offer is still valid
                const isProductEligible = offer.applicableProducts.some(id => id.equals(product._id)); // Check if product ID is in applicableProducts
                const isCategoryEligible = offer.applicableCategories.some(id => id.equals(product.categoryId?._id)); // Check if category ID is in applicableCategories
        
                if (isOfferActive && (isProductEligible || isCategoryEligible)) {
                    const calculatedDiscountedPrice = product.price - (product.price * (offer.discount / 100));
        
                    // Update maxDiscountedPrice if a better discount is found
                    if (calculatedDiscountedPrice < maxDiscountedPrice) {
                        maxDiscountedPrice = calculatedDiscountedPrice;
                        hasDiscount = true;
                    }
                }
            });
        
            return {
                ...product.toObject(),
                discountedPrice: maxDiscountedPrice, // Final discounted price (if applicable)
                hasDiscount // Indicates if any discount was applied
            };
        });
        
        // Fetch distinct active categories
        const categories = await Category.find({ isActive: true });

        // Fetch wishlist status
        const wishlistStatus = await Wishlist.find({ userId });

        // Render the page and pass categories, products with offers, and wishlist status to the view
        res.render('user/home', { 
            products: productsWithOffers, 
            userId, 
            categories, 
            wallet, 
            wishlistStatus: wishlistStatus.map(status => status.productId.toString()) // Convert IDs to strings for easy comparison
        });
    } catch (error) {
        console.error('Error fetching home page data:', error);
        req.flash('error', 'An unexpected error occurred while loading the home page.');
        res.redirect('/error');
    }
};




//landing page

const getLand = async (req, res) => {
    try {
        const product = await Book.find({ isActive: true }).populate('categoryId', 'name');  
        // const categories = await Category.find({ isActive: true });  
        
        res.render('user/landing', { product });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");   
    }
}

//product page

const getProducts = async (req, res) => {
    try {
        const { sort, category, search, page = 1 } = req.query;
        const filter = { isActive: true }; // Only show active products
        const limit = 12;
        const skip = (page - 1) * limit;
        const userId = req.session.user.id; // Assuming userId is stored in the session


        const cart = await Cart.findOne({ userId: userId }, { items: 1 });
        const itemCount = cart ? cart.items.length : 0;
        
                if (category && category !== 'all') {
            filter.categoryId = category; // Ensure category field matches schema
        }

        if (search) {
            filter.title = new RegExp(search, 'i'); // Case-insensitive search on title
        }

        let sortCriteria = {};
        switch (sort) {
            case 'price-low-high':
                sortCriteria.price = 1;
                break;
            case 'price-high-low':
                sortCriteria.price = -1;
                break;
            case 'average-ratings':
                sortCriteria.averageRating = -1;
                break;
            case 'new-arrivals':
                sortCriteria.createdAt = -1;
                break;
            case 'a-z':
                sortCriteria.title = 1;
                break;
            case 'z-a':
                sortCriteria.title = -1;
                break;
            case 'in-stock':
                filter.stock = { $gt: 0 };
                break;
        }

        const offers = await Offer.find({ isActive: true });

        const [products, totalProducts] = await Promise.all([
            Book.find(filter).sort(sortCriteria).skip(skip).limit(limit).populate('categoryId', 'name'),
            Book.countDocuments(filter)
        ]);

        const totalPages = Math.ceil(totalProducts / limit);

        const currentDate = new Date();
        const productsWithOffers = products.map(product => {
            let maxDiscountedPrice = product.price; // Start with the original price
            let hasDiscount = false;

            offers.forEach(offer => {
                const isOfferActive = !offer.validUntil || offer.validUntil > currentDate; // Check if the offer is still valid
                const isProductEligible = offer.applicableProducts.some(id => id.equals(product._id)); // Check if product ID is in applicableProducts
                const isCategoryEligible = offer.applicableCategories.some(id => id.equals(product.categoryId?._id)); // Check if category ID is in applicableCategories

                if (isOfferActive && (isProductEligible || isCategoryEligible)) {
                    const calculatedDiscountedPrice = product.price - (product.price * (offer.discount / 100));

                    if (calculatedDiscountedPrice < maxDiscountedPrice) {
                        maxDiscountedPrice = calculatedDiscountedPrice;
                        hasDiscount = true;
                    }
                }
            });

            return {
                ...product.toObject(),
                discountedPrice: maxDiscountedPrice, // Final discounted price (if applicable)
                hasDiscount // Indicates if any discount was applied
            };
        });

        if (req.xhr) {
            return res.json({
                products: productsWithOffers,
                totalPages,
                currentPage: Number(page)
            });
        }

        res.render('user/products', {
            product: productsWithOffers, // Pass updated products with discount info
            categories: await Category.find({ isActive: true }),
            currentPage: page,
            totalPages,
            sort,
            category,
            search,
            itemCount
        });
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).send("Error fetching products");
    }
};




//product details


const getProductDetail = async (req, res) => {
    try {
        const productId = req.params.id; 

        if (!mongoose.isValidObjectId(productId)) {
            return res.status(400).render('404', { message: "Bad request: Invalid product ID" });
        }

        const product = await Book.findOne({ _id: productId, isActive: true }).populate('categoryId');

        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' });
        }

        const offers = await Offer.find({ isActive: true });

        let discountedPrice = null;

        offers.forEach(offer => {
            const isProductEligible = offer.applicableProducts.includes(product._id);
            const isCategoryEligible = offer.applicableCategories.includes(product.categoryId?.name);

            if (isProductEligible || isCategoryEligible) {
                discountedPrice = product.price - (product.price * (offer.discount / 100));
            }
        });

        const productWithOffer = {
            ...product.toObject(),
            discountedPrice: discountedPrice || product.price,
            hasDiscount: !!discountedPrice
        };

        const products = await Book.find({ isActive: true });

        res.render('user/product-details', { product: productWithOffer, products });
    } catch (error) {
        console.error(error);
        res.status(500).render('404', { message: 'Server error' });
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

const getProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;

        if (!userId) {
            return res.status(401).send('User not authenticated');
        }

        const user = await User.findById(userId);

        const addresses = await Address.find({ userId: userId });
        const currentUrl = req.url;
        res.render('user/profilePersonal', {
            orders: '',
            currentUrl ,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            gender: user.gender || '', // Assuming gender was added
            addresses: addresses,
            referralCode: user.referralCode || '',
            });
    } catch (error) {
        res.status(500).send('Error fetching user data');
    }
};




const profileEdit = async (req, res) => {
    try {
        const userId = req.session.user.id; // Get the logged-in user's ID
        const { name, gender } = req.body; // Extract name and gender from the request body

        // Update the user data in the database
        await User.findByIdAndUpdate(userId, { name, gender });

        // Redirect back to the profile page
        res.redirect(`/profile`);
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).send('Error updating profile');
    }
};




const getAddresses = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const addresses = await Address.find({ userId: userId }); // Fetch addresses of the user
        const currentUrl = req.url;
        res.render('user/profileAddress', {
            orders: '',
            currentUrl,
            name: addresses.name,
            email: addresses.email,
            phone: addresses.phone,
            gender: addresses.gender,
            addresses // Pass addresses to the view
        });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error fetching addresses');
    }
};

// Add new address
const addAddress = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { street, city, state, country, postalCode, isDefault, fullName } = req.body;

        // If isDefault is true, unset previous default addresses
        if (isDefault) {
            await Address.updateMany({ userId, isDefault: true }, { isDefault: false });
        }

        // Create new address
        const newAddress = new Address({
            userId,
            street,
            city,
            state,
            country,
            postalCode,
            fullName,
            isDefault: isDefault || false,
        });

        await newAddress.save();

        // Check if the request is AJAX (from checkout page)
        if (req.xhr) {
            return res.status(201).json(newAddress); // Return the new address as JSON
        } else {
            res.redirect('/profile/addresses'); // For non-AJAX requests, redirect as usual
        }
    } catch (error) {
        console.error(error);
        if (req.xhr) {
            return res.status(500).json({ message: 'Error adding address' });
        } else {
            res.status(500).send('Error adding address');
        }
    }
};

const editAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const { street, city, state, country, postalCode, isDefault } = req.body;

        const updatedAddress = await Address.findByIdAndUpdate(addressId, {
            street,
            city,
            state,
            country,
            postalCode,
            isDefault: isDefault || false
        });

        if (isDefault) {
            await Address.updateMany({ _id: { $ne: addressId }, userId: req.session.user.id }, { isDefault: false });
        }

        res.redirect('/profile/addresses');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error updating address');
    }
};


// Delete address
const deleteAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        await Address.findByIdAndDelete(addressId);
        res.redirect('/profile/addresses');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error deleting address');
    }
};

// Send OTP for Forgot Password
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    const user = await User.findOne({ email });
    if (!user) {
        return res.render('user/forgotPassword', { error: 'User not found!' });
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.forgotPasswordOtp = otp;
    req.session.otpExpires = new Date(Date.now() + 60 * 1000); // OTP valid for 1 minute
    req.session.userEmail = email; // Store the user's email in the session

    console.log(`OTP sent to ${email}: ${otp}`); // This will log the OTP

    await sendOtpToEmail(email, otp);
    
    return res.render('user/verifyForgotPasswordOtp'); // Redirect to verify OTP page
};


// Verify OTP for Forgot Password
const verifyForgotPasswordOtp = async (req, res) => {
    const { otp } = req.body;
    console.log('getted otp',otp)
    if (!req.session.forgotPasswordOtp || new Date() > req.session.otpExpires) {
        return res.render('user/verifyForgotPasswordOtp', { error: 'OTP is invalid or has expired.', email: req.session.resetEmail });
    }

    if (otp !== req.session.forgotPasswordOtp) {
        return res.render('user/verifyForgotPasswordOtp', { error: 'Invalid OTP. Please try again.', email: req.session.resetEmail });
    }
    res.render('user/resetPassword');
};

// Reset Password
const resetPassword = async (req, res) => {
    const { newPassword } = req.body;
    const email = req.session.userEmail;
    console.log(`password ${newPassword} and email is ${email}`)
    if (!email) {
        return res.render('user/login', { error: 'Invalid request. Please try again.',message:"" });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await User.findOneAndUpdate({ email }, { password: hashedPassword });

    delete req.session.forgotPasswordOtp;
    delete req.session.otpExpires;
    delete req.session.resetEmail;

    res.render('user/login', { error: null, message: 'Password reset successful. You can now log in.' });
};


const forgotPasswordPage = (req, res) => {
    res.render('user/forgotPassword', { error: null });
};


const verifyOtpPass = (req, res) => {
    const email = req.session.userEmail || null; // Retrieve the email from the session
    res.render('user/verifyForgotPasswordOtp', { error: null, email });
};

const resetPasswordPage = (req, res) => {
    res.render('user/resetPassword', { error: null });
};

// Controller to get wishlist items
const getWishlistItems = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const limit = 20; // Number of items per page
        const page = parseInt(req.query.page) || 1;
        const skip = (page - 1) * limit;

        const wishlistItems = await Wishlist.find({ userId })
            .populate({
                path: 'productId',
                select: '_id title images price'
            })
            .sort({ createdAt: -1 }) // Sort by most recent additions
            .skip(skip)
            .limit(limit);

        const totalItems = await Wishlist.countDocuments({ userId });

        res.render('user/wishlist', {
            wishlistItems,
            currentPage: page,
            totalPages: Math.ceil(totalItems / limit),
            hasNextPage: page < Math.ceil(totalItems / limit)
        });
    } catch (error) {
        console.error('Error fetching wishlist items:', error);
        req.flash('error', 'Failed to load wishlist items.');
        res.redirect('/error');
    }
};



const addBooksWishlist = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const productId = req.params.id;

        const existingWishlistItem = await Wishlist.findOne({ userId, productId });

        if (existingWishlistItem) {
            return res.json({ success: false, message: 'Product already in wishlist' });
        }

        const newWishlistItem = new Wishlist({
            userId,
            productId
        });

        await newWishlistItem.save();

        const wishlistStatus = await Wishlist.find({ userId }).select('_id productId').lean();

        res.json({
            success: true,
            message: 'Product added to wishlist',
            wishlistStatus
        });
    } catch (error) {
        console.error('Error adding product to wishlist:', error);
        res.status(500).json({ success: false, message: 'An unexpected error occurred.' });
    }
};


const removeWishlist = async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user.id;
        await Wishlist.findOneAndDelete({ userId, productId });
        
        res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        res.redirect('/error'); 
    }
};


const getWallet = async (req, res) => {
    try {
        console.log(req.session);
        
        const userId = req.session.user.id;
        const page = parseInt(req.query.page) || 1;
        const limit = 10;
        const skip = (page - 1) * limit;

        const wallet = await Wallet.findOne({ userId });
        if (!wallet) {
            return res.render('user/wallet', { 
                wallet: null, 
                message: 'Wallet not found',
                currentPage: 1,
                totalPages: 1
            });
        }

        const totalTransactions = wallet.transactions.length;
        const totalPages = Math.ceil(totalTransactions / limit);

        const paginatedTransactions = wallet.transactions
            .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sort by date descending
            .slice(skip, skip + limit);

        // Create a new wallet object with paginated transactions
        const paginatedWallet = {
            ...wallet.toObject(),
            transactions: paginatedTransactions
        };

        res.render('user/wallet', { 
            wallet: paginatedWallet,
            currentPage: page,
            totalPages,
            totalTransactions
        });
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};

const contactPage = (req, res) => {
    res.render('user/contact')
}

const aboutPage = (req, res) => {
    res.render('user/about')
}

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
    logout,
    getProfile,
    profileEdit,
    getAddresses,
    addAddress,
    editAddress,
    deleteAddress,
    forgotPassword,
    resetPassword,
    verifyForgotPasswordOtp,
    forgotPasswordPage,
    verifyOtpPass,
    resetPasswordPage,
    getWishlistItems,
    addBooksWishlist,
    removeWishlist,
    getWallet,
    contactPage,
    aboutPage
    
}