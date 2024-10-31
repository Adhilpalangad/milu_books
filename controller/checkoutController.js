const express = require('express');
const router = express.Router();
const Book = require('../models/productModel'); 
const Order = require('../models/orderModel'); 
const Cart = require("../models/cartModel")
const Address = require('../models/addressModel')
const User = require("../models/userModel")
const Coupon = require('../models/couponModel');
const crypto = require('crypto');
const Offer = require('../models/offerModel')
const Wallet = require('../models/walletModel')
require('dotenv').config();


const mongoose = require('mongoose'); // Ensure mongoose is imported



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
        let offerDiscount = 0;
        const itemsToProcess = [];

        // Fetch active offers
        const currentDate = new Date();
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: currentDate },
            validUntil: { $gte: currentDate }
        });

        // Calculate the subtotal, check product stock, and apply offer discounts
        for (let item of cart.items) {
            const product = item.productId;

            if (!product) {
                return res.status(400).send(`Product not found for ID: ${item.productId}`);
            }
            if (product.stock < item.quantity) {
                return res.status(400).send(`Not enough stock for ${product.title}`);
            }

            // Accumulate subtotal
            subtotal += product.price * item.quantity;

            // Check for applicable offers
            for (let offer of offers) {
                const applicableProducts = offer.applicableProducts.map(id => id.toString());
                const applicableCategories = offer.applicableCategories;

                if (applicableProducts.includes(product._id.toString()) || applicableCategories.includes(product.category)) {
                    offerDiscount += (product.price * item.quantity * offer.discount) / 100;
                }
            }

            itemsToProcess.push({
                productId: product._id,
                quantity: item.quantity
            });

            // Reduce stock
            product.stock -= item.quantity;
            await product.save();
        }

        // Apply coupon logic (if any)
        let couponDiscount = 0;
        if (req.body.couponCode) {
            const coupon = await Coupon.findOne({ code: req.body.couponCode, isActive: true });
            if (coupon && currentDate >= coupon.validFrom && currentDate <= coupon.validUntil && subtotal >= coupon.minOrderValue) {
                couponDiscount = (subtotal * coupon.discount) / 100;
            } else {
                return res.status(400).send('Invalid or expired coupon');
            }
        }

        // Calculate final totals after discounts
        const totalDiscount = offerDiscount + couponDiscount;
        const shippingCost = subtotal > 25 ? 0 : 5;
        const total = subtotal - totalDiscount + shippingCost;

        // Fetch or save the address
        let address;
        if (req.body.selectedAddress) {
            address = await Address.findById(req.body.selectedAddress);
            if (!address) {
                return res.status(400).send('Selected address not found');
            }
        } else {
            // If no selected address, create a new one
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

        // Create a new order
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
            discount: totalDiscount, // Store the combined offer and coupon discount
            shipping: shippingCost,
            total
        });
        
        // Save the order and clear the cart
        await newOrder.save();
        await Cart.deleteOne({ userId });

        // Redirect to success page with the order ID
        res.redirect(`/success?orderId=${newOrder._id}`);
    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).send('Internal server error');
    }
};


