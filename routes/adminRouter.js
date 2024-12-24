const express = require('express');
const router = express.Router();
const adminController = require('../controllers/admin/adminController');
const {adminAuth} = require("../middlewares/auth");
const customerController = require('../controllers/admin/customerController')
const categoryController = require('../controllers/admin/categoryController')
const productController = require('../controllers/admin/productController')
const orderController = require('../controllers/admin/orderController')
const couponController = require('../controllers/admin/couponController')
const dashboardController = require('../controllers/admin/dashboardController')
const multer = require("multer");
const storage = require("../helpers/multer");
const uploads = multer({storage:storage});


router.get("/pageerror",adminController.pageerror)

//login management
router.get('/login',adminController.loadLogin);
router.post("/login",adminController.login);
router.get("/",adminAuth,adminController.loadDashboard)
router.get("/logout",adminController.logout)

//dashboard management
router.get("/dashboard", adminAuth,dashboardController.getDashboard);
router.get("/salesReport", adminAuth,dashboardController.salesList);
router.get("/download-excel",adminAuth, dashboardController.downloadExcelReport);
router.get("/download-pdf",adminAuth, dashboardController.downloadPDFReport);

//customer management
router.get("/users", adminAuth, customerController.customerInfo);
router.post("/customers/block/:id", adminAuth, customerController.blockCustomer);
router.post("/customers/unblock/:id", adminAuth, customerController.unblockCustomer);
router.delete("/customers/delete/:id", adminAuth, customerController.deleteCustomer);
router.get("/customers/:id", adminAuth, customerController.viewCustomer); // For viewing customer details

//category management
router.get("/category",adminAuth,categoryController.categoryInfo)
router.get("/addCategory", adminAuth, (req, res) => {
    res.render("addCategory");
});
router.post("/addCategory",adminAuth,categoryController.addCategory);
router.delete('/deleteCategory/:id',adminAuth, categoryController.deleteCategory);
router.get('/editCategory/:id',adminAuth, categoryController.gotoEditCategory);
router.post('/editCategory/:id',adminAuth, categoryController.editCategory);

//product management
router.get("/products",adminAuth,productController.productInfo)
router.get("/addProduct", adminAuth,productController.addProductPage);
router.post("/addProduct",adminAuth,uploads.array("images",4),productController.addProduct);
router.get('/blockProduct/:id',adminAuth,productController.blockProduct)
router.get('/unblockProduct/:id',adminAuth,productController.unblockProduct)
router.delete('/deleteProduct/:id',adminAuth, productController.deleteProduct);
router.get('/editProduct/:id',adminAuth, productController.gotoEditProduct);
router.post("/editProduct/:id",adminAuth,uploads.array("images",4),productController.editProduct);

//order management
router.get('/orders',adminAuth,orderController.listOrder);
router.patch('/updateOrderStatus/:orderId',orderController.updateOrderStatus);
router.get('/orderView/:orderId/:trackingNumber',adminAuth,orderController.orderView);
router.post('/cancel/:orderId/:trackingNumber', adminAuth, orderController.cancelOrder);
router.post('/approveReturn/:orderId/:trackingNumber', adminAuth, orderController.approveReturn);
router.post('/rejectReturn/:orderId/:trackingNumber', adminAuth, orderController.rejectReturn);
router.post('/pickupSuccess/:orderId/:trackingNumber', adminAuth, orderController.pickupSuccess);


//coupon management
router.get('/coupons',adminAuth,couponController.couponLoad);
router.get('/addCoupon',adminAuth,couponController.getAddCoupon);
router.post('/addCoupon',adminAuth,couponController.addCoupon);
router.post('/toggleCouponStatus/:id',adminAuth,couponController.updateStatus);
router.get('/editCoupon/:id',adminAuth,couponController.getEditCoupon);
router.post('/editCoupon/:id',adminAuth,couponController.editCoupon);
router.delete('/deleteCoupon/:id',adminAuth,couponController.deleteCoupon);


module.exports = router;