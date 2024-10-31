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

const renderSignupPage =  (req, res) => {
    res.render('user/signup', { error: null, message: null });
}

//Signup

function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

const userSignup = async (req, res) => {
    console.log(req.body);
    
    const { name, email, password, confirmPassword } = req.body;

    // if ({ name: '', email: '', password: '', confirmPassword: '' }) {
    //     return res.render('user/signup', { error: 'Fields are required.', message: null });
    // }

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
        return res.render('user/login', { error: 'An error occurred. Please try again.',message:"" });
    }
}

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
        
        // Fetch active offers
        const offers = await Offer.find({ isActive: true });

        const currentDate = new Date(); // Get the current date

        const productsWithOffers = products.map(product => {
            let maxDiscountedPrice = product.price; // Start with the original price
            let hasDiscount = false;
        
            offers.forEach(offer => {
                const isOfferActive = !offer.validUntil || offer.validUntil > currentDate; // Check if the offer is still valid
                const isProductEligible = offer.applicableProducts.includes(product._id);
                const isCategoryEligible = offer.applicableCategories.includes(product.categoryId?.name);
        
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

        // Render the page and pass categories and products with offers to the view
        res.render('user/home', { products: productsWithOffers, userId, categories });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        res.status(500).send("Error fetching products or categories");
    }
};



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
        const { sort, category, search } = req.query;  // Get sort, category, and search from query parameters
        const filter = { isActive: true };     // Default filter for active products

        // Filter products by category if a category is selected
        if (category && category !== 'all') {
            filter.categoryId = category;  // Assuming categoryId in Book schema references Category
        }

        // Filter products by search term if provided
        if (search) {
            filter.title = new RegExp(search, 'i'); // Case-insensitive search on title
        }

        let sortCriteria = {};

        // Define sorting logic based on the sort option
        switch (sort) {
            case 'price-low-high':
                sortCriteria.price = 1;   // Ascending
                break;
            case 'price-high-low':
                sortCriteria.price = -1;  // Descending
                break;
            case 'average-ratings':
                sortCriteria.averageRating = -1;  // Highest rating first
                break;
            case 'new-arrivals':
                sortCriteria.createdAt = -1;  // Newest first
                break;
            case 'a-z':
                sortCriteria.title = 1;   // Alphabetical order (A-Z)
                break;
            case 'z-a':
                sortCriteria.title = -1;  // Reverse alphabetical order (Z-A)
                break;
            case 'in-stock':
                filter.stock = { $gt: 0 };  // Only products with stock > 0
                break;
            default:
                sortCriteria = {};  // Default sorting (no specific order)
                break;
        }

        // Fetch active products and populate their category
        const products = await Book.find(filter).sort(sortCriteria).populate('categoryId', 'name');

        // Fetch active offers
        const offers = await Offer.find({ isActive: true });

        // Calculate offer price for applicable products
        const productsWithOffers = products.map(product => {
            let discountedPrice = null;

            offers.forEach(offer => {
                const isProductEligible = offer.applicableProducts.includes(product._id);
                const isCategoryEligible = offer.applicableCategories.includes(product.categoryId?.name);

                if (isProductEligible || isCategoryEligible) {
                    discountedPrice = product.price - (product.price * (offer.discount / 100));
                }
            });

            return {
                ...product.toObject(),
                discountedPrice: discountedPrice || product.price, // Use discounted price if applicable, otherwise original price
                hasDiscount: !!discountedPrice // Boolean to check if discount was applied
            };
        });

        // Fetch distinct active categories
        const categories = await Category.find({ isActive: true });

        // If the request is an AJAX call, send JSON response
        if (req.xhr) {
            return res.json({ products: productsWithOffers, categories });
        }

        // Render page for normal request
        res.render('user/products', { product: productsWithOffers, categories });
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

        // Fetch product details and populate category
        const product = await Book.findById(productId).populate('categoryId');

        // Fetch active offers
        const offers = await Offer.find({ isActive: true });

        // Calculate the discounted price for the product
        let discountedPrice = null;
        offers.forEach(offer => {
            const isProductEligible = offer.applicableProducts.includes(product._id);
            const isCategoryEligible = offer.applicableCategories.includes(product.categoryId?.name);

            if (isProductEligible || isCategoryEligible) {
                discountedPrice = product.price - (product.price * (offer.discount / 100));
            }
        });

        // Prepare the product object with offer details
        const productWithOffer = {
            ...product.toObject(),
            discountedPrice: discountedPrice || product.price, // Use discounted price if applicable, otherwise original price
            hasDiscount: !!discountedPrice // Boolean to check if discount was applied
        };

        if (!product) {
            return res.status(404).send('Product not found');
        }

        const products = await Book.find(); // Fetch other products if needed

        res.render('user/product-details', { product: productWithOffer, products });
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

const getProfile = async (req, res) => {
    try {
        const userId = req.session.user.id;

        if (!userId) {
            return res.status(401).send('User not authenticated');
        }

        // Fetch the user details from the database
        const user = await User.findById(userId);

        // Fetch the user's saved addresses
        const addresses = await Address.find({ userId: userId });
        const currentUrl = req.url;
        // Render the profile page with user details and addresses
        res.render('user/profilePersonal', {
            orders: '',
            currentUrl ,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            gender: user.gender || '', // Assuming gender was added
            addresses: addresses // Pass the fetched addresses to the view
        });
    } catch (error) {
        res.status(500).send('Error fetching user data');
    }
};




const profileEdit = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const { name, phone, gender } = req.body;

        // Update user details in the database
        await User.findByIdAndUpdate(userId, { name, phone, gender });

        // Redirect back to the profile page
        res.redirect('/profile');
    } catch (error) {
        console.log('Error updating profile:', error);
        res.status(500).send('Error updating profile');
    }
};

