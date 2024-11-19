const express = require('express');
const passport = require('passport'); 
const router = express.Router();
const userController = require('../controller/userController');
const cartController = require('../controller/cartController')
const checkoutController = require('../controller/checkoutController')
const userAuth = require("../middileware/user/userAuth");
const userAuthed = require("../middileware/user/userAuthed")
router.get('/',userAuthed,userController.getLand)
router.get('/signup', userAuthed, userController.renderSignupPage);
router.get('/login', userAuthed, userController.renderLoginPage);
// Google login route
router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'], 
}));

// Google callback route
router.get('/auth/google/callback', 
    passport.authenticate('google', {
        failureRedirect: '/login?error=Authentication failed', 
    }), 
    userController.googleLogin // Redirect to user controller after authentication
);

router.get('/login',userAuthed, (req, res) => {
    res.render('user/login',{ error:"",message:""});
    });   
router.get('/home',userAuth,userController.getHome)
router.get('/products',userAuth, userController.getProducts);
router.get('/product-detail/:id',userAuth, userController.getProductDetail);
router.post('/signup', userController.userSignup);
router.post('/login', userController.userLogin);
router.post('/logout', userController.logout);
router.post('/verify-otp', userController.verifyOtp);
router.get('/verify-otp',userController.verifyOtpPage)      
router.post('/resend-otp', userController.resendOtp);  
router.get('/profile', userAuth, userController.getProfile)
router.post('/profile/update', userAuth,userController.profileEdit)
router.post('/addresses/add', userAuth, userController.addAddress);
router.post('/addresses/edit/:addressId', userAuth, userController.editAddress);
router.post('/addresses/delete/:addressId', userAuth, userController.deleteAddress);
router.post('/cart/add/:productId', userAuth, cartController.addToCart); 
router.get('/cart', userAuth, cartController.getCart); 
router.post('/cart/remove', userAuth, cartController.removeFromCart);
router.post('/cart/update-quantity/:productId', userAuth, cartController.updateCartQuantity)
router.post('/verify-razorpay-payment', checkoutController.verifyPayment);
router.post('/checkout', userAuth, checkoutController.processCheckout);
router.get('/checkout', userAuth, cartController.getCartItems)
router.get('/success', userAuth, checkoutController.orderPlaced)
router.get('/failed',userAuth,checkoutController.paymentFailed)
router.get('/profile', userAuth, checkoutController.getPersonal)
router.get('/profile/orders', userAuth, checkoutController.getOrders)
router.get('/profile/addresses', userAuth, userController.getAddresses)
router.post('/orders/cancel/:orderId', userAuth, checkoutController.cancelOrder);
router.get('/forgot-password', userController.forgotPasswordPage);
router.post('/forgot-password', userController.forgotPassword);
router.get('/verify-otp-forgot', userController.verifyOtpPass);
router.post('/verify-otp-forgot', userController.verifyForgotPasswordOtp);
router.get('/reset-password', userController.resetPasswordPage);
router.post('/reset-password', userController.resetPassword);
router.post('/verifyPayment',checkoutController.verifyPayment)
router.post('/validateCoupon',checkoutController.validateCoupon)
router.get('/wishlist',userController.getWishlistItems) 
router.post('/wishlistAdd/:id',userController.addBooksWishlist)    
router.post('/wishlist/remove/:id', userController.removeWishlist)
router.post('/addtocart/wishlist', cartController.addToCartFromWishlist)
router.get('/wallet', userController.getWallet)
router.post('/orders/return/:orderId', checkoutController.returnOrderRequest); // User return request
router.get('/orders/:orderId/invoice',checkoutController.getInvoice)
router.put('/update-order-status/:orderId',checkoutController.updateOrderStatus)
router.get('/order-details/:orderId',checkoutController.retryPayment)
router.get('/contact', userController.contactPage)
router.get('/about', userController.aboutPage)
router.post('/cart/addProducts/:productId', userAuth, cartController.addToCart); 

module.exports = router;
