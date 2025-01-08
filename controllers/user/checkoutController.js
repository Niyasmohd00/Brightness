const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema')
const Coupon = require('../../models/couponSchema');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const env = require("dotenv").config();

const razorPay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

const getCheckout = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: {
                path: 'category',
                model: 'Category',
            },
        });

        if (!cart || cart.items.length === 0) {
            req.flash('error_msg', 'Cart Items Not Available.');
            return res.redirect('/cart');
        }

        const user = await User.findById(userId);
        let isValidCart = true;
        let errorMessage = ""; 

        for (const item of cart.items) {
            const product = item.productId;

            if (!product) {
                isValidCart = false;
                errorMessage = "Some products in your cart are no longer available.";
                break; 
            }

            if (product.stock < item.quantity) {
                isValidCart = false;
                errorMessage = `Insufficient stock for ${product.productName}. `;
                break;
            }

            if (item.quantity > 5) {
                isValidCart = false;
                errorMessage = `Cannot have more than 5 units of ${product.productName}.`;
                break; 
            }
        }

        if (!isValidCart) {
            req.flash('error_msg', errorMessage); 
            return res.redirect('/cart');
        }

        req.flash('success_msg', 'Cart is ready for checkout.');

        const addresses = await Address.find({ userId });

        res.render('checkout', {
            cart,
            user,
            addresses,
            message: null,
        });
    } catch (error) {
        console.error("Error rendering checkout page:", error);
        req.flash('error_msg', 'Internal Server Error.');
        return res.redirect('/cart'); 
    }
};

const getAddressFormCart = async (req, res) => {
    try {
        res.render('addressFromCart');
    } catch (error) {
        console.log(error.message);
        res.status(500).send('Server Error');
    }
};



const addAddressCart = async (req, res) => {
    try {
        const userId = req.session.user.id; 
        const { fname, lname, housename, landmark, city, state, country, pincode, phone } = req.body;
        if (!userId) {
            return res.status(401).json({ message: 'User not authenticated' });
        }
        const newAddress = new Address({
            userId,
            fname,
            lname,
            housename,
            landmark,
            city,
            state,
            country,
            pincode,
            phone,
        });
        await newAddress.save();

        res.redirect('/checkout'); 
    } catch (error) {
        console.error('Error saving address:', error);
        res.status(500).send('Server Error');
    }
};




const codPayment = async (req, res) => {
    try {
        const { selectedAddress, totalAmount, couponCode } = req.body;
        const userId = req.session.user.id;
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: { path: 'category' },
        });

        if (!cart || !cart.items || cart.items.length === 0) {
            throw new Error('Your cart is empty. Add items to proceed.');
        }
        
        if (totalAmount > 3000) {
            req.flash('error_msg', 'Cash on Delivery is not allowed for orders ₹3000 and above.');
            return res.redirect('/checkout'); 
        }

        const totalQuantity = cart.items.reduce((total, item) => total + item.quantity, 0);
        const coupon = await Coupon.findOne({ couponCode });

        const products = cart.items.map((item) => ({
            productId: item.productId._id,
            quantity: item.quantity,
            status: 'Processing',
            trackingNumber: `TRK${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`,
            offerAmount: item.productId.price * item.quantity * (item.productId.category.categoryOffer / 100),
        }));
        const totalDiscount = cart.couponDiscount + products.reduce((acc, item) => acc + item.offerAmount, 0);
        const orderId = await generateUniqueOrderId();
        const order = new Order({
            userId,
            addressId: selectedAddress,
            products,
            orderId:orderId,
            paymentMethod: 'Cash on Delivery',
            totalQuantity,
            totalAmount,
            totalDiscount: totalDiscount.toFixed(2),
            couponDiscount: cart.couponDiscount,
            deliveryCharge: 0,
            orderDate: new Date().toISOString().split('T')[0],
            couponId: coupon,
        });
        await order.save();
        await Cart.deleteOne({ userId });

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product) {
                throw new Error(`Product with ID ${item.productId._id} not found.`);
            }
            if (product.stock < item.quantity) {
                throw new Error(`Not enough stock for product: ${product.name}.`);
            }
            product.stock -= item.quantity;
            await product.save();
        }

        res.render('orderSuccess', { order });
    } catch (error) {
        console.error('Error processing COD payment:', error);
        res.status(500).send('An error occurred while processing your order. Please try again later.');
    }
};



