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
const  PDFDocument  = require('pdfkit');
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
                .limit(limit)
            .sort({ createdAt: -1 });
    
            
    
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
            .skip(skip) // Fetch the orders for the current page
            .sort({createdAt:-1})
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
        return res.redirect(`/admin/getCreateCoupon?error=Please+fill+in+all+fields&code=${code || ''}&discount=${discount || ''}&minOrderValue=${minOrderValue || ''}&validFrom=${validFrom || ''}&validUntil=${validUntil || ''}`);
    }
    
    if (discount <= 0 || discount > 50) {
        return res.redirect(`/admin/getCreateCoupon?error=Discount+should+be+between+1+and+50&code=${code}&discount=${discount}&minOrderValue=${minOrderValue}&validFrom=${validFrom}&validUntil=${validUntil}`);
    }
    
    if (minOrderValue <= 0) {
        return res.redirect(`/admin/getCreateCoupon?error=Minimum+order+value+should+be+greater+than+0&code=${code}&discount=${discount}&minOrderValue=${minOrderValue}&validFrom=${validFrom}&validUntil=${validUntil}`);
    }
    
    if (validFrom > validUntil) {
        return res.redirect(`/admin/getCreateCoupon?error=Valid+From+is+not+greater+than+Valid+Until&code=${code}&discount=${discount}&minOrderValue=${minOrderValue}&validFrom=${validFrom}&validUntil=${validUntil}`);
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
        select: 'title'  
    })
    .populate({
        path: 'applicableCategories',
        select: 'name'  // Only get the name field
    });

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

        const existingOffer = await Offer.findOne({ title });
        if (existingOffer) {
            return res.redirect('/admin/getCreateOffer?error=An+offer+with+this+title+already+exists.');
        }

        const selectedProducts = Array.isArray(applicableProducts) ? applicableProducts : [applicableProducts].filter(Boolean);
        const selectedCategories = Array.isArray(applicableCategories) ? applicableCategories : [applicableCategories].filter(Boolean);

        if (selectedProducts.length === 0 && selectedCategories.length === 0) {
            return res.redirect('/admin/getCreateOffer?error=At+least+one+product+or+category+must+be+selected.');
        }

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
        const limit = 5; // Orders per page
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

const approveReturnRequest = async (req, res) => {
    const { orderId } = req.params;
    const { itemId } = req.body; 

    try {
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) return res.status(404).send('Order not found');

        const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) return res.status(404).send('Item not found');
        if (item.returnStatus !== 'requested') return res.status(400).send('Return request is not pending for this item');

        
        item.returnStatus = 'approved';
        item.isReturned = true;

        if (item.returnReason !== 'Damaged') {
            await Book.findByIdAndUpdate(item.productId._id, { $inc: { stock: item.quantity } });
        }

        const originalSubtotal = order.items.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
        const originalDiscount = order.discount || 0;
        const discountPercentage = originalDiscount / originalSubtotal;

        const itemDiscount = (item.priceAtOrder * item.quantity / originalSubtotal) * originalDiscount;
        const refundAmount = item.priceAtOrder * item.quantity - itemDiscount; 

        const remainingItems = order.items.filter(item => !item.isReturned); 
        const updatedSubtotal = remainingItems.reduce((sum, item) => sum + item.priceAtOrder * item.quantity, 0);
        const updatedDiscount = updatedSubtotal * discountPercentage; 
        const updatedTotal = Math.max(0, updatedSubtotal + order.shipping - updatedDiscount); 

        order.subtotal = updatedSubtotal;
        order.discount = updatedDiscount;
        order.total = updatedTotal;

        if ((order.paymentStatus === 'paid' && order.paymentMethod !== 'cashOnDelivery') || order.paymentMethod === 'wallet') {
            let wallet = await Wallet.findOne({ userId: order.userId });
            if (!wallet) wallet = await Wallet.create({ userId: order.userId });

            wallet.balance += refundAmount; 
            wallet.transactions.push({
                amount: refundAmount,
                transactionType: 'credit',
                orderId: order._id,
                message: `${refundAmount.toFixed(2)} credited for returned product`,
            });
            await wallet.save();
        }

        await order.save();

        res.redirect('/admin/orders'); // Redirect to admin orders page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};




