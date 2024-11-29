const express = require('express');
const passport = require('passport'); 
const router = express.Router();
const userController = require('../controller/userController');
const cartController = require('../controller/cartController')
const checkoutController = require('../controller/checkoutController')
const userAuth = require("../middileware/user/userAuth");
const userAuthed = require("../middileware/user/userAuthed")
const nocache = (req, res, next) => {
    res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    next();
  };

router.get('/',userAuthed,userController.getLand)
router.get('/signup',nocache, userAuthed, userController.renderSignupPage);
router.get('/login',nocache, userController.renderLoginPage);
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
router.post('/signup',userAuthed, userController.userSignup);
router.post('/login',nocache,userAuthed, userController.userLogin);
router.post('/logout', userController.logout);
router.post('/verify-otp',userAuthed, userController.verifyOtp);
router.get('/verify-otp',userAuthed,userController.verifyOtpPage)      
router.post('/resend-otp',userAuthed, userController.resendOtp);  
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
router.get('/wallet/balance', userAuth,checkoutController.walletBalance)
router.get('/success', userAuth, checkoutController.orderPlaced)
router.get('/failed',userAuth,checkoutController.paymentFailed)
router.get('/profile', userAuth, checkoutController.getPersonal)
router.get('/profile/orders', userAuth, checkoutController.getOrders)
router.get('/profile/addresses', userAuth, userController.getAddresses)
router.post('/orders/:orderId/cancel/:productId', userAuth, checkoutController.cancelOrder);
router.get('/forgot-password',userAuth, userController.forgotPasswordPage);
router.post('/forgot-password',userAuth, userController.forgotPassword);
router.get('/verify-otp-forgot',userAuth, userController.verifyOtpPass);
router.post('/verify-otp-forgot',userAuth, userController.verifyForgotPasswordOtp);
router.get('/reset-password',userAuth, userController.resetPasswordPage);
router.post('/reset-password',userAuth, userController.resetPassword);
router.post('/verifyPayment',userAuth,checkoutController.verifyPayment)
router.post('/validateCoupon',userAuth,checkoutController.validateCoupon)
router.get('/wishlist',userAuth,userController.getWishlistItems) 
router.post('/wishlistAdd/:id',userAuth,userController.addBooksWishlist)    
router.post('/wishlist/remove/:id',userAuth, userController.removeWishlist)
router.post('/addtocart/wishlist',userAuth, cartController.addToCartFromWishlist)
router.get('/wallet',userAuth, userController.getWallet)
router.post('/orders/return/:orderId',userAuth, checkoutController.returnOrderRequest); // User return request
router.get('/orders/:orderId/invoice',userAuth,checkoutController.getInvoice)
router.put('/update-order-status/:orderId',userAuth,checkoutController.updateOrderStatus)
router.get('/order-details/:orderId',userAuth,checkoutController.retryPayment)
router.get('/contact',userAuth, userController.contactPage)
router.get('/about',userAuth, userController.aboutPage)
router.post('/cart/addProducts/:productId', userAuth, cartController.addToCart); 
router.post('/addresses/default/:id',userAuth, checkoutController.setDefaultAddress);


module.exports = router;
