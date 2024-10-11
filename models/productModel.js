const mongoose = require('mongoose');

const bookSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true
    },
    author: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    images: {
        type: [String], // Store an array of image paths
        required: true
    },
    price: {
        type: Number, // Price of the book
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true // Default value for isActive is true
    },
    categoryId: {
        type:mongoose.Schema.Types.ObjectId, // Reference to the Category collection
        required: true,
        ref:'Category'
    }
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book; 
