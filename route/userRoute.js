const express = require('express');
const passport = require('passport'); 
const router = express.Router();
const userController = require('../controller/userController');
const userAuth = require("../middileware/user/userAuth");
const userAuthed = require("../middileware/user/userAuthed")
router.get('/',userAuthed,userController.getLand)

router.get('/signup',userAuthed, (req, res) => {
    res.render('user/signup', { error: null, message: null });
});

router.get('/auth/google', passport.authenticate('google', {
    scope: ['profile', 'email'], 
}));

router.get('/auth/google/callback', 
    passport.authenticate('google', {
        failureRedirect: '/login?error=Authentication failed', 
    }), 
    userController.googleLogin 
);



router.get('/login',userAuthed, (req, res) => {
    res.render('user/login',{ error:"",message:""});
    });
    
router.get('/home',userAuth,userController.getHome)
router.get('/products',userAuth, userController.getProducts);
router.get('/product-detail/:id',userAuth, userController.getProductDetail);
router.post('/signup', userController.userSignup);
router.post('/login', userController.userLogin);
router.post('/logout', (req, res) => {
    req.session.destroy()
        
    return res.redirect('/login'); // Handle the error appropriately
});
router.post('/verify-otp', userController.verifyOtp);
router.get('/verify-otp',userController.verifyOtpPage)      
router.post('/resend-otp', userController.resendOtp);  


module.exports = router;
