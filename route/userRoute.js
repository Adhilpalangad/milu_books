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
router.post('/cart/add', userAuth, cartController.addToCart); 
router.get('/cart', userAuth, cartController.getCart); 
router.post('/cart/remove', userAuth, cartController.removeFromCart);
router.post('/cart/update-quantity/:productId', userAuth, cartController.updateCartQuantity)
router.post('/checkout', userAuth, checkoutController.processCheckout);
router.get('/checkout', userAuth, cartController.getCartItems)
router.get('/success', userAuth,checkoutController.orderPlaced)
router.get('/profile', userAuth, checkoutController.getPersonal)
router.get('/profile/orders', userAuth, checkoutController.getOrders)
router.get('/profile/addresses', userAuth, userController.getAddresses)
router.post('/orders/cancel/:orderId', userAuth, checkoutController.cancelOrder);
// Route to render the forgot password page
router.get('/forgot-password', userController.forgotPasswordPage);

// Route to handle the forgot password request
router.post('/forgot-password', userController.forgotPassword);

// Route to render the verify OTP page
router.get('/verify-otp-forgot', userController.verifyOtpPass);

// Route to handle OTP verification
router.post('/verify-otp-forgot', userController.verifyForgotPasswordOtp);

// Route to render the reset password page
router.get('/reset-password', userController.resetPasswordPage);

// Route to handle password reset
router.post('/reset-password', userController.resetPassword);
router.post('/verify-payment', checkoutController.verifyPayment);

    

module.exports = router;
