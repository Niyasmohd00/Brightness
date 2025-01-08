const Product = require("../../models/productSchema"); 
const Category = require("../../models/categorySchema"); 
const Wishlist = require('../../models/wishlistSchema');



const listProducts = async (req, res) => {
    try {
        const { query, sort, category, page = 1, minPrice = 0, maxPrice = Infinity } = req.query;
        let productQuery = { isBlocked: false, isDeleted: false };
        
        if (query) {
            productQuery.productName = { $regex: query, $options: 'i' };
        }
        
        if (category) {
            productQuery.category = category;
        }

        productQuery.price = { $gte: minPrice, $lte: maxPrice };
        
        const sortOption = getSortOption(sort);
        const products = await Product.find(productQuery)
            .populate({
                path: 'category',
                match: { isActive: true, isDeleted: false },
                select: '_id name'
            })
            .sort(sortOption)
            .skip((page - 1) * 20)
            .limit(20);
  
        const filteredProducts = products.filter(product => product.category);
        const categories = await Category.find({ isActive: true, isDeleted: false });
        const totalProducts = await Product.countDocuments(productQuery);
        const totalPages = Math.ceil(totalProducts / 20);
        
        res.render('showProducts', {
            products: filteredProducts,
            categories,
            sortOption,
            selectedCategory: category,
            query: query || '',
            minPrice,
            maxPrice,
            currentPage: parseInt(page, 10),
            totalPages,
            noResults: filteredProducts.length === 0 
        });
    } catch (error) {
        console.error('Error fetching products:', error.message);
        res.status(500).render('error', { message: 'An error occurred while fetching products.' });
    }
};



function getSortOption(sort) {
    switch (sort) {
        case 'price_low_to_high':
            return { price: 1 };
        case 'price_high_to_low':
            return { price: -1 };
        case 'average_rating':
            return { averageRating: -1 };
        case 'new_arrivals':
            return { createdAt: -1 };
        case 'a_to_z':
            return { productName: 1 };
        case 'z_to_a':
            return { productName: -1 };
        case 'featured':
            return { views: -1 };
        default:
            return {};
    }
}


  const loadSingleProduct = async (req, res) => {
    try {
        const productId = req.query.id; 
        const userId = req.session.user ? req.session.user.id : null; 

        const product = await Product.findById(productId).populate('category');

        if (!product) {
            return res.status(404).render('404', { message: 'Product not found' }); 
        }

        product.views = (product.views || 0) + 1; 
        await product.save();

        let isInWishlist = false;
        if (userId) {
            const wishlist = await Wishlist.findOne({ userId });
            if (wishlist) {
                isInWishlist = wishlist.items.some(item => item.productId.toString() === productId);
            }
        }

        const products = await Product.find({ isDeleted: false, _id: { $ne: productId } });

        const relatedProducts = await Product.find({
            category: product.category,
            _id: { $ne: product._id },
            isDeleted: false
        }).limit(4);

        res.render('eachProduct', { 
            products, 
            product, 
            relatedProducts,
            isInWishlist 
        });
    } catch (error) {
        console.error("Error fetching product:", error);
        res.redirect("/pageerror"); 
    }
};


 

module.exports = {
    listProducts,
    loadSingleProduct,
}