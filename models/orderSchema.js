const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  addressId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Address',
    required: true
  },
  orderId:{
    type: Number,
    unique: true
  },
  products: [{
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Product',
      required: true
    },
    quantity: {
      type: Number,
      required: true
    },
    offerAmount:{
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: [ 'Pending', 'Processing', 'Shipped', 'Delivered', 'Cancelled', 'Returned'],
      default: 'Processing'
    },
    trackingNumber: {
      type: String,
      default: ''
    },
    return: {
      returnReason: {
        type: String,
        default: null
      },
      returnQuantity: {
        type: Number,
        default: 0 
      },
      returnDate: {
        type: Date,
        default: null
      },
      returnStatus: {
        type: String,
        enum: ['Requested', 'Approved', 'Rejected','Completed',''],
        default: ''
      }
    }
  }],
  paymentMethod: {
    type: String,
    enum: ['Not Initiated', 'Cash on Delivery', 'Credit Card', 'Wallet','Razor Pay'],
    default: 'Cash on Delivery'
  },
  paymentStatus: {
    type: String,
    enum: ['Pending', 'Paid', 'Processing', 'Cancelled', 'Failed','Refunded'],
    default: 'Processing'
  },
  orderDate: {
    type: Date,
    default: Date.now
  },
  totalAmount: {
    type: Number,
    required: true
  },
  totalQuantity: {
    type: Number,
    required: true
  },
  deliveryCharge: {
    type: Number,
    default: 0
     },
  totalDiscount:{
    type: Number,
    default: 0
    },
  couponDiscount:{
    type: Number,
    default: 0
  },
  couponId:{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Coupon',
  },
  razorpay: {
    orderId: { type: String }, 
    paymentId: { type: String },
    signature: { type: String } 
  },
  
},{timestamps:true});

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;

