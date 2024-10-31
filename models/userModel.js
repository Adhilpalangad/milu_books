const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    googleId: { type: String },
    isAdmin: { type: Boolean, required: true, default: false },
    isBlocked: { type: Boolean, required: true, default: false },
    phone: { type: String }, // Add phone field if it's not already there
    gender: { type: String, enum: ['male', 'female', 'other'] }, // Add gender field
    otp: String,
    otpExpires: Date
});


userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