// Fetch user addresses and render profile page
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
        const { street, city, state, country, postalCode, isDefault,fullName } = req.body;

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
            isDefault: isDefault || false
        });

        await newAddress.save();
        res.redirect('/profile/addresses');
    } catch (error) {
        console.log(error);
        res.status(500).send('Error adding address');
    }
};

// Edit existing address
const editAddress = async (req, res) => {
    try {
        const { addressId } = req.params;
        const { street, city, state, country, postalCode, isDefault } = req.body;

        // Update address details
        const updatedAddress = await Address.findByIdAndUpdate(addressId, {
            street,
            city,
            state,
            country,
            postalCode,
            isDefault: isDefault || false
        });

        // If isDefault is set, unset other default addresses
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
// POST method to handle the forgot password request
const forgotPassword = async (req, res) => {
    const { email } = req.body;

    // Check if user exists
    const user = await User.findOne({ email });
    if (!user) {
        return res.render('user/forgotPassword', { error: 'User not found!' });
    }

    // Generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    req.session.forgotPasswordOtp = otp;
    req.session.otpExpires = new Date(Date.now() + 60 * 1000); // OTP valid for 1 minute
    req.session.userEmail = email; // Store the user's email in the session

    // Log the OTP to the console for debugging purposes
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




    // Proceed to reset password
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

    // Update the user's password
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
        const wishlistItems = await Wishlist.find({ userId })
            .populate({
                path: 'productId',
                select: '_id title images price'
            });
        
        console.log('wish::::::::::', wishlistItems);
        res.render('user/wishlist', { wishlistItems });
    } catch (error) {
        console.error(error);
        res.redirect('/error');
    }
};


const addBooksWishlist = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const productId = req.params.id;

        console.log('product id from params', productId);

        // Check if the product is already in the user's wishlist
        const existingWishlistItem = await Wishlist.findOne({ userId, productId });
        console.log('existing id', existingWishlistItem);

        if (existingWishlistItem) {
            return res.json({ success: false, message: 'Product already in wishlist' });
        }

        // Create a new wishlist entry
        const newWishlistItem = new Wishlist({
            userId,
            productId
        });

        await newWishlistItem.save();
        res.json({ success: true, message: 'Product added to wishlist' });
    } catch (error) {
        console.error('Error adding product to wishlist:', error);
        res.status(500).json({ success: false, message: 'Error adding product to wishlist' });
    }
};

const removeWishlist = async (req, res) => {
    try {
        const productId = req.params.id;
        const userId = req.session.user.id;
        console.log('user ', userId)
        // Use `findOneAndDelete` directly on the `Wishlist` model with both filters
        await Wishlist.findOneAndDelete({ userId, productId });
        
        res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        res.redirect('/error'); // Optionally handle error by redirecting to an error page
    }
};

 // Adjust the path as necessary

const getWallet = async (req, res) => {

    try {
        console.log(req.session);
        
        const userId = req.session.user.id;
                console.log(userId);
        
        
        const wallet = await Wallet.findOne({ userId })
        console.log('wallet details ' , wallet);
        if (!wallet) {
            return res.render('user/wallet', { wallet: null, message: 'Wallet not found' });
        }

        // Pass the wallet data to the template
        res.render('user/wallet', { wallet });
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
    getWallet

    
}