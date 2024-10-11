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
        type: [String], 
        required: true
    },
    price: {
        type: Number, 
        required: true
    },
    stock: {
        type: Number,
        required: true
    },
    isActive: {
        type: Boolean,
        default: true 
    },
    categoryId: {
        type:mongoose.Schema.Types.ObjectId, 
        required: true,
        ref:'Category'
    }
});

const Book = mongoose.model('Book', bookSchema);

module.exports = Book; 
