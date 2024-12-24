const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema')

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user.id; 
    if (!userId) {
      return res.redirect('/login'); 
    }

    const orders = await Order.find({ userId })
      .populate({
        path: 'products.productId',
        model: 'Product',
      })
      .populate('addressId')
      .sort({ createdAt: -1 })
      .exec();

    const ordersWithFlags = orders.map((order) => {
      const isCancelable = order.products.every(
        (product) => product.status === 'Processing' || product.status === 'Shipped' || product.status === 'Pending'
      );
      return { ...order.toObject(), isCancelable };
    });

    res.render('order', { orders: ordersWithFlags });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).send('Internal server error');
  }
};

  
  const viewOrder = async (req, res) => {
    try {
        const { orderId, trackingNumber } = req.params;
        const order = await Order.findById(orderId)
            .populate('products.productId')
            .populate('addressId');

        if (!order) {
            return res.status(404).send("Order not found");
        }
        const product = order.products.find(product => product.trackingNumber === trackingNumber);

        if (!product) {
            return res.status(404).send("Product not found in this order");
        }

        res.render("viewOrder", { order, product });
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

const cancelOrder = async (req, res) => {
  try {
      const { orderId } = req.params;
      const user = await User.findById(req.session.user.id);
      const order = await Order.findById(orderId)
          .populate('products.productId')
          .populate('addressId');

      if (!order) {
          req.flash('error_msg', 'Order not found');
          return res.redirect('/order');
      }

      if (order.paymentStatus === 'Paid') {
          const totalRefund = order.totalAmount
          user.walletBalance += totalRefund;
          user.walletTransactions.push({
              type: 'credit',
              amount: totalRefund,
              description: 'Refund for Cancelled Order',
              date: new Date(),
              transactionId: `TRNSID${Math.random().toString(36).substring(2, 8).toUpperCase()}`
          });
          await user.save();
        order.paymentStatus = 'Cancelled'
      }else{
        order.paymentStatus = 'Cancelled'
      }
      for (const product of order.products) {
        product.status = 'Cancelled';
        
        const updateProduct = await Product.findById(product.productId._id);
        if (updateProduct) {
            updateProduct.stock += product.quantity; 
            await updateProduct.save();
        }
      }
      await order.save();

      req.flash('success_msg', 'Your order has been successfully cancelled.');
      res.redirect('/order');

  } catch (error) {
      console.error(error);
      req.flash('error_msg', 'An error occurred while cancelling your order.');
      res.redirect('/order');
  }
};



const cancelItem = async (req, res) => {
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
        res.redirect("/order");
    } catch (error) {
        console.error(error);
        res.status(500).send("Server error");
    }
};

const returnOrder = async (req, res) => {
  const { orderId, trackingNumber } = req.params;
  const { returnQuantity,returnReason } = req.body;

  try {
      const order = await Order.findById(orderId);
      if (!order) {
          return res.status(404).json({ success: false, message: 'Order not found' });
      }
      const product = order.products.find(prod => prod.trackingNumber === trackingNumber);
      if (!product) {
          return res.status(404).json({ success: false, message: 'Product with the given tracking number not found' });
      }
      if (product.return.returnStatus !== '') {
          return res.status(400).json({ success: false, message: 'Return request has already been made for this product' });
      }

      product.return.returnStatus = 'Requested';
      product.return.returnQuantity = returnQuantity;
      product.return.returnReason = returnReason;
      await order.save();

      return res.redirect(req.get('referer'));
  } catch (error) {
      console.error('Error requesting return:', error);
      return res.status(500).json({ success: false, message: 'Internal server error' });
  }
};


  module.exports = {
    getOrders,
    viewOrder,
    cancelOrder,
    cancelItem,
    returnOrder
  };
  