const walletPayment = async (req, res) => {
    try {
        const { selectedAddress, totalAmount, couponCode } = req.body;
        const userId = req.session.user.id;

        const user = await User.findById(userId);
        if (!user || user.walletBalance < totalAmount) {
            req.flash('error_msg', 'Insufficient wallet balance.');
            return res.redirect('/checkout');
        }
        const cart = await Cart.findOne({ userId }).populate({
            path: 'items.productId',
            populate: { path: 'category' },
        });
        
        const coupon = await Coupon.findOne({ couponCode });
        const products = cart.items.map((item) => ({
            productId: item.productId._id,
            quantity: item.quantity,
            status: 'Processing',
            trackingNumber: `TRK${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`,
            offerAmount: item.productId.price * item.quantity * (item.productId.category.categoryOffer / 100),
        }));
        const totalDiscount = cart.couponDiscount + products.reduce((acc, item) => acc + item.offerAmount, 0);
        const orderId = await generateUniqueOrderId();
        const order = new Order({
            userId,
            addressId: selectedAddress,
            products,
            orderId:orderId,
            paymentMethod: 'Wallet',
            paymentStatus:'Paid',
            totalQuantity: cart.items.reduce((acc, item) => acc + item.quantity, 0),
            totalAmount,
            totalDiscount: totalDiscount.toFixed(2),
            couponDiscount: cart.couponDiscount,
            deliveryCharge: 0,
            orderDate: new Date().toISOString().split('T')[0],
            couponId: coupon,
        });
        await order.save();
        await Cart.deleteOne({ userId });

        // Update wallet balance
        user.walletBalance -= totalAmount;
        user.walletTransactions.push({
            type: 'debit',
            amount: totalAmount,
            description: 'Order Payment',
            date: new Date(),
            transactionId: `TRNSID${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        await user.save();

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product) throw new Error(`Product with ID ${item.productId._id} not found.`);
            if (product.stock < item.quantity) {
                throw new Error(`Not enough stock for product: ${product.name}.`);
            }
            product.stock -= item.quantity;
            await product.save();
        }

        res.render('orderSuccess', { order });
    } catch (error) {
        console.error('Error processing Wallet payment:', error);
        res.status(500).send('Error processing Wallet payment.');
    }
};



const razorPayPayment = async (req, res) => {
    try {
        const { totalAmount, selectedAddress, couponCode } = req.body;
        const amountInPaise = Math.round(totalAmount * 100);
        req.session.paymentData = {
            selectedAddress, 
            totalAmount, 
            couponCode
        };

        const cart = await Cart.findOne({ userId: req.session.user.id }).populate({
            path: 'items.productId',
            populate: { path: 'category' },
        });

        const coupon = await Coupon.findOne({ couponCode });

        const products = cart.items.map(item => ({
            productId: item.productId._id,
            quantity: item.quantity,
            offerAmount: item.productId.price * item.quantity * (item.productId.category.categoryOffer / 100),
            status: 'Pending',  
            trackingNumber: `TRK${Date.now() % 1000000}${Math.floor(Math.random() * 100)}`,
        }));

        const totalDiscount = cart.couponDiscount + products.reduce((acc, item) => acc + item.offerAmount, 0);
        const orderId = await generateUniqueOrderId();

        const order = new Order({
            userId: req.session.user.id,
            addressId: selectedAddress,
            products,
            orderId: orderId,
            paymentMethod: 'Razor Pay',
            paymentStatus: 'Pending',  
            totalQuantity: cart.items.reduce((acc, item) => acc + item.quantity, 0),
            totalAmount,
            totalDiscount: totalDiscount.toFixed(2),
            couponDiscount: cart.couponDiscount,
            deliveryCharge: 0,
            orderDate: new Date(),
            couponId: coupon,
        });

        await order.save();

        for (const item of cart.items) {
            const product = await Product.findById(item.productId._id);
            if (!product) throw new Error(`Product with ID ${item.productId._id} not found.`);
            if (product.stock < item.quantity) {
                throw new Error(`Not enough stock for product: ${product.name}.`);
            }
            product.stock -= item.quantity;
            await product.save();
        }

        await Cart.deleteOne({ userId: req.session.user.id });

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: { orderId: order._id }, 
        };

        const razorpayOrder = await razorPay.orders.create(options);
        if (!razorpayOrder){
            return res.status(500).json({ success: false, message: 'Razorpay order creation failed' });
        }

        order.razorpay = {
            orderId: razorpayOrder.id, 
            paymentId: null,  
            signature: null,  
        };

        await order.save();  

        res.status(200).json({
            success: true,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Error creating Razorpay order:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};

const verifyRazorpayPayment = async (req, res) => {
    let order;
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

        const expectedSignature = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest('hex');
        
        if (expectedSignature !== razorpay_signature) {
            order = await Order.findOne({ 'razorpay.orderId': razorpay_order_id });
            if (order) {
                order.paymentStatus = 'Failed';
                await order.save();
            }
            return res.status(400).json({ success: false, message: "Payment verification failed." });
        }

        order = await Order.findOne({ 'razorpay.orderId': razorpay_order_id });
        if (!order) {
            return res.status(400).json({ success: false, message: "Order not found." });
        }

        order.paymentStatus = 'Paid';
        order.razorpay.paymentId = razorpay_payment_id;
        order.razorpay.signature = razorpay_signature;
        order.products.forEach(async (product) => {
            product.status = 'Processing';
        });
        await order.save();

        res.json({
            success: true,
            orderId: order._id,
            message: "Payment successfully verified."
        });
    } catch (error) {
        console.error('Error verifying RazorPay payment:', error);
        return res.status(500).json({ success: false, message: "An error occurred while verifying the payment." });
    }
};

const successOrder = async (req,res)=>{
    try {
        const { orderId } = req.query;
        const order = await Order.findById(orderId);
        res.render('orderSuccess', { order });
    } catch (error) {
        console.error('Error while fetching order details:', error);
        res.status(500).json({ success: false, message: 'An error occurred while retrieving the order.' });
        
    }
}


const paymentFailed = async(req,res)=>{
    const message = req.query.message || 'An error occurred with your payment.';
    res.render('paymentFailed', { message });
}

const retryPayment = async (req, res) => {
    try {
        const { orderId } = req.body;
        const order = await Order.findOne({ orderId: orderId, paymentStatus: 'Pending' });
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found or already paid' });
        }
        const amountInPaise = Math.round(order.totalAmount * 100); 
        if (!req.session.user || req.session.user.id !== order.userId.toString()) {
            return res.status(403).json({ success: false, message: 'User not authorized' });
        }

        const options = {
            amount: amountInPaise,
            currency: 'INR',
            receipt: `receipt_${Date.now()}`,
            notes: { orderId: order._id },
        };
        
        const razorpayOrder = await razorPay.orders.create(options);
        if (!razorpayOrder) {
            return res.status(500).json({ success: false, message: 'Razorpay order creation failed' });
        }
        order.razorpay = {
            orderId: razorpayOrder.id,
            paymentId: null,  
            signature: null,
        };
        order.paymentStatus = 'Pending';  
        await order.save();
        res.status(200).json({
            success: true,
            order_id: razorpayOrder.id,
            amount: razorpayOrder.amount,
            currency: razorpayOrder.currency,
            key: process.env.RAZORPAY_KEY_ID,
        });
    } catch (error) {
        console.error('Error retrying Razorpay payment:', error.message);
        res.status(500).json({ success: false, message: 'Server error' });
    }
};


const getEditAddressInCart = async (req, res) => {
    try {
        const addressId = req.params.id;
        const address = await Address.findById(addressId);
        if (!address) {
            return res.status(404).send('Address not found');
        }
        res.render('editAddressCart', { address });
    } catch (error) {
        console.error('Error fetching address:', error.message);
        res.status(500).send('Server Error');
    }
};

const editAddressInCart = async (req, res) => {
    try {
        const addressId = req.params.id;
        const { fname, lname, landmark, country, housename, city, state, pincode, phone } = req.body;

        const updatedAddress = await Address.findByIdAndUpdate(
            addressId,
            { fname, lname, country,landmark, housename, city, state, pincode, phone },
            { new: true }
        );
        if (!updatedAddress) {
            return res.status(404).send('Address not found');
        }

        res.redirect('/checkout');  
    } catch (error) {
        console.error('Error updating address:', error.message);
        res.status(500).render('edit-address', { message: 'An error occurred while updating your address. Please try again.', address: req.body });
    }
};

const generateUniqueOrderId = async function () {
    const min = 1000000000; 
    const max = 9999999999;
    let orderId;
  
    do {
      orderId = Math.floor(Math.random() * (max - min + 1)) + min; 
    } while (await Order.exists({ orderId })); 
  
    return orderId;
  };

module.exports = {
    getCheckout,
    getAddressFormCart,
    addAddressCart,
    codPayment,
    walletPayment,
    razorPayPayment,
    verifyRazorpayPayment,
    editAddressInCart,
    getEditAddressInCart,
    razorPayPayment,
    successOrder,
    paymentFailed,
    retryPayment
}