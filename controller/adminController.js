const User = require("../models/userModel");
const Book = require('../models/productModel'); 
const bcrypt = require('bcrypt')
const multer = require('multer');
const path = require('path');
const upload = require('../config/multerConfig');
const mongoose = require("mongoose")
const fs = require('fs');
const Category = require('../models/categoryModel');
const Order = require('../models/orderModel')
const Coupon = require('../models/couponModel');
const Offer = require('../models/offerModel')
const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const Wallet = require('../models/walletModel')
//login page

const login = (req, res) => {
    try {
        res.render("admin/login", {error:""})
    } catch (error) {
        console.log("admin login broke",error)
    }
}

//get login details

const postLogin = async (req, res) => {
    const { email, password } = req.body;
    try {
        
        const user = await User.findOne({ email: email, isAdmin: true });

        if (user) {
           
            const isMatch = await bcrypt.compare(password, user.password);

            if (isMatch) {
             
                req.session.admin = {
                    id: user._id,
                    email: user.email
                };

                return res.redirect('/admin/home');
            } else {
                
                return res.render('admin/login', { error: 'Invalid email or password.' });
            }
        } else {
           
            return res.render('admin/login', { error: 'Admin account not found.' });
        }
    } catch (error) {
        console.error('Login error:', error); 
        return res.render('admin/login', { error: 'An error occurred. Please try again.' });
    }
};

//  users 
const adminUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; 
        const limit = 5; 
        const skip = (page - 1) * limit; 

        const totalUsers = await User.countDocuments({ isAdmin: false });

       
        const userData = await User.find({ isAdmin: false })
                                   .skip(skip)
                                   .limit(limit);

       
        const totalPages = Math.ceil(totalUsers / limit);

       
        res.render('admin/users', {
            users: userData,
            currentPage: page,   
            totalPages: totalPages 
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('An error occurred');
    }
};

// Block user
const blockUser = async (req, res) => {
    try {
        const { userId } = req.body;  
        console.log('Attempting to block user with ID:', userId); 

        if (!userId) {
            console.error('User ID is missing!'); 
            return res.status(400).send('User ID is required');
        }

        await User.findByIdAndUpdate(userId, { isBlocked: true });
        req.session.user=null
        res.redirect('/admin/users');  
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).send('Server Error');
    }
};

// Unblock user
const unblockUser = async (req, res) => {
    try {
        const { userId } = req.body; 
        console.log('Attempting to unblock user with ID:', userId); 
        if (!userId) {
            console.error('User ID is missing!'); 
            return res.status(400).send('User ID is required');
        }

        await User.findByIdAndUpdate(userId, { isBlocked: false });

        res.redirect('/admin/users'); 
    } catch (error) {
        console.log('Error unblocking user:', error);
        res.redirect('/admin/users'); 
    }
};


    // Add books
    const addBooks = async (req, res) => {
        try {
            console.log('Form Data:', req.body);
    
            const { title, author, description, price, stock, categoryId } = req.body;
            const images = req.files;
    
            if (!title || !author || !description || !price || !stock || !categoryId) {
                return res.redirect('/admin/products?error=All fields are required');
            }
    
            if (isNaN(price) || Number(price) <= 0) {
                return res.redirect('/admin/products?error=Price must be a positive number');
            }
    
            if (isNaN(stock) || Number(stock) < 0) {
                return res.redirect('/admin/products?error=Stock must be a non-negative number');
            }
    
            if (!images || images.length === 0) {
                return res.redirect('/admin/products?error=No Image Uploaded');
            }
    
            const existingBook = await Book.findOne({ title });
            if (existingBook) {
                return res.status(409).json({ message: 'Book with this title already exists.' });
            }
    
            const newBook = new Book({
                title,
                author,
                description,
                price,
                stock,
                images: images.map(img => img.filename),
                categoryId,
            });
    
            await newBook.save();
    
            res.redirect('/admin/products?message=Book Added');
        } catch (error) {
            console.error('Error adding book:', error);
            res.redirect('/admin/products?error=Error Adding Book');
        }
    };
    
    //show books
    const getBooks = async (req, res) => {
        try {
            const { message , error} = req.query;
    
            const page = parseInt(req.query.page) || 1; 
            const limit = parseInt(req.query.limit) || 5; 
            const skip = (page - 1) * limit; 

            const books = await Book.find({ isActive: true })
                .populate('categoryId')  
                .skip(skip)
                .limit(limit);
    
            
    
            const totalBooks = await Book.countDocuments({ isActive: true });
            const totalPages = Math.ceil(totalBooks / limit); 
    
            
            res.render('admin/products', {
                books,
                message,
                error,
                currentPage: page,
                totalPages,
                limit,
                categories: await Category.find({ isActive: true }) 
            });
        } catch (error) {
            console.error('Error fetching books:', error);
            res.status(500).send('Error fetching books');
        }
    };
    
    
    
    
