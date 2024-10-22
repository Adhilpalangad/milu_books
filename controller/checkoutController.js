const express = require('express');
const router = express.Router();
const Book = require('../models/productModel'); 
const Order = require('../models/orderModel'); 
const Cart = require("../models/cartModel")
const Address = require('../models/addressModel')
const User = require("../models/userModel")
const Razorpay = require('razorpay');
const crypto = require('crypto');
require('dotenv').config();


const razorpayInstance = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});


const processCheckout = async (req, res) => {
    const userId = req.session.user.id;

    if (!userId) {
        return res.status(401).send('User not authenticated');
    }

    try {
        const cart = await Cart.findOne({ userId }).populate('items.productId');
        if (!cart || cart.items.length === 0) {
            return res.status(400).send('No items in the cart');
        }

        let subtotal = 0;
        const itemsToProcess = [];

        for (let item of cart.items) {
            const product = item.productId;

            if (!product) {
                return res.status(400).send(`Product not found for ID: ${item.productId}`);
            }
            if (product.stock < item.quantity) {
                return res.status(400).send(`Not enough stock for ${product.title}`);
            }

            subtotal += product.price * item.quantity;
            itemsToProcess.push({
                productId: product._id,
                quantity: item.quantity
            });
            product.stock -= item.quantity;
            await product.save();
        }

        let address;
        if (req.body.selectedAddress) {
            address = await Address.findById(req.body.selectedAddress);
            if (!address) {
                return res.status(400).send('Selected address not found');
            }
        } else {
            address = new Address({
                userId,
                fullName: req.body.fullName,
                street: req.body.street,
                city: req.body.city,
                state: req.body.state,
                country: req.body.country,
                postalCode: req.body.postalCode,
                isDefault: false
            });
            await address.save();
        }

        const shippingCost = subtotal > 25 ? 0 : 5;
        const total = subtotal + shippingCost;

        // Create Razorpay order
        const razorpayOptions = {
            amount: total * 100, // Convert to paise (Razorpay expects amount in paise)
            currency: 'INR',
            receipt: `order_rcptid_${Date.now()}`
        };

        const razorpayOrder = await razorpay.orders.create(razorpayOptions);

        const newOrder = new Order({
            userId,
            items: itemsToProcess,
            address: {
                fullName: address.fullName,
                street: address.street,
                city: address.city,
                state: address.state,
                country: address.country,
                postalCode: address.postalCode,
            },
            paymentMethod: req.body.paymentMethod,
            subtotal,
            shipping: shippingCost,
            total,
            razorpayOrderId: razorpayOrder.id, // Store the Razorpay order ID
            status: 'Pending',
        });

        await newOrder.save();
        await Cart.deleteOne({ userId });

        // Send Razorpay order details to the frontend
        res.json({
            success: true,
            orderId: newOrder._id,
            razorpayOrderId: razorpayOrder.id,
            amount: total * 100,
            key: process.env.RAZORPAY_KEY_ID,
            currency: 'INR',
        });
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).send('Internal server error');
    }
}

const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const secret = process.env.RAZORPAY_SECRET; // Secret from Razorpay

    const generated_signature = crypto
        .createHmac('sha256', secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generated_signature === razorpay_signature) {
        // Payment is successful
        try {
            // Mark order as paid in your database
            await Order.findByIdAndUpdate(orderId, {
                status: 'Paid',
                razorpay_payment_id: razorpay_payment_id, // Store the Razorpay payment ID
                razorpay_order_id: razorpay_order_id, // Store the Razorpay order ID
                razorpay_signature: razorpay_signature // Store the Razorpay signature for verification
            });

            res.status(200).json({ success: true, message: "Payment verified successfully" });
        } catch (error) {
            console.error('Error updating order status:', error);
            res.status(500).json({ success: false, message: "Database error" });
        }
    } else {
        // Payment verification failed
        res.status(400).json({ success: false, message: "Invalid payment signature" });
    }
};


const getOrders = async (req, res) => {
    try {
        const userId = req.session.user.id; 
        console.log("User ID:", userId)
        const orders = await Order.find({ userId }).populate('items.productId');
        console.log("Orders:", orders);
        const currentUrl = req.url;
        res.render('user/profileOrders', { orders,currentUrl }); 
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};
    

const cancelOrder = async (req, res) => {
    const { orderId } = req.params; 

    try {
        await Order.findByIdAndUpdate(orderId, {
            status: 'cancelled',
            cancelledAt: new Date() 
        });
        
      
        res.redirect('/profile/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};



const getPersonal = async (req, res) => {
    try {
        const userId = req.session.user.id;

        if (!userId) {
            return res.status(401).send('User not authenticated');
        }

      
        const user = await User.findById(userId);

       
        const addresses = await Address.find({ userId: userId });
        const currentUrl = req.url;
       
        res.render('user/profilePersonal', {
            orders: '',
            currentUrl ,
            name: user.name,
            email: user.email,
            phone: user.phone || '',
            gender: user.gender || '', 
            addresses: addresses 
        });
    } catch (error) {
        console.log(error);
        
        res.status(500).send('Error fetching user data');
    }
};

const orderPlaced = async (req, res) => {
    try {
    const orderId = req.query.orderId;
       ;
        
    if (!orderId) {
        return res.status(400).send('Order ID is required');
    }

    res.render('user/succespage', { orderId });
    } catch (er)
    {
        console.log('error',er);
        
    }
}






module.exports = {
    processCheckout,
    getOrders,
    cancelOrder,
    getPersonal,
    orderPlaced,
    verifyPayment
};