const rejectReturnRequest = async (req, res) => {
    const { orderId } = req.params;
    const { itemId } = req.body;  

    try {
        const order = await Order.findById(orderId).populate('items.productId');
        if (!order) return res.status(404).send('Order not found');

        const item = order.items.find(item => item._id.toString() === itemId);
        if (!item) return res.status(404).send('Item not found');
        if (item.returnStatus !== 'requested') return res.status(400).send('Return request is not pending for this item');

        // Reset return status and reason
        item.returnStatus = null;
        item.returnReason = null;

        // If the product was marked as damaged, revert stock change
        if (item.returnReason === 'Damaged') {
            await Book.findByIdAndUpdate(item.productId._id, { $inc: { stock: -item.quantity } });
        }

        // Save the updated order
        await order.save();

        res.redirect('/admin/orders'); // Redirect to admin orders page
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};


const getDateQuery = (reportType, startDate, endDate) => {
    const today = new Date();
    let dateQuery = {};

    switch (reportType) {
        case "daily": {
            const startOfDay = new Date(today);
            startOfDay.setHours(0, 0, 0, 0);

            const endOfDay = new Date(today);
            endOfDay.setHours(23, 59, 59, 999);

            dateQuery = { $gte: startOfDay, $lt: endOfDay };
            break;
        }
        case "weekly": {
            const startOfWeek = new Date(today);
            startOfWeek.setDate(today.getDate() - 6);
            startOfWeek.setHours(0, 0, 0, 0);

            const endOfWeek = new Date(today);
            endOfWeek.setHours(23, 59, 59, 999);

            dateQuery = { $gte: startOfWeek, $lt: endOfWeek };
            break;
        }
        case "monthly": {
            const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
            const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0);
            endOfMonth.setHours(23, 59, 59, 999);

            dateQuery = { $gte: startOfMonth, $lt: endOfMonth };
            break;
        }
        case "custom":
            if (!startDate || !endDate) throw new Error("Start date and end date are required for custom reports.");
            dateQuery = {
                $gte: new Date(startDate),
                $lt: new Date(new Date(endDate).setHours(23, 59, 59, 999)) // Include the full end day
            };
            break;
        default:
            throw new Error("Invalid report type.");
    }

    return dateQuery;
};


const downloadSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        const dateQuery = getDateQuery(reportType, startDate, endDate);

        // Fetch delivered orders
        const orders = await Order.find({ status: "delivered", createdAt: dateQuery }).populate('userId');

        // Calculate summary data
        const totalOrders = orders.length;
        const totalIncome = orders.reduce((sum, order) => sum + order.total, 0);
        const totalDiscount = orders.reduce((sum, order) => sum + (order.discount || 0), 0);

        // Initialize PDF Document
        const doc = new PDFDocument({ margin: 50 });

        // Set Headers and Pipe Response
        res.setHeader("Content-Type", "application/pdf");
        res.setHeader("Content-Disposition", 'attachment; filename="sales_report.pdf"');
        doc.pipe(res);

        // Color scheme
        const colors = {
            primary: "#ca686e",
            headerText: "#ffffff",
            text: "#1f2937",
            border: "#cbd5e1",
            alternate: "#f1f5f9"
        };

        // Header
        doc.rect(0, 0, doc.page.width, 140).fill(colors.primary);

        doc.fontSize(20).font("Helvetica-Bold").fillColor(colors.headerText).text("MILU BOOKS XYZ Pvt Ltd", 50, 30, {
            width: doc.page.width - 100,
            align: "center"
        });

        doc.fontSize(28).font("Helvetica-Bold").fillColor(colors.headerText).text("Sales Report", 50, 60, {
            width: doc.page.width - 100,
            align: "center"
        });

        doc.fontSize(12)
            .font("Helvetica")
            .fillColor(colors.headerText)
            .text(`Report Period: ${startDate} - ${endDate}`, 50, 100, { align: "center" })
            .text(`Generated on: ${new Date().toLocaleDateString()}`, 50, 120, { align: "center" });

        // Summary Section
        doc.fillColor(colors.text).fontSize(12);
        doc.text(`Total Orders: ${totalOrders}`, 50, 160)
           .text(`Total Income: ${totalIncome.toFixed(2)}`, 250, 160)
           .text(`Total Discount: ${totalDiscount.toFixed(2)}`, 420, 160);

        // Table Headers
        const headers = ["Order ID", "Customer Name", "Total", "Order Date", "Status"];
        const headerWidths = [120, 160, 60, 100, 70];
        let currentX = 50;
        let currentY = 200;

        doc.fillColor(colors.primary);
        doc.rect(currentX, currentY, doc.page.width - 100, 20).fill();

        headers.forEach((header, i) => {
            doc.fillColor(colors.headerText)
               .font("Helvetica-Bold")
               .fontSize(10)
               .text(header, currentX, currentY + 5, { width: headerWidths[i], align: "center" });
            currentX += headerWidths[i];
        });

        // Table Content
        currentY += 20;

        orders.forEach((order, index) => {
            currentX = 50;
            const isEvenRow = index % 2 === 0;
            doc.fillColor(isEvenRow ? colors.alternate : "#ffffff")
               .rect(currentX, currentY, doc.page.width - 100, 20)
               .fill();

            doc.fillColor(colors.text).fontSize(10);
            doc.text(order.OrderId.toString(), currentX, currentY + 5, { width: 140, align: "center" });
            currentX += 120;
            doc.text(order.userId?.name || "N/A", currentX, currentY + 5, { width: 160, align: "center" });
            currentX += 160;
            doc.text(`${order.total.toFixed(2)}`, currentX, currentY + 5, { width: 60, align: "center" });
            currentX += 60;
            doc.text(new Date(order.createdAt).toLocaleDateString(), currentX, currentY + 5, { width: 100, align: "center" });
            currentX += 100;
            doc.text(order.status, currentX, currentY + 5, { width: 70, align: "center" });

            currentY += 20;
        });
        doc.moveDown(1);
        doc.fillColor('#000000').lineWidth(0.5).moveTo(50, currentY).lineTo(555, currentY).stroke();
        doc.moveDown(0.5);
        // Summary Section at the End
        currentY += 30;
