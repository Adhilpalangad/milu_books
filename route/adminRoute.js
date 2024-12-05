const express = require('express')
const router = express.Router()
const adminController = require('../controller/adminController')
const multer = require('multer');
const sharp = require('sharp');
const upload = require('../config/multerConfig');
const adminAuth = require("../middileware/admin/adminAuth");
const adminAuthed = require("../middileware/admin/adminAuthed")

router.get('/', adminAuthed, adminController.login)
router.post('/',adminController.postLogin)
router.get('/users',adminAuth,adminController.adminUsers)
router.post('/blockUser',adminAuth,adminController.blockUser);
router.post('/unblockUser',adminAuth, adminController.unblockUser)
router.post('/addBooks', upload.array('images', 3), adminController.addBooks);
router.get('/products',adminAuth, adminController.getBooks);
router.post('/editBooks',adminAuth, upload.array('images', 12), adminController.editBooks);
router.post('/deleteBook',adminAuth, adminController.deleleBook)
router.post('/addCategory',adminAuth, adminController.addCategory)
router.get('/create-category',adminAuth, adminController.createCategory)
router.post('/deleteCategory/:id',adminAuth,adminController.deleleCategory)
router.get('/orders',adminAuth,adminController.getOrders)
router.get('/category',adminAuth,adminController.getCategory)
router.get('/editCategory/:id',adminAuth,adminController.getEditCategory)
router.post('/editCategory/:id',adminAuth,adminController.editCategory)
router.post('/logout', (req, res) => {
    req.session.destroy()   
    return res.redirect('admin/login'); 
});
// Route in your order router
router.post('/orders/:orderId/status',adminAuth, adminController.updateOrderStatus);
router.post('/create-coupon',adminAuth, adminController.createCoupon);
router.post('/deactivate-coupon/:id', adminController.deactivateCoupon);
router.get('/coupons',adminAuth,adminController.getCoupons)
router.get('/getCreateCoupon',adminAuth,adminController.getCreateCoupon)
router.post('/deleteCoupon/:id',adminAuth,adminController.deactivateCoupon)
router.get('/editCoupon/:id',adminAuth, adminController.getEditCoupon);
router.post('/editCoupon/:id',adminAuth, adminController.updateCoupon);
router.get('/offer-management',adminAuth, adminController.getOfferManagementPage);
router.get('/getCreateOffer',adminAuth, adminController.renderCreateOfferPage);
router.post('/createOffer',adminAuth, adminController.createOffer);
router.get('/editOffer/:offerId',adminAuth, adminController.renderEditOfferPage);
router.post('/updateOffer/:offerId',adminAuth, adminController.updateOffer);
router.post('/toggleOfferStatus/:offerId',adminAuth, adminController.toggleOfferStatus);
router.get('/report',adminAuth,adminController.getDeliveredSalesReport)
router.route('/downloadSalesReport')
  .get(adminAuth,adminController.downloadSalesReport)
  .post(adminAuth,adminController.downloadSalesReport);
router.post('/filterSalesReport',adminAuth,adminController.filterSalesReport)
router.post('/orders/:orderId/return/approve', adminAuth, adminController.approveReturnRequest);
router.post('/orders/:orderId/return/reject', adminAuth, adminController.rejectReturnRequest); 
router.get('/home',adminAuth, adminController.renderDashboard);

router.get('/dashboard-data',adminAuth, adminController.getDashboardData);



module.exports = router