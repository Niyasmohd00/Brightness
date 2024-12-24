const mongoose = require("mongoose");
const {Schema} = mongoose;

const categorySchema = new mongoose.Schema({
    name: {
        type:String,
        required:true,
        unique:true
    },
    description : {
        type : String,
        required : true,
    },
    isActive: {
        type:Boolean,
        default:true
    },
    categoryOffer:{
        type:Number,
        default:0
    },
    isDeleted: {
        type: Boolean,
        default: false 
    }
},
{ timestamps: true }
)

const Category = mongoose.model("Category",categorySchema);

module.exports = Category;