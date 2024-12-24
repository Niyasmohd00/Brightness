const Category = require("../../models/categorySchema");


const categoryInfo = async (req, res) => {
    try {
        let search = req.query.search || "";
        let page = parseInt(req.query.page) || 1; 
        const limit = 20;
        
        const categoryData = await Category.find({
            isDeleted: false,
            name: { $regex: search, $options: "i" } 
        })
        .sort({ createdAt: -1 }) 
        .limit(limit)
        .skip((page - 1) * limit)
        .exec();

        const totalCategories = await Category.countDocuments({
            isDeleted: false,
            name: { $regex: search, $options: "i" }
        });
        const totalPages = Math.ceil(totalCategories / limit);
        
        res.render("category", {
            cat: categoryData,
            totalPages: totalPages,
            currentPage: page,
            totalCategories: totalCategories
        });

    } catch (error) {
        console.error(error);
        res.redirect("/pageerror");
    }
};


const addCategory = async (req, res) => {
    const { name, description, categoryOffer, isActive } = req.body;
    try {
        const existingCategory = await Category.findOne({ name: { $regex: `^${name}$`, $options: "i" }});
        if (existingCategory) {
            return res.render("addCategory", { message: "Category Already Exists" });
        }
        const existingDescription = await Category.findOne({ description: { $regex: `^${description}$`, $options: "i" } });
        if (existingDescription) {
            return res.render("addCategory", { message: "Description Already Exists" });
        }

        const newCategory = new Category({
            name,
            description,
            categoryOffer: categoryOffer || 0,
            isActive: isActive === "active",
        });
        await newCategory.save();
        res.redirect("/admin/category");
    } catch (error) {
        console.error(error);
        res.render("addCategory", { message: "Internal Server Error" });
    }
};


const deleteCategory = async (req, res) => {
    const { id } = req.params;
    try {
        await Category.updateOne({ _id: id }, { isDeleted: true });
        console.log("Soft Deleted Category");
        return res.status(200).json({ success: true, message: 'Category soft-deleted successfully!' });
    } catch (error) {
        console.error(error);
        return res.status(500).json({ success: false, error: "Internal Server Error" });
    }
};


const gotoEditCategory = async (req, res) => {
    const { id } = req.params;
    try {
        const category = await Category.findById(id);
        if (!category) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.render('editCategory', { category });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};


const editCategory = async (req, res) => {
    const { id } = req.params;
    const { name, description, categoryOffer, isActive, isVisible } = req.body;
    try {
        const existingCategory = await Category.findOne({ name: { $regex: `^${name}$`, $options: "i" },_id: { $ne: id }});
        const category = await Category.findById(id);
        if (existingCategory) {
            return res.render("editCategory", { message: "Category Already Exists",category });
        }
        const existingDescription = await Category.findOne({  description: { $regex: `^${description}$`, $options: "i" },_id: { $ne: id }});
        if (existingDescription) {
            return res.render("editCategory", { message: "Description Already Exists",category });
        }

        await Category.findByIdAndUpdate(id, {
            name,
            description,
            categoryOffer: categoryOffer || 0,
            isActive: isActive === "active", 
            isVisible: isVisible === "listed" 
        });
        res.redirect("/admin/category");
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
};



module.exports = {
    categoryInfo,
    addCategory,
    deleteCategory,
    gotoEditCategory,
    editCategory,
}