const validateCoupon = async (req, res) => { 
    const { couponCode, subtotal } = req.body;
    try {
        const coupon = await Coupon.findOne({ code: couponCode, isActive: true });
        
        if (!coupon) {
            return res.status(400).json({ message: 'Invalid or expired coupon' });
        }

        const currentDate = new Date();
        if (currentDate < coupon.validFrom || currentDate > coupon.validUntil) {
            return res.status(400).json({ message: 'Coupon is not valid at this time' });
        }

        if (subtotal < coupon.minOrderValue) {
            return res.status(400).json({ message: `Minimum order value for this coupon is ₹${coupon.minOrderValue}` });
        }

        // Calculate discount
        const discount = (subtotal * coupon.discount) / 100;
        const total = subtotal - discount;

        res.json({ total, discount, message: 'Coupon applied successfully' });
    } catch (error) {
        console.error('Error validating coupon:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
}




const verifyPayment = async (req, res) => {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    // Verification logic using Razorpay's signature verification
    const generated_signature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');

    if (generated_signature === razorpay_signature) {
        const order = await Order.findOneAndUpdate({ razorpayOrderId: razorpay_order_id }, {
            razorpayPaymentId: razorpay_payment_id,
            razorpaySignature: razorpay_signature
        });
        return res.json({ success: true });
    } else {
        return res.status(400).json({ success: false, message: 'Payment verification failed' });
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
    

 // Adjust the path according to your structure

 const cancelOrder = async (req, res) => {
    const { orderId } = req.params;

    try {
        // Find the order to get the items and userId
        const order = await Order.findById(orderId).populate('items.productId');

        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Update the order status to cancelled
        await Order.findByIdAndUpdate(orderId, {
            status: 'cancelled',
            cancelledAt: new Date()
        });

        // Check if there is at least one item to cancel
        if (order.items.length > 0) {
            // Assuming we only cancel the first item in the order for this example
            const itemToCancel = order.items[0]; // Get the first item
            const product = itemToCancel.productId; // Get the populated product

            // Prepare the message with the specific book name
            const message = `Order cancelled. Book: ${product.title}`; // Get the book name

            // Increase the stock quantity of the canceled book
            await Book.findByIdAndUpdate(product._id, {
                $inc: { stock: itemToCancel.quantity } // Increment stock by the quantity of the item
            });

            // Wallet operations only for payments that are not cash on delivery
            if (order.paymentMethod !== 'cashOnDelivery') {
                const userId = order.userId; // Assuming the order has a userId field
                const orderTotal = order.total; // Assuming the total amount is stored in the order

                // Find or create the wallet for the user
                let wallet = await Wallet.findOne({ userId });
                if (!wallet) {
                    wallet = await Wallet.create({ userId });
                }

                // Credit the wallet and log the transaction
                wallet.balance += orderTotal; // Add the order total to the wallet balance
                wallet.transactions.push({
                    amount: orderTotal,
                    transactionType: 'credit',
                    orderId: orderId,
                    message: message // Include the message about the cancelled book
                });

                await wallet.save(); // Save the updated wallet
            }
        }

        res.redirect('/profile/orders');
    } catch (error) {
        console.error(error);
        res.status(500).send('Server error');
    }
};



const returnOrder = async (req, res) => {
    const { orderId } = req.params; 

    try {
        // Find the order to get the items and userId
        const order = await Order.findById(orderId).populate('items.productId');
        
        if (!order) {
            return res.status(404).send('Order not found');
        }

        // Update the order status to returned
        await Order.findByIdAndUpdate(orderId, {
            status: 'returned',
            returnedAt: new Date() // Add a field for the return date if necessary
        });

        // Increase the quantity of each item back to stock
        for (const item of order.items) {
            const product = item.productId; // Assuming item.productId is populated
            // Increase the stock quantity
            await Book.findByIdAndUpdate(product._id, {
                $inc: { stock: item.quantity } // Increment stock by the quantity of the item
            });
        }

        // Wallet operations only if the return is for a paid order
        if (order.paymentMethod !== 'cashOnDelivery') {
            const userId = order.userId; // Assuming the order has a userId field
            const orderTotal = order.total; // Assuming the total amount is stored in the order

            // Find or create the wallet for the user
            let wallet = await Wallet.findOne({ userId });
            if (!wallet) {
                wallet = await Wallet.create({ userId });
            }

            // Credit the wallet and log the transaction
            wallet.balance += orderTotal; // Add the order total to the wallet balance
            wallet.transactions.push({
                amount: orderTotal,
                transactionType: 'credit',
                orderId: orderId,
            });

            await wallet.save(); // Save the updated wallet
        }

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
    verifyPayment,
    validateCoupon,
    returnOrder
};
