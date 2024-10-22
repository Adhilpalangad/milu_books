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


const addToCart = async (req, res) => {
    const { productId } = req.body;
    const userId = req.session.user.id;

    try {
        let cart = await Cart.findOne({ userId });
        if (!cart) {
            cart = new Cart({ userId, items: [] });
        }

        const product = await Book.findById(productId);
        console.log(product);
        
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
                message: `Only ${product.stock - currentQuantityInCart} more items can be added to the cart`
            });
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
        console.log(userId);
        
        if (!userId) {
            return res.redirect('/login');
        }

        const cart = await Cart.findOne({ userId }).populate('items.productId');

        if (!cart || cart.items.length === 0) {
            return res.status(400).send('Your cart is empty');
        }

        const items = cart.items.map(item => ({
            productId: item.productId._id,
            name: item.productId.title,
            imageUrl: item.productId.images[0],
            price: item.productId.price,
            quantity: item.quantity,
        }));

        const subtotal = items.reduce((total, item) => total + item.price * item.quantity, 0);
        
        const addresses = await Address.find({ userId });

        // Calculate shipping cost (if applicable) and total
        const shippingCost = subtotal > 25 ? 0 : 5; // Example shipping cost logic
        const total = subtotal + shippingCost; // Calculate total

        // Pass total to the template
        res.render('user/checkout', { items, subtotal, total, addresses, cart });
    } catch (error) {
        console.error('Error fetching cart items:', error);
        res.status(500).send('Internal server error');
    }
};








module.exports = {
    addToCart,
    getCart,
    removeFromCart,
    updateCartQuantity,
    getCartItems
}