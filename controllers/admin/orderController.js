const Product = require('../../models/productSchema');
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');

const listOrder = async (req, res) => {
    try {
        let page = parseInt(req.query.page) || 1; 
        const limit = 20;
        const orders = await Order.find()
            .populate('userId', 'name email') 
            .populate('products.productId', 'name price') 
            .sort({ updatedAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit) 
            .exec();

        const totalOrders = await Order.countDocuments();
        const totalPages = Math.ceil(totalOrders / limit);

        res.render('orders', {
            orders,
            totalPages,
            currentPage: page,
            totalOrders
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

const updateOrderStatus = async (req, res) => {
    const { orderId } = req.params;
    const { status, trackingNumber } = req.body;

    try {
        const order = await Order.findById(orderId);

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        const validStatuses = ['Processing', 'Shipped', 'Delivered'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, message: 'Invalid status' });
        }
        const product = order.products.find(product => product.trackingNumber === trackingNumber);
        if (!product) {
            return res.status(404).json({ success: false, message: 'Product with the given tracking number not found' });
        }

        product.status = status;
        if (status === 'Delivered') {
            order.paymentStatus = 'Paid'
        }
        await order.save();
        return res.status(200).json({ success: true, message: 'Order status updated successfully' });

    } catch (error) {
        console.error('Error updating order status:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};


const orderView = async (req, res) => {
    try {
        const { orderId, trackingNumber } = req.params;
        const order = await Order.findById(orderId)
            .populate('products.productId')
            .populate('addressId')
            .populate('userId')
            .populate('couponId')
        if (!order) {
            return res.status(404).send("Order not found");
        }
        const product = order.products.find(product => product.trackingNumber === trackingNumber);

        res.render("orderView", { order, product });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

const cancelOrder = async (req, res) => {
    try {
        const { orderId, trackingNumber } = req.params;
        const user = await User.findById(req.session.user.id);
        const order = await Order.findById(orderId)
            .populate('products.productId')
            .populate('addressId');

        if (!order) {
          return res.status(404).send("Order not found");
        }

        const product = order.products.find(product => product.trackingNumber === trackingNumber);
        if(order.paymentStatus==='Paid'){
          const productTotalPrice = product.productId.price * product.quantity;
          refundTotal = productTotalPrice - product.offerAmount;
          user.walletBalance += refundTotal
          user.walletTransactions.push({
            type: 'credit',
            amount: refundTotal,
            description: 'Cancel Order',
            date: new Date(),
            transactionId: `TRNSID${Math.random().toString(36).substring(2, 8).toUpperCase()}`
        });
        }
        product.status = 'Cancelled';
        const updateProduct = product.productId
        updateProduct.stock += product.quantity 
        await updateProduct.save()
        await user.save();
        await order.save();
        
        return res.redirect(req.get('referer'));
    } catch (error) {
        console.error('Error canceling order:', error);
        return res.redirect(req.get('referer'));
    }
};


const approveReturn = async (req, res) => {
    const { orderId, trackingNumber } = req.params;
    try {
        const order = await Order.findById(orderId);
        const product = order.products.find(product => product.trackingNumber === trackingNumber);
        product.return.returnStatus = 'Approved';
        product.return.returnDate = new Date().toISOString().split('T')[0]
        await order.save();

        return res.redirect(req.get('referer'));
    } catch (error) {
        console.error('Error Approving return:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};



const rejectReturn = async (req, res) => {
    const { orderId, trackingNumber } = req.params;
    try {
        const order = await Order.findById(orderId);
        const product = order.products.find(product => product.trackingNumber === trackingNumber);
        product.return.returnStatus = 'Rejected';
        await order.save();

        return res.redirect(req.get('referer'));
    } catch (error) {
        console.error('Error Approving return:', error);
        return res.status(500).json({ success: false, message: 'Internal server error' });
    }
};

const pickupSuccess = async (req, res) => {
    const { orderId, trackingNumber } = req.params;
    try {
        const order = await Order.findById(orderId).populate('userId');
        const product = order.products.find(product => product.trackingNumber === trackingNumber);
        product.return.returnStatus = 'Completed';
        product.status = 'Returned';
        order.paymentStatus = 'Refunded'

        const updateProduct = await Product.findById(product.productId).populate('category');
        updateProduct.stock += product.quantity;
        await updateProduct.save();

        const baseTotal = product.quantity * updateProduct.price;
        const categoryOffer = updateProduct.category.categoryOffer;
        const discount = (baseTotal * categoryOffer) / 100;
        const refundTotal = baseTotal - discount;
        const user = order.userId;
        user.walletBalance = (user.walletBalance) + refundTotal;
        const transactionId = `TRNSID${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        const transaction = {
            transactionId,
            amount: refundTotal,
            type: 'credit',
            description: 'Return refund',
            date: new Date(),
        };
        user.walletTransactions = user.walletTransactions || [];
        user.walletTransactions.push(transaction);
        await user.save();
        await order.save();

        return res.redirect(req.get('referer'));
    } catch (err) {
        console.error(err);
        res.status(500).send('Server Error');
    }
};



module.exports = {
    listOrder,
    updateOrderStatus,
    orderView,
    cancelOrder,
    approveReturn,
    rejectReturn,
    pickupSuccess
};
