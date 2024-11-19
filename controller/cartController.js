const User = require("../models/userModel")
const router = require("../route/adminRoute")
const Cart = require("../models/cartModel")
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

const addToCart = async (req, res) => {
    const { productId } = req.params;
    const userId = req.session.user.id;
    console.log('Product ID:', productId);

    try {
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const product = await Book.findById(productId);

        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        let currentQuantityInCart = 0;
        if (existingItemIndex >= 0) {
            currentQuantityInCart = cart.items[existingItemIndex].quantity;
        }

        const requestedQuantity = currentQuantityInCart + 1;
        if (requestedQuantity > product.stock) {
            return res.status(400).json({
                success: false,
                message: `Stock of this is Limited`
            });
        }

        if (requestedQuantity > 5) {
            return res.status(400).json({
                success: false,
                message: 'Maximum quantity is 5'
            })
        }

        if (existingItemIndex >= 0) {
            if (currentQuantityInCart < product.stock) {
                cart.items[existingItemIndex].quantity += 1;
            } else {
                return res.status(400).json({
                    success: false,
                    message: `Only ${product.stock - currentQuantityInCart} more items can be added to the cart`
                });
            }
        } else {
            cart.items.push({ productId: product._id, quantity: 1 });
        }

        await cart.save();

        // Respond with JSON (not render or redirect)
        res.json({ success: true, message: 'Product added to cart successfully!' });

    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error adding to cart' });
    }
};
    




const getCart = async (req, res) => {
    const userId = req.session.user.id;

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart) {
            return res.render('user/cart', { items: [] });
        }

        const items = cart.items.map(item => {
            return {
                productId: item.productId._id,
                name: item.productId.title,
                imageUrl: item.productId.images[0], 
                price: item.productId.price,
                quantity: item.quantity,
                total: item.productId.price * item.quantity 
            };
        });

        res.render('user/cart', { items });
    } catch (error) {
        console.log(error);
        res.status(500).send('Error fetching cart');
    }
};

const removeFromCart = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user.id;

    try {
        let cart = await Cart.findOne({ userId });

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        const itemIndex = cart.items.findIndex(item => item.productId.toString() === productId);

        if (itemIndex >= 0) {
            cart.items.splice(itemIndex, 1);

            if (cart.items.length === 0) {
                await Cart.deleteOne({ userId });
            } else {
                await cart.save();
            }

            return res.status(200).json({ message: 'Item removed from cart' });
        } else {
            return res.status(404).json({ message: 'Item not found in cart' });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: 'Error removing item from cart' });
    }
};


const updateCartQuantity = async (req, res) => {
    const { productId } = req.params;
    const { action } = req.body;
    const userId = req.session.user.id;

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart) return res.status(404).json({ success: false, message: 'Cart not found' });

        const itemIndex = cart.items.findIndex(item => item.productId._id.toString() === productId);
        if (itemIndex === -1) {
            return res.status(404).json({ success: false, message: 'Product not found in cart' });
        }

        const product = cart.items[itemIndex].productId;

      
        if (action === 'increase') {
            if (cart.items[itemIndex].quantity >= product.stock) {
                return res.status(400).json({
                    success: false,
                    message: 'You cannot add more than the available stock.',
                    stock: product.stock
                });
            }
            cart.items[itemIndex].quantity += 1;
        } else if (action === 'decrease') {
            cart.items[itemIndex].quantity -= 1;
        }

      
        if (cart.items[itemIndex].quantity <= 0) {
            cart.items.splice(itemIndex, 1);
        }

        await cart.save();

   
        const cartTotal = cart.items.reduce((total, item) => {
            return total + item.quantity * item.productId.price;
        }, 0);

        res.json({
            success: true,
            quantity: cart.items[itemIndex] ? cart.items[itemIndex].quantity : 0,
            cartTotal,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error updating cart' });
    }
};


const getCartItems = async (req, res) => {
    try {
        const userId = req.session.user.id;

        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.redirect('/cart'); // Ensure function exits after redirect
        }

        // Map cart items for displaying
        const items = cart.items.map(item => ({
            productId: item.productId._id,
            name: item.productId.title,
            imageUrl: item.productId.images[0],
            price: item.productId.price,
            quantity: item.quantity
        }));

        // Calculate subtotal
        const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);

        // **Apply Offer Logic**
        let offerDiscount = 0;
        const currentDate = new Date();
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: currentDate },
            validUntil: { $gte: currentDate }
        });

        for (let offer of offers) {
            const applicableProducts = offer.applicableProducts.map(id => id.toString());
            const applicableCategories = offer.applicableCategories.map(id => id.toString()); // Ensure it's an array of strings
            console.log('applicable category', applicableCategories);
            for (let item of cart.items) {
                const product = item.productId;

                if (
                    applicableProducts.includes(product._id.toString()) || 
                    applicableCategories.includes(product.categoryId.toString())  
                ) {
                    offerDiscount += (product.price * item.quantity * offer.discount) / 100;
                }
            }
        }

        const additionalFee = subtotal < 25 ? 5 : 0; 
        const total = subtotal - offerDiscount + additionalFee;

        console.log('subtotal', subtotal);
        console.log('offerDiscount', offerDiscount);
        console.log('total', total);

        const addresses = await Address.find({ userId });
        
        // Render checkout page
        res.render('user/checkout', { items, subtotal, offerDiscount, addresses, cart, total });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Internal server error');
    }
};

const addToCartFromWishlist = async (req, res) => {
    

    try {
        const { productId } = req.body;
    const userId = req.session.user.id;
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const product = await Book.findById(productId);
        console.log('product from wishlist',product)
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }

        // Check if the product is already in the cart
        const existingItemIndex = cart.items.findIndex(item => item.productId.toString() === productId);
        let currentQuantityInCart = existingItemIndex >= 0 ? cart.items[existingItemIndex].quantity : 0;

        // Verify stock availability
        if (currentQuantityInCart + 1 > product.stock) {
            return res.status(400).json({ 
                success: false, 
                message: `Only ${product.stock - currentQuantityInCart} more items can be added to the cart`
            });
        }

        // Update quantity if the product is already in the cart, else add as a new item
        if (existingItemIndex >= 0) {
            cart.items[existingItemIndex].quantity += 1;
        } else {
            cart.items.push({ productId: product._id, quantity: 1 });
        }

        // Save updated cart
        await cart.save();

        // Remove the product from the wishlist after adding it to the cart
        await Wishlist.findOneAndUpdate(
            { userId },
            { $pull: { items: { productId: product._id } } }
        );

        // Redirect to the wishlist page or send a success response
        res.redirect('/wishlist');
    } catch (error) {
        console.error(error);
        res.status(500).json({ success: false, message: 'Error moving item to cart' });
    }
};








module.exports = {
    addToCart,
    getCart,
    removeFromCart,
    updateCartQuantity,
    getCartItems,
    addToCartFromWishlist
}