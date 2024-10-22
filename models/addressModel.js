// models/addressModel.js

const mongoose = require('mongoose');

const addressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the User model
        required: true,
    },
    fullName: { // Added for better clarity when selecting addresses
        type: String,
        required: true,
    },
    street: {
        type: String,
        required: true,
    },
    city: {
        type: String,
        required: true,
    },
    state: {
        type: String,
        required: true,
    },
    country: {
        type: String,
        required: true,
    },
    postalCode: {
        type: String,
        required: true,
    },
    isDefault: {
        type: Boolean,
        default: false, // Flag to indicate if this is the default address
    },
}, { timestamps: true });


module.exports = mongoose.model('Address', addressSchema);
