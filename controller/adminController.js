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

    try {
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send('Order not found');

        order.status = status;
        
        // Only set cancelledAt if the new status is 'canceled'
        if (status === 'canceled') {
            order.cancelledAt = new Date();
        }
        if (status === 'delivered') {
            order.deliveredAt = new Date(); // Set the delivered date to now
        }

        await order.save();

        res.redirect(`/admin/orders?message=Order+status+updated+successfully`);
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).redirect(`/admin/orders?error=Error+updating+order+status`);
    }
};

const cancelOrder = async (req, res) => {
    const { orderId } = req.params;

    try {
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).redirect(`/admin/orders?error=Order+not+found`);
        }

        order.status = 'canceled';
        order.cancelledAt = new Date();
        await order.save();

        res.redirect(`/admin/orders?message=Order+canceled+successfully`);
    } catch (error) {
        console.error('Error cancelling order:', error);
        res.status(500).redirect(`/admin/orders?error=Error+cancelling+order`);
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
    cancelOrder
};
