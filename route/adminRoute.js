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
router.post('/blockUser',adminController.blockUser);
router.post('/unblockUser', adminController.unblockUser)
router.post('/addBooks', upload.array('images', 3), adminController.addBooks);
router.get('/products',adminAuth, adminController.getBooks);
router.post('/editBooks', upload.array('images', 12), adminController.editBooks);
router.post('/deleteBook', adminController.deleleBook)
router.post('/addCategory', adminController.addCategory)
router.get('/create-category',adminAuth, adminController.createCategory)
router.post('/deleteCategory/:id',adminController.deleleCategory)
router.get('/orders',adminAuth,adminController.getOrders)
router.get('/category',adminAuth,adminController.getCategory)
router.get('/editCategory/:id',adminAuth,adminController.getEditCategory)
router.post('/editCategory/:id',adminController.editCategory)
router.post('/logout', (req, res) => {
    req.session.destroy()   
    return res.redirect('admin/login'); 
});
// Route in your order router
router.post('/orders/:orderId/status', adminController.updateOrderStatus);
router.post('/create-coupon', adminController.createCoupon);
router.post('/deactivate-coupon/:id', adminController.deactivateCoupon);
router.get('/coupons',adminController.getCoupons)
router.get('/getCreateCoupon',adminController.getCreateCoupon)
router.post('/deleteCoupon/:id',adminController.deactivateCoupon)
router.get('/editCoupon/:id', adminController.getEditCoupon);
router.post('/editCoupon/:id', adminController.updateCoupon);
router.get('/offer-management', adminController.getOfferManagementPage);
router.get('/getCreateOffer', adminController.renderCreateOfferPage);
router.post('/createOffer', adminController.createOffer);
router.get('/editOffer/:offerId', adminController.renderEditOfferPage);
router.post('/updateOffer/:offerId', adminController.updateOffer);
router.post('/toggleOfferStatus/:offerId', adminController.toggleOfferStatus);
router.get('/report',adminController.getDeliveredSalesReport)
router.route('/downloadSalesReport')
  .get(adminController.downloadSalesReport)
  .post(adminController.downloadSalesReport);
router.post('/filterSalesReport',adminController.filterSalesReport)
  router.post('/orders/:orderId/return/approve',adminController.approveReturnRequest); // Admin approval
router.post('/orders/:orderId/return/reject', adminController.rejectReturnRequest);  
router.get('/home', adminController.renderDashboard);

router.get('/dashboard-data', adminController.getDashboardData);



module.exports = router