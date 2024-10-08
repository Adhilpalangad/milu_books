const express = require('express')
const router = express.Router()
const adminController = require('../controller/adminController')
const multer = require('multer');
const sharp = require('sharp');
const upload = require('../config/multerConfig');

router.get('/login', (req, res) => {
    res.send('user login admin')
})

router.get('/home', (req, res) => {
    res.render('admin/home')
})

router.get('/users',adminController.adminUsers)
router.post('/blockUser',adminController.blockUser);
router.post('/unblockUser', adminController.unblockUser)
router.post('/addBooks', upload.array('images', 3), adminController.addBooks);
router.get('/products', adminController.getBooks);
router.post('/editBooks', upload.array('images', 12), adminController.editBooks);
router.post('/deleteBook', adminController.deleleBook)
router.post('/addCategory', adminController.addCategory)
router.get('/create-category', adminController.createCategory)
router.post('/deleteCategory/:id',adminController.deleleCategory)
router.get('/orders', (req, res) => {
    res.render('admin/orders')
})

router.get('/category',adminController.getCategory)
router.get('/editCategory/:id',adminController.getEditCategory)
router.post('/editCategory/:id',adminController.editCategory)
router.get('/products', (req, res) => {
    res.render('admin/products', { message:null,books:null})
})


module.exports = router