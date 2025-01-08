const Product = require('../../models/productSchema')
const Cart = require('../../models/cartSchema');
const User = require('../../models/userSchema');
const Address = require('../../models/addressSchema');
const Order = require('../../models/orderSchema');
const PDFDocument = require('pdfkit');

const getOrders = async (req, res) => {
  try {
    const userId = req.session.user.id;
    if (!userId) {
      return res.redirect('/login');
    }

    const currentPage = parseInt(req.query.page) || 1;
    const ordersPerPage = 10;
    const totalOrders = await Order.countDocuments({ userId });
    const totalPages = Math.ceil(totalOrders / ordersPerPage);

    const orders = await Order.find({ userId })
      .skip((currentPage - 1) * ordersPerPage) 
      .limit(ordersPerPage)  
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

    res.render('order', { 
      orders: ordersWithFlags, 
      totalPages, 
      currentPage 
    });
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


const invoicePDF = async (req, res) => {
  try {
    const { orderId, trackingNumber } = req.query;
    const user = await User.findById(req.session.user.id);
    if (!orderId || !trackingNumber) {
      return res.status(400).send('Order ID and Tracking Number are required.');
    }

    const order = await Order.findOne({
      _id: orderId,
    })
      .populate('userId', 'name email address')
      .populate('products.productId', 'productName price category')
      .populate('products.productId.category', 'categoryName')
      .populate('addressId');

    if (!order) {
      return res.status(404).send('Order not found.');
    }

    const product = order.products.find(p => p.trackingNumber === trackingNumber);

    if (!product) {
      return res.status(404).send('Product with the specified tracking number not found.');
    }

    // Create the PDF invoice for the specific product
    const doc = new PDFDocument({
      size: 'A4',
      margin: 40,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename=Invoice_${user.name}_${trackingNumber}.pdf`);
    doc.pipe(res);

    doc.fontSize(30).font('Helvetica-Bold').text('BRIGHTNESS', { align: 'center' });
    doc.fontSize(16).text('Different types of mirror to decorate your place', { align: 'center' });
    doc.moveDown(2);
    doc.fontSize(14).text('Invoice', { align: 'center' }); 
    doc.moveDown(2);

    doc.fontSize(12).text(`Customer Name: ${order.userId?.name}`);
    doc.text(`Email: ${order.userId?.email}`);
    doc.moveDown();

    doc.text(`Order Date: ${new Date(order.orderDate).toLocaleDateString()}`);
    doc.text(`Order ID: ${order.orderId}`);
    doc.text(`Tracking Number: ${trackingNumber}`);
    doc.moveDown();

    doc.text(`Product: ${product.productId?.productName}`);
    doc.text(`Category: ${product.productId?.category.categoryName}`);
    doc.text(`Price: Rs ${product.productId?.price.toFixed(2)}`);
    doc.text(`Quantity: ${product.quantity}`);
    doc.text(`Total: Rs ${(product.productId?.price * product.quantity).toFixed(2)}`);
    if (product.offerAmount) {
      doc.text(`Discount: Rs ${product.offerAmount.toFixed(2)}`);
    }
    doc.moveDown();

    doc.text(`Address: ${order.addressId?.housename}, ${order.addressId?.city}, ${order.addressId?.state}, Pin:${order.addressId?.pincode}`);
    doc.moveDown();

    doc.text(`Payment Status: ${order.paymentStatus}`);
    doc.text(`Payment Method: ${order.paymentMethod}`);
    doc.moveDown();

    doc.text('Warranty: 1 year warranty for Adaptor, Sensor and LED Strip', { italics: true });
    doc.moveDown(2);

    doc.fontSize(14).font('Helvetica-Bold').text(`Order Total: Rs ${order.totalAmount.toFixed(2)}`, { align: 'right' });
    doc.moveDown(16);
    doc.fontSize(14).text('Brightness', { align: 'center' });
    doc.end();
  } catch (error) {
    console.error('Error generating invoice:', error);
    res.status(500).send('Error generating invoice.');
  }
};


  module.exports = {
    getOrders,
    viewOrder,
    cancelOrder,
    cancelItem,
    returnOrder,
    invoicePDF
  };
  