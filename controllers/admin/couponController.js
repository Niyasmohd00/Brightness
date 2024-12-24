const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');


const couponLoad =async (req,res)=>{
    try {
        let page = parseInt(req.query.page) || 1;
        const limit = 20;

        const coupons = await Coupon.find()
            .populate('userId', 'name email') 
            .sort({ updatedAt: -1 })
            .limit(limit)
            .skip((page - 1) * limit)
            .exec();

        const totalCoupons = await Coupon.countDocuments();
        const totalPages = Math.ceil(totalCoupons / limit);

        res.render('coupons', {
            coupons,
            totalCoupons,
            currentPage: page,
            totalPages
        });
    } catch (error) {
        console.error('Error fetching orders:', error);
        res.status(500).send('Internal Server Error');
    }
};

const getAddCoupon = async (req,res)=>{
    try {
        res.render('addCoupon')
    } catch (error) {
        console.log(error)
        res.send("Server Error",)
    }
}

const addCoupon = async (req, res) => {
    const { couponCode, discountValue, discountType, minimumPrice, expiryDate } = req.body;
    try {
        console.log(expiryDate);
        const existingCoupon = await Coupon.findOne({ couponCode });
        if (existingCoupon) {
            return res.render('addCoupon', {
                message: 'Coupon code already exists. Please choose another.',
            });
        }
        const expirationDate = new Date(expiryDate);
        const currentDate = new Date();
        if (expirationDate <= currentDate) {
            return res.render('addCoupon', {
                message: 'Expire date must be in the future.',
            });
        }

        const newCoupon = new Coupon({
            couponCode,
            discountValue,
            discountType,
            minimumPrice,
            expiryDate
        });
        await newCoupon.save();
        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(error);
        res.render('addCoupon', {
            message: 'An error occurred while saving the coupon. Please try again.',
        });
    }
};
const updateStatus = async (req, res) => {
    const { id } = req.params;
    const { isActive } = req.body;
    try {
        await Coupon.findByIdAndUpdate(id, { isActive });
        res.json({ success: true });
    } catch (error) {
        console.error("Error updating coupon status:", error);
        res.json({ success: false });
    }
}
const getEditCoupon = async (req,res)=>{
    const { id } = req.params;
    try {
        const coupon = await Coupon.findById(id);
        if (!coupon) {
            return res.status(404).json({ error: "Category not found" });
        }
        res.render('editCoupon', { coupon });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal Server Error" });
    }
}
const editCoupon = async (req, res) => {
    const { id } = req.params;
    const { couponCode, discountValue, discountType, minimumPrice, expiryDate } = req.body;
    try {
        const existingCoupon = await Coupon.findOne({ couponCode,_id: { $ne: id }});
        const coupon = await Coupon.findById(id);
        if (existingCoupon) {
            return res.render('editCoupon', {
                message: 'Coupon code already exists. Please choose another.',coupon
            });
        }
        const expirationDate = new Date(expiryDate);
        const currentDate = new Date();
        if (expirationDate <= currentDate) {
            return res.render('editCoupon', {
                message: 'Expire date must be in the future.',coupon
            });
        }
       
        await Coupon.findByIdAndUpdate(id,{
            couponCode,
            discountValue,
            discountType,
            minimumPrice,
            expiryDate
        });

        res.redirect('/admin/coupons');
    } catch (error) {
        console.error(error);
        res.render('editCoupon', {
            message: 'An error occurred while saving the coupon. Please try again.',coupon
        });
    }
};

const deleteCoupon = async (req, res) => {
    try {
        const couponId = req.params.id;
        const deletedCoupon = await Coupon.findByIdAndDelete(couponId);
        if (!deletedCoupon) {
            return res.status(404).json({ success: false, message: 'Coupon not found' });
        }
        res.status(200).json({ success: true, message: 'Coupon deleted successfully' });
    } catch (error) {
        console.error('Error deleting coupon:', error);
        res.status(500).json({ success: false, message: 'Server error occurred' });
    }
};


module.exports = {
    couponLoad,
    getAddCoupon,
    addCoupon,
    updateStatus,
    getEditCoupon,
    editCoupon,
    deleteCoupon
}