const mongoose = require("mongoose");

const {Schema} = mongoose;

const couponSchema = new mongoose.Schema({
    couponCode:{
        type:String,
        required:true,
    },
    expiryDate :{
        type:Date,
        required:true
    },
    discountValue: { 
        type: Number, 
        required: true },
    discountType:{
        type: String, 
        enum: ['fixed', 'percentage'], 
        required: true
    },
    minimumPrice:{
        type:Number,
        required:true
    },
    isActive:{
        type:Boolean,
        default:true
    },
    userId:[{
        type:mongoose.Schema.Types.ObjectId,
        ref:'User'
    }]


},{timestamps:true})

const Coupon = mongoose.model("Coupon",couponSchema);

module.exports = Coupon;