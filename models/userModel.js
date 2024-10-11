const mongoose = require('mongoose');
const bcrypt = require('bcrypt');

const userSchema = new mongoose.Schema({
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String },
    googleId: { type: String }, // New field for Google ID
    isAdmin: { type: Boolean, required: true, default: false },
    isBlocked: { type: Boolean, required: true, default: false },
    otp: String,
    otpExpires: Date
});


// Hash password before saving (if applicable)
userSchema.pre('save', async function(next) {
    if (this.isModified('password')) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    next();
});

module.exports = mongoose.model('User', userSchema);
