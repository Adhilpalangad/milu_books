const User = require("../models/userModel");
const Book = require('../models/productModel'); // Ensure the path is correct
const multer = require('multer');
const path = require('path');
const upload = require('../config/multerConfig');
const mongoose = require("mongoose")
const fs = require('fs');
const Category = require('../models/categoryModel');
// Initialize multer for image uploads

// Admin users management
const adminUsers = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1; // Get the current page from the query, default to 1
        const limit = 5; // Number of users per page
        const skip = (page - 1) * limit; // How many users to skip

        // Fetch the total number of non-admin users
        const totalUsers = await User.countDocuments({ isAdmin: false });

        // Fetch the paginated users
        const userData = await User.find({ isAdmin: false })
                                   .skip(skip)
                                   .limit(limit);

        // Calculate the total number of pages
        const totalPages = Math.ceil(totalUsers / limit);

        // Render users and pagination data to the template
        res.render('admin/users', {
            users: userData,
            currentPage: page,   // Current page number
            totalPages: totalPages // Total number of pages
        });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).send('An error occurred');
    }
};

// Block user
const blockUser = async (req, res) => {
    try {
        const { userId } = req.body;  // Get userId from request body
        console.log('Attempting to block user with ID:', userId); // Debug log

        if (!userId) {
            console.error('User ID is missing!'); // Error log
            return res.status(400).send('User ID is required');
        }

        // Update user to be blocked
        await User.findByIdAndUpdate(userId, { isBlocked: true });

        res.redirect('/admin/users');  // Redirect to the users list
    } catch (error) {
        console.error('Error blocking user:', error);
        res.status(500).send('Server Error');
    }
};

// Unblock user
const unblockUser = async (req, res) => {
    try {
        const { userId } = req.body; // Get user ID from the request body
        console.log('Attempting to unblock user with ID:', userId); // Debug log

        if (!userId) {
            console.error('User ID is missing!'); // Error log
            return res.status(400).send('User ID is required');
        }

        // Update user to be unblocked
        await User.findByIdAndUpdate(userId, { isBlocked: false });

        res.redirect('/admin/users'); // Redirect back to users page
    } catch (error) {
        console.log('Error unblocking user:', error);
        res.redirect('/admin/users'); // Handle error and redirect
    }
};

    // Add books
    const addBooks = async (req, res) => {
        try {
            const { title, author, description, price, categoryId } = req.body;
            const images = req.files; // This will contain an array of the uploaded images
            console.log('img', images);
            console.log(categoryId);
            console.log('here1');
            
            // Check if images were uploaded
            if (!images || images.length === 0) {
                res.redirect('/admin/products?error=No Image Uploaded');
            }
            console.log('here2');
            // Check if the book already exists
             ;
            const existingBook = await Book.findOne({ title });
            console.log('here3')
            console.log('title is',existingBook);
            console.log('here4')
            if (existingBook) {
                return res.status(409).json({ message: 'Book with this title already exists.' });
            }
    
            // Create a new book entry
            const newBook = new Book({
                title,
                author,
                description,
                price,
                images: images.map(img => img.filename),
                categoryId,
                // Save the image paths to the database
            });
    
            // Save the book to the database
            await newBook.save();
    
            res.redirect('/admin/products?message=Book Added');
        } catch (error) {
            console.error('Error adding book:', error);
            res.redirect('/admin/products?error=Error Adding Book');
        }
    };
    
    const getBooks = async (req, res) => {
        try {
            const { message , error} = req.query;
    
            // Get pagination parameters from the query string
            const page = parseInt(req.query.page) || 1; // Default to page 1
            const limit = parseInt(req.query.limit) || 5; // Default limit to 5 books
            const skip = (page - 1) * limit; // Calculate how many records to skip
    
            // Fetch books from the database with pagination and populate the categoryId
            const books = await Book.find({ isActive: true })
                .populate('categoryId')  // Populate the categoryId field
                .skip(skip)
                .limit(limit);
    
            // Log the fetched books to see the populated category data
            console.log(books); // Debugging output to inspect populated data
    
            // Get the total count of active books for pagination
            const totalBooks = await Book.countDocuments({ isActive: true });
            const totalPages = Math.ceil(totalBooks / limit); // Calculate total pages
    
            // Render the books with pagination and category info
            res.render('admin/products', {
                books,
                message,
                error,
                currentPage: page,
                totalPages,
                limit,
                categories: await Category.find() // Fetch categories to display in the view
            });
        } catch (error) {
            console.error('Error fetching books:', error);
            res.status(500).send('Error fetching books');
        }
    };
    
    
    
    