doc.fontSize(12).fillColor(colors.primary);

doc.text(`Total Orders: ${totalOrders}`, 50, currentY);
currentY += 20; // Move down to the next line

doc.text(`Total Income: ${totalIncome.toFixed(2)}`, 50, currentY);
currentY += 20; // Move down to the next line

doc.text(`Total Discount: ${totalDiscount.toFixed(2)}`, 50, currentY);


        // End PDF Document
        doc.end();
    } catch (error) {
        console.error("Error generating PDF:", error.message);
        res.status(500).send(`Failed to generate PDF report: ${error.message}`);
    }
};


// Backend: Route to serve filtered data for table display
const filterSalesReport = async (req, res) => {
    try {
        const { reportType, startDate, endDate } = req.body;
        const dateQuery = getDateQuery(reportType, startDate, endDate);

        const orders = await Order.find({ status: "delivered", createdAt: dateQuery }).populate('items.productId').populate('userId'); 
        res.json(orders); // Send data as JSON for table display
    } catch (error) {
        console.error('Error fetching filtered sales data:', error.message);
        res.status(500).send('Failed to fetch filtered data.');
    }
};






// Function to get the bestseller books by calculating sales count manually
const getDashboardData = async (req, res) => {
    try {
        const period = req.query.period || 'monthly';
        let dateFilter;

        // Define date filter based on the selected period
        const now = new Date();
        switch (period) {
            case 'daily':
                dateFilter = { $gte: new Date(now.setDate(now.getDate() - 1)) };
                break;
            case 'weekly':
                dateFilter = { $gte: new Date(now.setDate(now.getDate() - 7)) };
                break;
            case 'monthly':
                dateFilter = { $gte: new Date(now.setMonth(now.getMonth() - 1)) };
                break;
            case 'yearly':
                dateFilter = { $gte: new Date(now.setFullYear(now.getFullYear() - 1)) };
                break;
            default:
                dateFilter = {};
        }

        const deliveredFilter = { status: 'delivered' };

        const salesSummary = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            {
                $group: {
                    _id: null,
                    totalSalesCount: { $sum: { $size: "$items" } },
                    totalRevenue: { $sum: "$total" },
                    totalDiscount: { $sum: "$discount" }
                }
            }
        ]);

        const bestSellingProducts = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            { $unwind: "$items" },
            {
                $group: {
                    _id: "$items.productId", 
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $lookup: {
                    from: 'books',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: { path: "$productInfo", preserveNullAndEmptyArrays: true } },
            {
                $project: {
                    _id: 1,
                    totalSold: 1,
                    name: { $ifNull: ["$productInfo.title", "Unknown Product"] },
                    productId: { $toString: "$_id" }
                }
            }
        ]);

        const bestSellingCategories = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            { $unwind: "$items" },
            {
                $lookup: {
                    from: 'books',
                    localField: 'items.productId',
                    foreignField: '_id',
                    as: 'productInfo'
                }
            },
            { $unwind: "$productInfo" },
            {
                $lookup: {
                    from: 'categories',
                    localField: 'productInfo.categoryId',
                    foreignField: '_id',
                    as: 'categoryInfo'
                }
            },
            { $unwind: "$categoryInfo" },
            {
                $group: {
                    _id: "$categoryInfo.name",
                    totalSold: { $sum: "$items.quantity" }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 10 },
            {
                $project: {
                    _id: 0,
                    categoryName: "$_id",
                    totalSold: 1
                }
            }
        ]);

        const dailyRevenue = await Order.aggregate([
            { $match: { createdAt: dateFilter, status: 'delivered' } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    totalRevenue: { $sum: "$total" }
                }
            },
            { $sort: { "_id": 1 } } // Sort by date
        ]);

        const totalUsers = await User.countDocuments();

        res.json({
            salesSummary: salesSummary[0] || { totalSalesCount: 0, totalRevenue: 0, totalDiscount: 0 },
            bestSellingProducts,
            bestSellingCategories,
            totalUsers,
            dailyRevenue
        });
    } catch (error) {
        console.error("Error fetching dashboard data:", error);
        res.status(500).json({ error: "Failed to fetch dashboard data" });
    }
};



const renderDashboard = (req, res) => {
    try {
        res.render('admin/dashboard'); // This will render the 'dashboard.ejs' file inside 'views/admin'
    } catch (error) {
        console.error("Error rendering dashboard page:", error);
        res.status(500).send("Failed to render dashboard page");
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
    downloadSalesReport,
    filterSalesReport,
    approveReturnRequest,
    rejectReturnRequest, 
    getDashboardData,
    renderDashboard
};
