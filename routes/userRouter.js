const express=require('express');
const router=express.Router();
const userController=require("../controllers/user/userController");
const profileController=require("../controllers/user/profileController");
const productController=require("../controllers/user/productController");
const cartController=require("../controllers/user/cartController");
const checkoutController=require("../controllers/user/checkoutController");
const orderController=require("../controllers/user/orderController");
const wishlistController=require("../controllers/user/wishlistController");
const couponController=require("../controllers/user/couponController");
const passport = require('passport');
const userAuth = require("../middlewares/auth");
const flash = require('connect-flash');


router.use(flash());
// Set global variables for flash messages
router.use((req, res, next) => {
  res.locals.success_msg = req.flash('success_msg');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// Middleware to add common variables
router.use((req, res, next) => {
  res.locals.searchQuery = req.query.search || ''; 
  next();
});



router.get('/login',userController.loadLogin)
router.post('/login',userController.login)
router.get('/pageNotFound',userController.pageNotFound)
router.get('/signup',userController.loadSignup)
router.get('/',userController.loadHomepage)
router.post('/signup',userController.signup)
router.post('/verify-otp',userController.verifyOtp)
router.post('/resend-otp',userController.resendOtp)
router.get('/auth/google',passport.authenticate('google',{scope:['profile','email']}));
router.get('/auth/google/callback', passport.authenticate('google', { failureRedirect: "/signup" }), (req, res) => {
    res.redirect('/');
});

//Show product
router.get('/showProducts',productController.listProducts)
router.get('/eachProduct',productController.loadSingleProduct);

// Profile routes
router.get('/account',userAuth.userAuth,profileController.getAccount)
router.get('/profile', userAuth.userAuth, profileController.getUserProfile);
router.post('/update-profile', userAuth.userAuth, profileController.editProfile);
router.post('/change-password', userAuth.userAuth, profileController.changePassword);
router.get('/verify-email-otp', userAuth.userAuth, profileController.getVerifyEmailOtpPage);
router.post('/verify-email-otp', userAuth.userAuth, profileController.verifyEmailOtp);
router.post('/verify-email-otp/resend', userAuth.userAuth, profileController.resendEmailOtp);
router.get('/verify-password-otp', userAuth.userAuth, profileController.getVerifyPasswordOtpPage);
router.post('/verify-password-otp', userAuth.userAuth, profileController.verifyPasswordOtp);
router.post('/verify-password-otp/resend', userAuth.userAuth, profileController.resendPasswordOtp);

//wallet
router.get('/wallet',userAuth.userAuth,profileController.getWallet)

// Address routes
router.get('/address',userAuth.userAuth,profileController.getAddress)
router.get('/add-address', userAuth.userAuth, profileController.getAddressForm);
router.post('/add-address', userAuth.userAuth, profileController.addAddress);
router.get('/edit-address/:id', userAuth.userAuth, profileController.getEditAddressForm);
router.post('/edit-address/:id', userAuth.userAuth, profileController.updateAddress);
router.delete('/delete-address/:id', userAuth.userAuth, profileController.deleteAddress);

//Cart 
router.get("/cart",userAuth.userAuth, cartController.cartLoad);
router.get('/addToCart', userAuth.userAuth, cartController.addToCart);
router.get('/buyNow', userAuth.userAuth, cartController.buyNow);
router.get('/incrementCart/:id',userAuth.userAuth,cartController.incrementCart);
router.get('/decrementCart/:id',userAuth.userAuth,cartController.decrementCart);
router.get('/removeCart/:id', userAuth.userAuth, cartController.removeCart);

//wishlist
router.get("/wishlist",userAuth.userAuth, wishlistController.wishlistLoad);
router.get('/addToWishlist', userAuth.userAuth, wishlistController.addToWishlist);
router.get('/removeWishlist/:id', userAuth.userAuth, wishlistController.removeWishlist);
router.post("/addToCart/:id", userAuth.userAuth, wishlistController.addToCart);


//checkout
router.get('/checkout',userAuth.userAuth,checkoutController.getCheckout);
router.get('/addressFromCart', userAuth.userAuth, checkoutController.getAddressFormCart);
router.post('/addressFromCart', userAuth.userAuth, checkoutController.addAddressCart);
router.get('/editAddressInCart/:id', userAuth.userAuth, checkoutController.getEditAddressInCart);
router.post('/editAddressInCart/:id', userAuth.userAuth, checkoutController.editAddressInCart);
router.post('/checkout/codPayment', userAuth.userAuth, checkoutController.codPayment);
router.post('/checkout/walletPayment', userAuth.userAuth, checkoutController.walletPayment);
router.post('/razorpayPayment', userAuth.userAuth, checkoutController.razorPayPayment);
router.post('/verifyRazorpayPayment', userAuth.userAuth, checkoutController.verifyRazorpayPayment);
router.get('/orderSuccess',userAuth.userAuth, checkoutController.successOrder)
router.get('/paymentFailed',userAuth.userAuth,checkoutController.paymentFailed)
router.post('/retryPayment',userAuth.userAuth,checkoutController.retryPayment)

//order
router.get('/order',userAuth.userAuth,orderController.getOrders)
router.get('/viewOrder/:orderId/:trackingNumber', userAuth.userAuth, orderController.viewOrder);
router.get('/cancelOrder/:orderId',userAuth.userAuth,orderController.cancelOrder);
router.post('/cancelItem/:orderId/:trackingNumber',userAuth.userAuth,orderController.cancelItem);
router.post('/returnOrder/:orderId/:trackingNumber',userAuth.userAuth,orderController.returnOrder);

//coupon management
router.get('/showCoupons',userAuth.userAuth,couponController.loadCoupon)
router.post('/applyCoupon',userAuth.userAuth,couponController.applyCoupon)
router.post('/removeCoupon',userAuth.userAuth,couponController.removeCoupon)


router.get('/logout',userController.logout)



module.exports=router