//edit books
    const editBooks = async (req, res) => {
        try {
            const { id, title, author, description, price, stock, removeImages } = req.body; 
            const images = req.files; 
    
            if (!mongoose.Types.ObjectId.isValid(id)) {
                return res.redirect('/admin/products?error=Invalid book ID format');
            }
    
            const book = await Book.findById(id);
            
            if (!book) {
                return res.redirect('/admin/products?error=Book Not Found');
            }
    
            book.title = title || book.title;
            book.author = author || book.author;
            book.description = description || book.description;
            book.price = price || book.price;
            book.stock = stock || book.stock; 
    
            if (images && images.length > 0) {
                if (removeImages) {
                    removeImages.forEach((image) => {
                        const imagePath = path.join(__dirname, '../uploads', image);
                        fs.unlink(imagePath, (err) => {
                            if (err) {
                                console.error(`Error deleting image: ${imagePath}`, err);
                            }
                        });
                    });
                }
    
                book.images = images.map(img => img.filename);
            }
    
            await book.save();
    
            res.redirect('/admin/products?message=Book Updated');
        } catch (error) {
            console.error('Error updating book:', error);
            res.redirect('/admin/products?error=Error updating book');
        }
    };
    
//soft delete book

const deleleBook = async (req, res) => {
    try {
        const { bookId } = req.body;
        console.log('Attempting to delete book with ID:', bookId);

        if (!bookId) {
            console.error('Book ID is missing!');
            return res.status(400).send({ error: 'Book ID is required' });
        }

        await Book.findByIdAndUpdate(bookId, { isActive: false });

        res.redirect('/admin/products?message=Book+Deleted');
    } catch (error) {
        console.error('Error deleting book:', error);
        res.status(500).json({ error: 'Server Error' });
    }
};


//add new category

const addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const existingBook = await Category.findOne({ name });
        if (existingBook) {
            return res.redirect('/admin/category?error=Category with this title already exists.');
        }
        const validNamePattern = /^[A-Za-z\s]+$/; 
        if (!validNamePattern.test(name)) {
            return res.redirect('/admin/category?error=Category name can only contain letters and spaces.');
            
        }
        
        if (!name || name.trim() === '') {
            res.redirect('/admin/category?error=Category name is required.');
        }
        

        const newCategory = new Category({ name });
        await newCategory.save();

        res.redirect('/admin/category?message=Category Added');
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ message: 'Error adding category' });
    }
};

//category add page

const createCategory = (req, res) => {
    try {
        res.render('admin/create-category')
    } catch {
        console.log('err');
    }
}

const getCategory = async (req, res) => {
    try {
        const { message,error } = req.query

        const categories = await Category.find(); 
        res.render('admin/category', { categories,message,error }); 
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
}

const deleleCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        
        if (!categoryId) {
            console.error('Category ID is missing!');
            return res.status(400).json({ message: 'Category ID is required' });
        }

        await Category.findByIdAndUpdate(categoryId, { isActive: false });
        
        res.redirect('/admin/category?message=Category+Deleted');
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Error deleting category' });
    }
};



// edit category page
const getEditCategory = async (req, res) => {
    try {
        const {message, error} = req.query
        const { id } = req.params
        console.log(id)
        const category = await Category.findById(id);
        
        if (!category) {
            res.redirect('/admin/category?error=Category not found');
        }

        res.render('admin/editCategory', { category,message,error });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).send('Error fetching category');
    }
};

