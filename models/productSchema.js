const mongoose = require('mongoose');
const { Schema } = mongoose;

const productSchema = new Schema({
    productName: {
        type: String,
        required: true
    },
    description: {
        type: String,
        required: true
    },
    category: {
        type: Schema.Types.ObjectId,
        ref: "Category", 
        required: true
    },
    availableColors: {
        type: [String],
        required: true
    },
    productImages: {
        type: [String],
        required: true
    },
    isBlocked: {
        type: Boolean,
        default: false
    },
    status: {
        type: String,
        enum: ["Available", "Out of stock", "Discontinued"],
        default: "Available"
    },
            size: { type: String, required: true },
            price: { type: Number, required: true },
            mrp: { type: Number, required: true },
            stock: { type: Number, default: 0 },
    features: {
        type: String,
        default: null
    },
    reviews: [
        {
            userId: { type: Schema.Types.ObjectId, ref: "User" },
            comment: String,
            rating: { type: Number, min: 1, max: 5 },
            createdAt: { type: Date, default: Date.now }
        }
    ],
    averageRating: {
        type: Number,
        default: 0,
        min: 0,
        max: 5
    },
    isDeleted: {
        type: Boolean,
        default: false 
    },
    views:{
        type: Number,
        default: 0
    }
}, { timestamps: true });

// Method to calculate and update the average rating
productSchema.methods.updateAverageRating = function() {
    if (this.reviews.length === 0) {
        this.averageRating = 0;
    } else {
        const totalRating = this.reviews.reduce((sum, review) => sum + review.rating, 0);
        this.averageRating = totalRating / this.reviews.length;
    }
    return this.save();
};

const Product = mongoose.model("Product", productSchema);

module.exports = Product;
