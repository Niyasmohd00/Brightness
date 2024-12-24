const Product = require("../../models/productSchema");
const Category = require("../../models/categorySchema");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp")


const productInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1; 
        const limit = 20; 

        const products = await Product.find({
            isDeleted:false,
            productName: { $regex: search, $options: "i" } 
        })
        .populate('category')
        .sort({ createdAt: -1 })
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        const totalProducts = await Product.countDocuments({
            isDeleted:false,
            productName: { $regex: search, $options: "i" }
        });
        const totalPages = Math.ceil(totalProducts / limit);

        res.render("products", {
            products,
            totalPages,
            currentPage: page,
            totalProducts
        });
    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
};


const addProductPage = async (req, res) => {
    try {
        const categories = await Category.find({});
        res.render("addProduct", { categories });
    } catch (error) {
        console.error("Error fetching categories:", error);
        res.redirect("/pageerror");
    }
};

const addProduct = async (req, res) => {
    try {
        const { 
            productName, 
            description, 
            category, 
            availableColors, 
            status, 
            features, 
            size, 
            price, 
            mrp, 
            stock 
        } = req.body;

        const productExists = await Product.findOne({
            productName: productName, 
        });
        if (!productExists) {
            const images = [];
            if (req.files && req.files.length > 0) {
                for (let i = 0; i < req.files.length; i++) {
                    const originalImagePath = req.files[i].path;
                    const resizedImagePath = path.join('public', 'uploads', 'product-images', req.files[i].filename);
                    await sharp(originalImagePath).resize({ width: 600, height: 600 }).toFile(resizedImagePath);
                    images.push(req.files[i].filename);
                }
            }

            const newProduct = new Product({
                productName,
                description,
                category,
                availableColors,
                productImages: images, 
                status,
                features,
                size,
                price,
                mrp,
                stock
            });
            await newProduct.save();
            return res.redirect("/admin/products");
        } else {
            const categories = await Category.find({});
            return res.render('addProduct',{message:"Product Already Exists, Please Try With Another Name",categories})
        }
    } catch (error) {
        console.error("Error adding product:", error);
        res.redirect("/pageerror");
    }
};



const blockProduct = async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { isBlocked: true });
        res.redirect('/admin/products'); 
    } catch (error) {
        console.error("Error blocking product:", error);
        res.redirect("/pageerror");
    }
};


const unblockProduct = async (req, res) => {
    try {
        await Product.findByIdAndUpdate(req.params.id, { isBlocked: false });
        res.redirect('/admin/products'); 
    } catch (error) {
        console.error("Error unblocking product:", error);
        res.redirect("/pageerror");
    }
};



const deleteProduct = async (req, res) => {
    const { id } = req.params;

    try {
        await Product.updateOne({ _id: id }, { isDeleted: true });
        console.log("Deleted Product");
        return res.status(200).json({ success: true, message: 'Product deleted successfully!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};



const gotoEditProduct = async (req, res) => {
    const { id } = req.params;
    try {
        const product = await Product.findById(id);
        if (!product) {
            return res.status(404).json({ error: "Product not found" });
        }
        const categories = await Category.find({});

        res.render('editProduct', { product, categories });        
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


const editProduct = async (req, res) => {
    const { id } = req.params;
    const { 
        productName, 
        description, 
        category, 
        availableColors, 
        status, 
        features, 
        size, 
        price, 
        mrp, 
        stock, 
        deletedImages = [] 
    } = req.body;

    try {
        const existingProduct = await Product.findOne({ productName, _id: { $ne: id } });
        const product = await Product.findById(id);
        if (existingProduct) {
            const categories = await Category.find(); 
            return res.render('editProduct', { 
                message: "Product Name Already Exists", 
                product,
                categories,
                id
            });
        }
        let images = [...product.productImages];
        for (let imageName of deletedImages) {
            const imagePath = path.join('public', 'uploads', 'product-images', imageName);
            if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
            const index = images.indexOf(imageName);
            if (index > -1) images.splice(index, 1);
        }
        if (req.files && req.files.length > 0) {
            for (let file of req.files) {
                const originalImagePath = file.path;
                const resizedImagePath = path.join('public', 'uploads', 'product-images', file.filename);
                await sharp(originalImagePath).resize({ width: 600, height: 600 }).toFile(resizedImagePath);
                images.push(file.filename);
            }
        }

        await Product.findByIdAndUpdate(id, {
            productName,
            description,
            category,
            availableColors,
            productImages: images, 
            status,
            features,
            size,
            price,
            mrp,
            stock
        });

        res.redirect("/admin/products");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


module.exports = {
    productInfo,
    addProduct,
    addProductPage,
    blockProduct,
    unblockProduct,
    deleteProduct,
    gotoEditProduct,
    editProduct
};