// edit form submission
const editCategory = async (req, res) => {
    try {
        const { id } = req.params; 
        const { name } = req.body; 

        const validNamePattern = /^[A-Za-z\s]+$/; 
        if (!validNamePattern.test(name)) {
            return res.redirect('/admin/category?error=Category name can only contain letters and spaces.');
            
        }

        if (!name || name.trim() === '') {
            return res.redirect(`/admin/editCategory/${id}?error=Category name is required.`);
        }

        const trimmedName = name.trim();

        
        const existingCategory = await Category.findById(id);
        if (!existingCategory) {
            return res.status(404).send('Category not found');
        }

       
        if (existingCategory.name.trim().toLowerCase() === trimmedName.toLowerCase()) {
            return res.redirect(`/admin/editCategory/${id}?error=No changes made to the category name.`);
        }

        
        const duplicateCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${trimmedName}$`, 'i') }, 
            _id: { $ne: id } 
        });

        if (duplicateCategory) {
            return res.redirect(`/admin/editCategory/${id}?error=Category with this name already exists.`);
        }
        
    
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: trimmedName }, 
            { new: true } 
        );


        res.redirect('/admin/category?message=Category Updated');
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).send('Error updating category');
    }
};

const getOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the page number from the query string
        const limit = 5; // Set the number of orders per page
        const skip = (page - 1) * limit; // Calculate the number of orders to skip

        const totalOrders = await Order.countDocuments(); // Get the total number of orders
        const orders = await Order.find()
            .populate('items.productId')
            .populate('userId')
            .limit(limit)
            .skip(skip); // Fetch the orders for the current page

        const totalPages = Math.ceil(totalOrders / limit); // Calculate total pages

        // Log fetched orders for debugging
        console.log('Fetched Orders:', orders);

        // Render the EJS view and pass the orders data, current page, and total pages
        res.render('admin/orders', { orders, currentPage: page, totalPages }); // Make sure 'admin/orders' matches your EJS view file
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Error fetching orders');
    }
};


// Controller to update order status
const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status } = req.body;
    console.log('status', req.body.status);
    
    try {
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send('Order not found');

        const previousStatus = order.status; // Store the previous status for comparison

        // Update the order status
        order.status = status;

        // Handle status changes
        if (status === 'cancelled') {
            order.cancelledAt = new Date();

            // Wallet operations only for payments that are not cash on delivery
            if (order.paymentMethod !== 'cashOnDelivery') {
                const userId = order.userId; // Get the user ID from the order
                const orderTotal = order.total; // Get the total amount from the order

                // Find or create the wallet for the user
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    wallet = await Wallet.create({ userId });
                }
                const message = 'Order where Cancelled by Admin'
                // Credit the wallet and log the transaction
                wallet.balance += orderTotal; // Add the order total to the wallet balance
                wallet.transactions.push({
                    amount: orderTotal,
                    transactionType: 'credit',
                    orderId: orderId,
                    message:message
                });

                await wallet.save(); // Save the updated wallet
            }
        }
        
        if (status === 'delivered') {
            order.deliveredAt = new Date(); // Set the delivered date to now
        }

        await order.save();

        // Redirect with success message
        res.redirect(`/admin/orders?message=Order+status+updated+successfully`);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).redirect(`/admin/orders?error=Error+updating+order+status`);
    }
};




const getCoupons = async (req, res) => {
    try {
        const { message, error } = req.query;
        const coupons = await Coupon.find();
        res.render('admin/coupons', { coupons ,message, error});
    } catch (error) {
        console.error('Error fetching coupons:', error);
        res.status(500).send('Server error');
    }
};

const createCoupon = async (req, res) => {
    const { code, discount, minOrderValue, validFrom, validUntil } = req.body;

    // Server-side validation
    if (!code || !discount || !minOrderValue || !validFrom || !validUntil) {
        return res.redirect('/admin/getCreateCoupon?error=Please+fill+in+all+fields');
    }

    if (discount <= 0 || discount > 100) {
        return res.redirect('/admin/getCreateCoupon?error=Discount+should+be+between+1+and+100');
    }

    if (minOrderValue <= 0) {
        return res.redirect('/admin/getCreateCoupon?error=Minimum+order+value+should+be+greater+than+0');
    }

    try {
        // Check if a coupon with the same code already exists
        const existingCoupon = await Coupon.findOne({ code });
        if (existingCoupon) {
            return res.redirect('/admin/getCreateCoupon?error=Coupon+code+already+exists');
        }

        // Create the new coupon
        const newCoupon = new Coupon({
            code,
            discount,
            minOrderValue,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: true
        });

        // Save to the database
        await newCoupon.save();

        // Redirect to the coupons page with a success message
        return res.redirect('/admin/coupons?message=Coupon+created+successfully');
    } catch (error) {
        console.error('Error creating coupon:', error);
        return res.redirect('/admin/coupons?error=An+error+occurred+while+creating+the+coupon');
    }
};




// Deactivate a coupon
const deactivateCoupon = async (req, res) => {
    const { id } = req.params;

    try {
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).redirect(`/admin/coupons?error=Coupon+not+found`);
        }

        // Toggle the isActive status
        coupon.isActive = !coupon.isActive;
        await coupon.save();

        res.redirect(`/admin/coupons?message=Coupon+status+updated+successfully`);
    } catch (error) {
        console.error('Error toggling coupon status:', error);
        res.status(500).redirect(`/admin/coupons?error=Error+updating+coupon+status`);
    }
};


const getCreateCoupon = (req, res) => {
    try {
        const { message, error } = req.query;

        res.render('admin/createCoupon',{message, error})
    } catch (error) {
        console.log(error)
        res.json('error while showing the coupon page')
    }
}


const getEditCoupon = async (req, res) => {
    const couponId = req.params.id;
    const { error, message } = req.query;  // Capture error and message from query parameters
    
    try {
        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.redirect('/admin/coupons?error=Coupon+not+found');
        }
        
        // Pass coupon, error, and message to the template
        res.render('admin/editCoupon', { coupon, error, message });
    } catch (error) {
        console.error('Error fetching coupon for edit:', error);
        res.redirect('/admin/coupons?error=An+error+occurred+while+fetching+the+coupon');
    }
};


const updateCoupon = async (req, res) => {
    const couponId = req.params.id;
    const { code, discount, minOrderValue, validFrom, validUntil } = req.body;

    // Server-side validation
    if (!code || !discount || !minOrderValue || !validFrom || !validUntil) {
        return res.redirect(`/admin/editCoupon/${couponId}?error=Please+fill+in+all+fields`);
    }

    if (discount <= 0 || discount > 100) {
        return res.redirect(`/admin/editCoupon/${couponId}?error=Discount+should+be+between+1+and+100`);
    }

    if (minOrderValue <= 0) {
        return res.redirect(`/admin/editCoupon/${couponId}?error=Minimum+order+value+should+be+greater+than+0`);
    }

    
    try {
        // Check if a coupon with the same code already exists (excluding the current coupon)
        const existingCoupon = await Coupon.findOne({ code, _id: { $ne: couponId } });
        if (existingCoupon) {
            return res.redirect(`/admin/editCoupon/${couponId}?error=Coupon+code+already+exists`);
        }

        const coupon = await Coupon.findById(couponId);
        if (!coupon) {
            return res.redirect('/admin/coupons?error=Coupon+not+found');
        }
        

        // Update coupon details
        coupon.code = code;
        coupon.discount = discount;
        coupon.minOrderValue = minOrderValue;
        coupon.validFrom = new Date(validFrom);
        coupon.validUntil = new Date(validUntil);

        await coupon.save();
        
        res.redirect('/admin/coupons?message=Coupon+updated+successfully');
    } catch (error) {
        console.error('Error updating coupon:', error);
        res.redirect(`/admin/editCoupon/${couponId}?error=An+error+occurred+while+updating+the+coupon`);
    }
};


const getOfferManagementPage = async (req, res) => {
    try {
        // Fetch all offers from the database
        const offers = await Offer.find()
    .populate({
        path: 'applicableProducts',
        select: 'title'  // Only get the title field
    })
    .populate({
        path: 'applicableCategories',
        select: 'name'  // Only get the name field
    });
 // Use lean for better performance

        // Render the offer management view and pass the offers to the template
        res.render('admin/offer', { offers });
    } catch (error) {
        console.error(error);
        req.flash('error', 'Error fetching offers. Please try again.');
        res.redirect('/admin'); // Redirect to a safe page on error
    }
};

const renderCreateOfferPage = async (req, res) => {
    try {
        // Fetch all active products and categories
        const allProducts = await Book.find({ isActive: true });
        const allCategories = await Category.find({ isActive: true });

        // Get messages from the query parameters
        const errorMessage = req.query.error || null; // Get error message if present
        const successMessage = req.query.message || null; // Get success message if present

        // Render the create offer page with product, category data, and messages
        res.render('admin/createOffer', { 
            allProducts, 
            allCategories, 
            errorMessage, 
            successMessage 
        });
    } catch (error) {
        console.error('Error fetching products or categories:', error);
        // Redirect with an error message
        res.redirect('/admin/getCreateOffer?error=An+error+occurred+while+fetching+data');
    }
};

const createOffer = async (req, res) => {
    try {
        const { title, discount, applicableProducts, applicableCategories, validFrom, validUntil, isActive } = req.body;

        // Validation checks
        if (!title || !discount || !validFrom || !validUntil) {
            return res.redirect('/admin/getCreateOffer?error=All+fields+are+required.');
        }

        if (isNaN(discount) || discount < 0 || discount > 100) {
            return res.redirect('/admin/getCreateOffer?error=Discount+must+be+a+number+between+0+and+100.');
        }

        if (new Date(validFrom) >= new Date(validUntil)) {
            return res.redirect('/admin/getCreateOffer?error=Valid+From+date+must+be+earlier+than+Valid+Until+date.');
        }

        // Check if an offer with the same title already exists
        const existingOffer = await Offer.findOne({ title });
        if (existingOffer) {
            return res.redirect('/admin/getCreateOffer?error=An+offer+with+this+title+already+exists.');
        }

        // Parse the applicableProducts and applicableCategories arrays if they exist
        const selectedProducts = Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts].filter(Boolean);
        const selectedCategories = Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories].filter(Boolean);

        // Ensure at least one product or category is selected
        if (selectedProducts.length === 0 && selectedCategories.length === 0) {
            return res.redirect('/admin/getCreateOffer?error=At+least+one+product+or+category+must+be+selected.');
        }

        // Create a new offer instance
        const newOffer = new Offer({
            title,
            discount,
            applicableProducts: selectedProducts,
            applicableCategories: selectedCategories,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: isActive === 'true', // Convert to boolean
        });

        // Save the offer to the database
        await newOffer.save();

        // Redirect to the offers page with a success message
        res.redirect('/admin/offer-management?message=Offer+created+successfully');
    } catch (error) {
        console.error("Error creating offer:", error);
        res.redirect('/admin/getCreateOffer?error=An+error+occurred+while+creating+the+offer.');
    }
};


const updateOffer = async (req, res) => {
    try {
        const { offerId } = req.params;
        const { title, discount, applicableProducts, applicableCategories, validFrom, validUntil, isActive } = req.body;

        // Validation checks
        if (!title || !discount || !validFrom || !validUntil) {
            return res.redirect(`/admin/editOffer/${offerId}?error=All+fields+are+required.`);
        }

        if (isNaN(discount) || discount <= 0 || discount > 100) {
            return res.redirect(`/admin/editOffer/${offerId}?error=Discount+must+be+a+number+between+0+and+100.`);
        }

        if (new Date(validFrom) >= new Date(validUntil)) {
            return res.redirect(`/admin/editOffer/${offerId}?error=Valid+From+date+must+be+earlier+than+Valid+Until+date.`);
        }

        // Check if an offer with the same title already exists, excluding the current offer
        const existingOffer = await Offer.findOne({ title, _id: { $ne: offerId } });
        if (existingOffer) {
            return res.redirect(`/admin/editOffer/${offerId}?error=An+offer+with+this+title+already+exists.`);
        }

        // Update the offer
        await Offer.findByIdAndUpdate(offerId, {
            title,
            discount,
            applicableProducts,
            applicableCategories,
            validFrom: new Date(validFrom),
            validUntil: new Date(validUntil),
            isActive: isActive === 'true' // Convert to boolean
        });

        res.redirect('/admin/offer-management'); // Redirect to the offers list after updating
    } catch (error) {
        console.error('Error updating offer:', error);
        res.status(500).send("An error occurred while updating the offer.");
    }
};


const toggleOfferStatus = async (req, res) => {
    try {
        const { offerId } = req.params;

        // Find the offer and toggle its status
        const offer = await Offer.findById(offerId);
        if (offer) {
            offer.isActive = !offer.isActive;
            await offer.save();
        }

        res.redirect('/admin/offer-management'); // Redirect to the offers list after deactivation
    } catch (error) {
        console.error('Error toggling offer status:', error);
        res.status(500).send("An error occurred while changing the offer status.");
    }
};

const renderEditOfferPage = async (req, res) => {
    try {
        const { offerId } = req.params;
        const error = req.query.error || null; // Get error message if present

        // Retrieve the specific offer
        const offer = await Offer.findById(offerId).populate('applicableProducts').populate('applicableCategories');
        
        // Fetch all active products and categories
        const allProducts = await Book.find({ isActive: true });
        const allCategories = await Category.find({ isActive: true });

        if (!offer) {
            // Pass error message to the template
            return res.render('admin/editOffer', { offer: null, allProducts, allCategories, error: "Offer not found" });
        }

        // Render the edit offer page with offer, product, and category data
        res.render('admin/editOffer', { offer, allProducts, allCategories, error });
    } catch (error) {
        console.error('Error loading edit offer page:', error);
        res.render('admin/editOffer', { offer: null, allProducts, allCategories, error: "An error occurred while loading the edit offer page." });
    }
};

const getDeliveredSalesReport = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Default to the first page
        const limit = 10; // Orders per page
        const skip = (page - 1) * limit;

        // Fetch the total count of delivered orders for pagination
        const totalOrders = await Order.countDocuments({ status: 'delivered' });
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch only delivered orders, populate userId to get the user's name, and apply pagination
        const deliveredOrders = await Order.find({ status: 'delivered' })
            .populate('userId', 'name') // Only populate the 'name' field from User
            .skip(skip)
            .limit(limit);

        // Pass orders data and pagination details to the EJS page
        res.render('admin/report', { 
            salesReports: deliveredOrders,
            currentPage: page,
            totalPages: totalPages
        });
    } catch (error) {
        console.error('Error fetching sales report:', error);
        res.status(500).send('Error fetching sales report');
    }
};


const downloadSalesReport = async (req, res) => {
    try {
        let reportType, startDate, endDate;

        // Determine the report type and date range based on the request method
        if (req.method === 'GET') {
            const { reportType: type, startDate: start, endDate: end } = req.query;
            reportType = type;
            startDate = start ? new Date(start) : null; // Parse date
            endDate = end ? new Date(end) : null; // Parse date
        } else if (req.method === 'POST') {
            ({ reportType, startDate, endDate } = req.body);
            startDate = startDate ? new Date(startDate) : null; // Parse date
            endDate = endDate ? new Date(endDate) : null; // Parse date
        } else {
            return res.status(405).send("Method Not Allowed");
        }

        let dateQuery = {};
        const today = new Date();

        // Set date query based on report type
        switch (reportType) {
            case "daily":
                dateQuery = {
                    $gte: new Date(today.setHours(0, 0, 0, 0)),
                    $lt: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            case "weekly":
                dateQuery = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), today.getDate() - 7),
                    $lt: new Date(today.setHours(23, 59, 59, 999))
                };
                break;
            case "monthly":
                dateQuery = {
                    $gte: new Date(today.getFullYear(), today.getMonth(), 1),
                    $lt: new Date(today.getFullYear(), today.getMonth() + 1, 0)
                };
                break;
            case "custom":
                if (!startDate || !endDate) {
                    return res.status(400).send("Start date and end date are required for custom reports.");
                }
                // Ensure end date includes the full day
                dateQuery = {
                    $gte: startDate,
                    $lt: new Date(endDate.setHours(23, 59, 59, 999)) // Adjust end date to include the full day
                };
                break;
            default:
                return res.status(400).send("Invalid report type.");
        }

        // Fetch delivered orders based on the date query
        const orders = await Order.find({ status: "delivered", createdAt: dateQuery }).populate('items.productId');

        // Calculate totals
        const totalRevenue = orders.reduce((total, order) => total + order.total, 0);
        const totalOrders = orders.length;
        const totalDiscount = orders.reduce((total, order) => total + order.discount, 0);


        // Create PDF document
        const pdfDoc = await PDFDocument.create();
        const page = pdfDoc.addPage([600, 800]);

        const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
        const headerColor = rgb(0.2, 0.2, 0.8);
        const textColor = rgb(0, 0, 0);

        let yPosition = 750;

        // Company details
        page.drawText("MILU BOOKS", {
            x: 50,
            y: 780,
            size: 22,
            font: font,
            color: headerColor
        });

        // Address
        const address = [
            "123 Book Street",
            "Literary District",
            "Booktown, BT 12345"
        ];

        let addressY = 760;
        address.forEach(line => {
            page.drawText(line, {
                x: 50,
                y: addressY,
                size: 9,
                font: font,
                color: textColor
            });
            addressY -= 15;
        });

        // Contact details
        const contactDetails = [
            "Tel: (555) 123-4567",
            "Email: info@milubooks.com",
            "Web: www.milubooks.com"
        ];

        let contactY = 760;
        contactDetails.forEach(line => {
            page.drawText(line, {
                x: 400,
                y: contactY,
                size: 9,
                font: font,
                color: textColor
            });
            contactY -= 15;
        });

        // Horizontal line
        page.drawLine({
            start: { x: 50, y: 700 },
            end: { x: 550, y: 700 },
            thickness: 2,
            color: rgb(0, 0, 0)
        });

        // Title
        page.drawLine({
            start: { x: 50, y: 680 },
            end: { x: 150, y: 680 },
            thickness: 3,
            color: rgb(0, 0, 0)
        });

        page.drawText("Sales Report", {
            x: 170,
            y: 670,
            size: 22,
            font: font,
            color: headerColor
        });

        page.drawLine({
            start: { x: 450, y: 680 },
            end: { x: 550, y: 680 },
            thickness: 3,
            color: rgb(0, 0, 0)
        });

        // Report info
        yPosition = 630;
        const reportInfo =
            reportType === "custom"
               ? `Report Type: ${reportType}\nDate Range: ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`
                : `Report Type: ${reportType}\nDate: ${today.toLocaleDateString()}`;

        page.drawText(reportInfo, {
            x: 50,
            y: yPosition,
            size: 12,
            font: font,
            color: textColor
        });
        yPosition -= 25;

        // Table setup
        const tableTop = yPosition + 20;
        const tableLeft = 45;
        const tableRight = 580;
        const headerHeight = 30;

        // Table header background
        page.drawRectangle({
            x: tableLeft,
            y: yPosition - 5,
            width: tableRight - tableLeft,
            height: headerHeight,
            color: rgb(230 / 255, 230 / 255, 230 / 255)
        });

        // Headers
        const headers = ["Order ID", "Order Date", "Customer", "Total Price", "Discount", "Shipping"];
        const headerWidths = [120, 110, 140, 90, 90, 90];
        headers.forEach((header, index) => {
            const xPosition = tableLeft + headerWidths.slice(0, index).reduce((a, b) => a + b, 0);
            page.drawText(header, {
                x: xPosition + 5,
                y: yPosition,
                size: 11,
                font: font,
                color: headerColor,
                underline: true
            });
        });

        yPosition -= headerHeight;

        // Vertical lines
        headerWidths.reduce((xPos, width) => {
            page.drawLine({
                start: { x: xPos + 45, y: tableTop },
                end: { x: xPos + 45, y: yPosition - (orders.length * 18) },
                thickness: 0.5,
                color: rgb(200 / 255, 200 / 255, 200 / 255)
            });
            return xPos + width;
        }, 0);

        // Order details
        if (orders.length === 0) {
            page.drawText("No delivered orders found for this report.", {
                x: 50,
                y: yPosition,
                size: 11,
                font: font,
                color: textColor
            });
        } else {
            orders.forEach((order, index) => {
                const orderDate = new Date(order.deliveredAt).toLocaleDateString();
                const totalPriceText = `$${order.total.toFixed(2)}`;
                const customer = order.address.fullName || "N/A";
                const discount = order.discount;
                const shipping = order.shipping;

                const rowYPosition = yPosition - index * 18;
                if (rowYPosition < 50) {
                    page.addPage([600, 800]);
                    yPosition = 750;
                }

                // Alternating row backgrounds
                if (index % 2 === 1) {
                    page.drawRectangle({
                        x: tableLeft,
                        y: rowYPosition - 2,
                        width: tableRight - tableLeft,
                        height: 18,
                        color: rgb(245 / 255, 245 / 255, 245 / 255)
                    });
                }

                // Row data
                page.drawText(order.OrderId, {
                    x: 50,
                    y: rowYPosition + 2,
                    size: 9,
                    font: font,
                    color: textColor
                });
                page.drawText(orderDate, {
                    x: 170,
                    y: rowYPosition + 2,
                    size: 9,
                    font: font,
                    color: textColor
                });
                page.drawText(customer, {
                    x: 280,
                    y: rowYPosition + 2,
                    size: 9,
                    font: font,
                    color: textColor
                });
                page.drawText(totalPriceText, {
                    x: 420,
                    y: rowYPosition + 2,
                    size: 9,
                    font: font,
                    color: textColor
                });
                page.drawText(`$${discount.toFixed(2)}`, {
                    x: 510,
                    y: rowYPosition + 2,
                    size: 9,
                    font: font,
                    color: textColor
                });
                page.drawText(`$${shipping.toFixed(2)}`, {
                    x: 600,
                    y: rowYPosition + 2,
                    size: 9,
                    font: font,
                    color: textColor
                });
            });

            // Horizontal lines
            for (let i = 0; i <= orders.length; i++) {
                const lineY = yPosition - (i * 18);
                page.drawLine({
                    start: { x: tableLeft, y: lineY },
                    end: { x: tableRight, y: lineY },
                    thickness: 0.5,
                    color: rgb(200 / 255, 200 / 255, 200 / 255)
                });
            }
        }

        // Summary Section
        yPosition -= orders.length * 18 + 30;

        page.drawRectangle({
            x: 40,
            y: yPosition - 100,
            width: 520,
            height: 120,
            color: rgb(245 / 255, 245 / 255, 245 / 255)
        });

        page.drawText("Summary", {
            x: 50,
            y: yPosition,
            size: 14,
            font: font,
            color: headerColor
        });

        const summaryData = [
            { label: "Total Revenue:", value: `$${totalRevenue.toFixed(2)}` },
            { label: "Total Orders:", value: `${totalOrders}` },
            { label: "Total Discount:", value: `$${totalDiscount.toFixed(2)}` }
        ];

        summaryData.forEach((item, index) => {
            yPosition -= 18;
            page.drawText(item.label, {
                x: 50,
                y: yPosition,
                size: 10,
                font: font,
                color: headerColor
            });
            page.drawText(item.value, {
                x: 250,
                y: yPosition,
                size: 10,
                font: font,
                color: textColor
            });
        });

        // Serialize the PDFDocument to bytes (a Uint8Array)
        const pdfBytes = await pdfDoc.save();

        // Save PDF to filesystem
        const filePath = path.join(__dirname,'sales_report.pdf'); // Adjust the path as needed
        fs.writeFileSync(filePath, pdfBytes);

        // Send the file as a download
        res.download(filePath,'sales_report.pdf', (err) => {
            if (err) {
                console.error("Error sending the PDF file:", err);
                return res.status(500).send("Error sending the report.");
            }
            // Optionally delete the file after sending
            fs.unlinkSync(filePath);
        });
    } catch (error) {
        console.error("Error generating report:", error);
        res.status(500).send("Error generating report.");
    }
};



module.exports = {
    adminUsers,
    blockUser,
    unblockUser,
    addBooks,
    getBooks,
    editBooks,
    deleleBook,
    addCategory,
    createCategory,
    getCategory,
    deleleCategory,
    editCategory,
    getEditCategory,
    login,
    postLogin,
    getOrders,
    updateOrderStatus,
    getCoupons,
    createCoupon,
    deactivateCoupon,
    getCreateCoupon,
    getEditCoupon,
    updateCoupon,
    getOfferManagementPage,
    renderCreateOfferPage,
    createOffer,
    updateOffer,
    toggleOfferStatus,
    renderEditOfferPage,
    getDeliveredSalesReport,
    downloadSalesReport
};
