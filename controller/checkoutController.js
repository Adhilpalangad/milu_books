const express = require('express');
const  PDFDocument  = require('pdfkit')
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
const Razorpay = require('razorpay');
const fs = require('fs');
const path = require('path');

const mongoose = require('mongoose'); // Ensure mongoose is imported
const razorpay = new Razorpay({
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
        let offerDiscount = 0;
        const itemsToProcess = [];

        // Fetch active offers
        const currentDate = new Date();
        const offers = await Offer.find({
            isActive: true,
            validFrom: { $lte: currentDate },
            validUntil: { $gte: currentDate }
        });
        
        // Calculate subtotal, check product stock, and apply offer discounts
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
                const applicableCategories = offer.applicableCategories.map(id => id.toString());
                
                
        
                // Check if the product is eligible for the offer (either by product ID or category)
                if (
                    applicableProducts.includes(product._id.toString()) || 
                    applicableCategories.includes(product.categoryId.toString())  // Ensure comparison is done with string
                ) {
                    // Calculate the discount for this item
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

        // Create a new order in the database first
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
            discount: totalDiscount,
            shipping: shippingCost,
            total,
            status: 'pending',
            paymentStatus: req.body.paymentMethod === 'cashOnDelivery' ? 'pending' : 'failed' // Set initial payment status
        });
        

        await newOrder.save();

        // Create a Razorpay order with the newOrder ID
        const razorpayOrderOptions = {
            amount: total * 100, // Amount is in paise
            currency: 'INR',
            receipt: newOrder._id.toString(),
        };

        const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

        // Update the order with the Razorpay order ID
        newOrder.razorpayOrderId = razorpayOrder.id;
        await newOrder.save();

        // Clear the cart
        await Cart.deleteOne({ userId });

        // Return Razorpay order details to the frontend
        res.json({
            orderId: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            orderStatus: 'created',
        });
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

    const generatedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
        .update(razorpay_order_id + '|' + razorpay_payment_id)
        .digest('hex');

    if (generatedSignature === razorpay_signature) {
        try {
            const order = await Order.findOne({ razorpayOrderId: razorpay_order_id });
            if (!order) {
                return res.status(404).send('Order not found');
            }

            // Update the order status to 'paid'
            order.status = 'paid';
            order.razorpayPaymentId = razorpay_payment_id;
            order.razorpaySignature = razorpay_signature;
            order.paymentStatus = 'paid';
            await order.save();

            return res.json({ orderId: order.OrderId });
        } catch (error) {
            console.error('Error updating order status:', error);
            return res.status(500).send('Internal server error');
        }
    } else {
        return res.status(400).send('Payment verification failed');
    }
};

const updateOrderStatus = async (req, res) => {
    const { status } = req.query;
    const orderId = req.params.orderId;

    try {
        const order = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
        if (!order) {
            return res.status(404).send('Order not found');
        }
        return res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).send('Internal server error');
    }
}

const getOrders = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const page = parseInt(req.query.page) || 1; // Current page number from query parameter
        const limit = 5; // Number of orders per page

        // Query to get total number of orders
        const totalOrders = await Order.countDocuments({ userId });
        const totalPages = Math.ceil(totalOrders / limit);

        // Fetch orders for the current page with pagination and populate product details
        const orders = await Order.find({ userId })
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .populate('items.productId');

        // Pass pagination data to the view
        const currentUrl = req.url.split('?')[0]; // Base URL without query parameters
        res.render('user/profileOrders', {
            orders,
            currentUrl,
            currentPage: page,
            totalPages,
        });
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