const editBooks = async (req, res) => {
    try {
        const { id, title, author, description, price, removeImages } = req.body;
        const images = req.files; // This will contain an array of the uploaded images

        // Validate and convert the ID to an ObjectId
        if (!mongoose.Types.ObjectId.isValid(id)) {
            res.redirect('/admin/products?error=Invalid book ID format');
        }

        // Query the database using the valid ObjectId
        const book = await Book.findById(id);
        
        if (!book) {
            res.redirect('/admin/products?error=Book Not Found');
        }

        // Update book details with new data or retain old values
        book.title = title || book.title;
        book.author = author || book.author;
        book.description = description || book.description;
        book.price = price || book.price;

        // Handle image updates if new images are uploaded
        if (images && images.length > 0) {
            // Delete the old images from storage if they are marked for removal
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

            // Save new image filenames
            book.images = images.map(img => img.filename);
        }

        // Save the updated book to the database
        await book.save();

        res.redirect('/admin/products?message=Book Updated');
    } catch (error) {
        console.error('Error updating book:', error);
        res.redirect('/admin/products?error=Error updating book');
    }
};


const deleleBook = async (req, res) => {
    try {
        try {
            const { bookId } = req.body;  // Get userId from request body
            console.log('Attempting to delete book with ID:', bookId); // Debug log
    
            if (!bookId) {
                console.error('User ID is missing!'); // Error log
                res.redirect('/admin/products?error=book ID Requierd');
            }
    
            // Update user to be blocked
            await Book  .findByIdAndUpdate(bookId, { isActive: false });
    
            res.redirect('/admin/products?message=Book Deleted');  // Redirect to the users list
        } catch (error) {
            console.error('Error blocking user:', error);
            res.status(500).send('Server Error');
        }
    } catch {
        res.send('heyy')
    }
}

const addCategory = async (req, res) => {
    try {
        const { name } = req.body;
        const existingBook = await Category.findOne({ name });
        if (existingBook) {
            return res.redirect('/admin/category?error=Book with this title already exists.');
            }
        // Check if the category name is provided
        if (!name || name.trim() === '') {
            return res.status(400).json({ message: 'Category name is required.' });
        }
        

        // Create a new category
        const newCategory = new Category({ name });
        await newCategory.save();

        res.redirect('/admin/category?message=Category Added');
    } catch (error) {
        console.error('Error adding category:', error);
        res.status(500).json({ message: 'Error adding category' });
    }
};

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

        const categories = await Category.find(); // Fetch all categories from the database
        res.render('admin/category', { categories,message,error }); // Render the 'categories' view and pass the categories
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({ message: 'Error fetching categories' });
    }
}

const deleleCategory = async (req, res) => {
    try {
        const categoryId = req.params.id;
        await Category.findByIdAndUpdate(categoryId, { isActive: false });
        res.redirect('/admin/category?message=Category Deleted'); 
    } catch (error) {
        console.error('Error deleting category:', error);
        res.status(500).json({ message: 'Error deleting category' });
    }   
}



// GET route to render the edit category page
const getEditCategory = async (req, res) => {
    try {
        const {message, error} = req.query
        const { id } = req.params
        console.log(id)
        const category = await Category.findById(id);
        
        if (!category) {
            return res.status(404).send('Category not found');
        }

        res.render('admin/editCategory', { category,message,error });
    } catch (error) {
        console.error('Error fetching category:', error);
        res.status(500).send('Error fetching category');
    }
};

// POST route to handle the edit form submission
const editCategory = async (req, res) => {
    try {
        const { id } = req.params; // Get the category ID from the URL params
        const { name } = req.body; // Get the updated name from the form

        // Check if the category name is provided and not empty
        if (!name || name.trim() === '') {
            return res.redirect(`/admin/editCategory/${id}?error=Category name is required.`);
        }

        // Check if the category name already exists (case-insensitive)
        const existingCategory = await Category.findOne({
            name: { $regex: new RegExp(`^${name.trim()}$`, 'i') }, // Case-insensitive match
            _id: { $ne: id } // Exclude the current category being edited
        });

        if (existingCategory) {
            // If a category with the same name exists, send a message to the client
            return res.redirect(`/admin/editCategory/${id}?error=Category with this name already exists.`);
        }

        // Find the category by ID and update it with the new name
        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            { name: name.trim() }, // Trim any extra white spaces from the name
            { new: true } // Return the updated category
        );

        if (!updatedCategory) {
            return res.status(404).send('Category not found');
        }

        // Redirect to the categories page with a success message
        res.redirect('/admin/category?message=Category Updated');
    } catch (error) {
        console.error('Error updating category:', error);
        res.status(500).send('Error updating category');
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
    getEditCategory
};
