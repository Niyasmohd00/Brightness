const mongoose=require('mongoose')
const {Schema}=mongoose;

const userSchema = new Schema({
    name:{
        type:String,
        required:true
    },
    email:{
        type:String,
        required:true,
        unique:true,
    },
    phone:{
        type:String,
        required:false,
        unique:false,
        sparse:true,
        default:null
    },
    googleId: {
        type: String,
        unique: true,
        sparse: true
    },
    password:{
        type:String,
        required:false,
    },
    isBlocked:{
        type:Boolean,
        default:false
    },isAdmin:{
        type:Boolean,
        default:false
    },
    referralCode: {
        type: String,
        unique: true,
        index: true,
    },
    referredBy: {
        type: String,
        index: true,
    },
    walletBalance: {
        type: Number,
        default: 0, 
    },
    walletTransactions:[{
        date: { type: Date, default: Date.now },
        type: { type: String, enum: ['credit', 'debit'] },
        amount: { type: Number },
        transactionId:{type:String, required:true},
        description: { type: String }
    }]
},{timestamps:true})

const User = mongoose.model("User",userSchema);

module.exports = User 