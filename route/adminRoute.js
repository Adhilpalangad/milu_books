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

router.get('/home',adminAuth, (req, res) => {
    res.render('admin/home')
})

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
router.get('/orders',adminAuth, (req, res) => {
    res.render('admin/orders')
})

router.get('/category',adminAuth,adminController.getCategory)
router.get('/editCategory/:id',adminAuth,adminController.getEditCategory)
router.post('/editCategory/:id',adminController.editCategory)
router.post('/logout', (req, res) => {
    req.session.destroy()   
    return res.redirect('admin/login'); // Handle the error appropriately
});


module.exports = router