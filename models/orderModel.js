const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    OrderId: { type: String, unique: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    items: [
        {
            productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Book', required: true },
            quantity: { type: Number, required: true }
        }
    ],
    address: {
        fullName: { type: String, required: true },
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        country: { type: String, required: true },
        postalCode: { type: String, required: true }
       
    },
    paymentMethod: { type: String, enum: ['bankTransfer', 'cashOnDelivery'], required: true },
    subtotal: { type: Number, required: true },
    shipping: { type: Number, required: true },
    total: { type: Number, required: true },
    status: { type: String, enum: ['pending', 'shipped', 'delivered', 'canceled'], default: 'pending' },
    cancelledAt: { type: Date },
    deliveredAt: { type: Date },
}, { timestamps: true });

orderSchema.pre('save', function (next) {
    if (this.isNew) {
        // Use backticks for template literal
        this.OrderId = `ORDER-${Date.now()}-${Math.floor(Math.random() * 10000)}`;
    }
    next();
});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;