const returnOrderRequest = async (req, res) => {
    const { orderId } = req.params;
    const { reason } = req.body; // Capture reason from the form

    try {
        const order = await Order.findById(orderId);
        if (!order) return res.status(404).send('Order not found');

        if (order.status !== 'delivered') return res.status(400).send('Only delivered orders can be returned');

        // Create a return request by updating the returnReason and setting returnStatus to 'pending'
        order.returnReason = reason;
        order.returnStatus = 'requested';
        await order.save();

        // If the reason is 'Product Damage', update the stock of the product
        if (reason === 'Product Damage') {
            // Update stock for each item in the order
            for (const item of order.items) {
                await Book.findByIdAndUpdate(item.productId._id, { $inc: { stock: item.quantity } });
            }
        }

        res.redirect('/profile/orders'); // Redirect after saving the request
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
    if (!orderId) {
        return res.status(400).send('Order ID is required');
    }

    res.render('user/succespage', { orderId });
    } catch (er)
    {
        console.log('error',er);
        
    }
}

const paymentFailed = async (req, res) => {
    try {
    res.render('user/paymentFailed');
    } catch (er)
    {
        console.log('error',er);   
    }
}


const generateInvoicePDF = async (
    order,
    res,
    companyInfo = {
      name: "MILU BOOKS",
      address: {
        street: "123 Book Street",
        city: "Book City",
        state: "Bookland",
        postalCode: "45678",
        country: "Book Country",
      },
      phone: "+1 (234) 567-8900",
      email: "support@milubooks.com",
      website: "www.milubooks.com",
    }
  ) => {
    const doc = new PDFDocument({ margin: 50 });
  
    // Set headers to prompt download as a PDF
    res.setHeader("Content-Disposition", `attachment; filename="invoice_${order.OrderId}.pdf"`);
    res.setHeader("Content-Type", "application/pdf");
  
    // Pipe PDF data directly to the response
    doc.pipe(res);
  
    // Define consistent positioning values
    const leftMargin = 50;
    const rightMargin = doc.page.width - 50;
    const contentWidth = rightMargin - leftMargin;
  
    const formatDate = (date) =>
      new Date(date).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  
    const drawHorizontalLine = (y = doc.y) => {
      doc.strokeColor("#cccccc").lineWidth(1).moveTo(leftMargin, y).lineTo(rightMargin, y).stroke();
    };
  
    // 1. Header Section
    doc.image("company/company.png", leftMargin, 40, { width: 60 });
    doc.fontSize(18).font("Helvetica-Bold").text(companyInfo.name, leftMargin + 80, 45);
  
    doc.fontSize(10).text(`Order ID: ${order.OrderId}`, leftMargin + 80, 65);
    doc.text(`Date: ${formatDate(order.createdAt)}`, leftMargin + 80, 80);
  
    drawHorizontalLine(100);
  
    // 2. Company Information Section
    doc.fontSize(12).font("Helvetica-Bold").text("From:", leftMargin, 110);
    doc.fontSize(10).font("Helvetica").text(companyInfo.name, leftMargin, 130);
    doc.text(`${companyInfo.address.street}, ${companyInfo.address.city}`, leftMargin, 145);
    doc.text(`${companyInfo.address.state}, ${companyInfo.address.country}`, leftMargin, 160);
    doc.text(`Phone: ${companyInfo.phone}`, leftMargin, 175);
    doc.text(`Email: ${companyInfo.email}`, leftMargin, 190);
    doc.text(`Website: ${companyInfo.website}`, leftMargin, 205);
  
    // 3. Billing Address Section
    const addressX = 300;
    doc.fontSize(12).font("Helvetica-Bold").text("Billing Address:", addressX, 110);
    doc.fontSize(10).font("Helvetica").text(order.address.fullName, addressX, 130);
    doc.text(`${order.address.street}, ${order.address.city}`, addressX, 145);
    doc.text(`${order.address.state}`, addressX, 175);
    doc.text(`Phone: ${order.address.country}`, addressX, 190);
  
    drawHorizontalLine(220);
  
    // 4. Order Items Section
    doc.fontSize(12).font("Helvetica-Bold").text("Order Items", leftMargin, 230);
  
    const colProduct = leftMargin;
    const colQuantity = 300;
    const colPrice = 370;
    const colTotal = 450;
  
    // Table headers
    doc.fontSize(10)
      .font("Helvetica-Bold")
      .text("Product", colProduct, 250)
      .text("Qty", colQuantity, 250)
      .text("Price", colPrice, 250)
      .text("Total", colTotal, 250);
  
    drawHorizontalLine(265);
  
    // Table content
    let yPosition = 275;
    order.items.forEach((item) => {
      const productName = item.productId.title;
      const unitPrice = item.productId.price;
      const quantity = item.quantity;
      const totalPrice = unitPrice * quantity;
  
      doc.fontSize(10).font("Helvetica")
        .text(productName, colProduct, yPosition, { width: 250 })
        .text(quantity.toString(), colQuantity, yPosition)
        .text(`$${unitPrice.toFixed(2)}`, colPrice, yPosition)
        .text(`$${totalPrice.toFixed(2)}`, colTotal, yPosition);
  
      yPosition += 20;
    });
  
    drawHorizontalLine(yPosition + 10);
  
    // 5. Summary Section
    const summaryStartY = yPosition + 30;
    const summaryLabelX = 350;
    const summaryValueX = 450;
  
    doc.fontSize(10)
      .font("Helvetica")
      .text("Subtotal:", summaryLabelX, summaryStartY)
      .text(`$${order.total.toFixed(2)}`, summaryValueX, summaryStartY);
  
    doc.text("Shipping:", summaryLabelX, summaryStartY + 20)
      .text(`$${order.shipping || 0}`, summaryValueX, summaryStartY + 20);
  
    if (order.discount) {
      doc.text("Discount:", summaryLabelX, summaryStartY + 40)
        .text(`-$${order.discount.toFixed(2)}`, summaryValueX, summaryStartY + 40);
    }
  
    drawHorizontalLine(summaryStartY + 60);
  
    // Final total calculation
    const finalTotal = order.total - (order.discount || 0) + (order.shipping || 0);
    doc.fontSize(12)
      .font("Helvetica-Bold")
      .text("Total:", summaryLabelX, summaryStartY + 70)
      .text(`$${finalTotal.toFixed(2)}`, summaryValueX, summaryStartY + 70);
  
    // 6. Footer Section
    const footerY = doc.page.height - 100;
    drawHorizontalLine(footerY);
  
    doc.fontSize(10)
      .font("Helvetica")
      .text("Thank you for shopping with MILU BOOKS!", leftMargin, footerY + 15, {
        width: contentWidth,
        align: "center",
      })
      .text("Contact us at support@milubooks.com", leftMargin, footerY + 30, {
        width: contentWidth,
        align: "center",
      });
  
    // Finalize the document
    doc.end();
  };
  
  
  
  // Usage example
  const getInvoice = async (req, res) => {
    try {
      const orderId = req.params.orderId;
      const order = await Order.findById(orderId).populate('items.productId');
  
      if (!order) {
        return res.status(404).send("Order not found");
      }
  
      // Generate the PDF and send it directly in the response
      generateInvoicePDF(order, res);
    } catch (error) {
      console.error("Error generating invoice PDF:", error.message);
      res.status(500).send("Failed to generate invoice PDF.");
    }
  };

const retryPayment = async (req, res) => {
    try {
        const orderId = req.params.orderId;
        const order = await Order.findById(orderId);
        
        // Assuming `razorpayOrderId` and `amount` are saved with the order
        res.json({
            orderId: order.razorpayOrderId,
            amount: order.total * 100, // Amount in smallest currency unit
            currency: 'INR'
        });
    } catch (error) {
        console.error("Error fetching order details:", error);
        res.status(500).send("Error fetching order details");
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
    returnOrderRequest,
    getInvoice,
    updateOrderStatus,
    retryPayment,
    paymentFailed
};
