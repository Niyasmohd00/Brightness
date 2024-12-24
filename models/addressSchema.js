const mongoose=require('mongoose')

const addressSchema=mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    fname:{
        type:String
    },
    lname:{
        type:String
    },
    housename:{
        type:String,               
    },
    landmark:{
        type:String
    },
    city:{
        type:String
    },
    state:{
        type:String
    },
    country:{
        type:String
    },
    pincode:{
        type:Number
    },
    phone:{
        type:Number
    },
    email:{
        type:String
    },
    description:{
        type:String
    }

},{timestamps:true})




module.exports=mongoose.model('Address',addressSchema) 