const Coupon = require('../../models/couponSchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');


const loadCoupon = async (req, res) => {
    try {
        const userId = req.session.user.id;
        const coupons = await Coupon.find({ userId: { $ne: userId },isActive:true});
        const currentDate = new Date();

        res.render('showCoupons', { coupons ,currentDate});
    } catch (error) {
        console.error("Error loading coupons:", error);
        res.status(500).send("An error occurred while loading coupons.");
    }
};

const applyCoupon = async (req, res) => {
    const { couponCode } = req.body;
    const userId = req.session.user.id;
    const cart = await Cart.findOne({ userId: userId }).populate({
        path: "items.productId",
        populate: {
            path: 'category',         
            model: 'Category',
        },
      });
      const totalAmount = cart.items.reduce((total, item) => {
        const price = item.productId.price * item.quantity; 
        const offerDiscount = (price * item.productId.category.categoryOffer) / 100;  
        return total + price - offerDiscount; 
    }, 0);
    
    const coupon = await Coupon.findOne({ couponCode: couponCode });
    if (!coupon) {
        return res.json({ success: false, message: "Coupon does not exist" });
    }
    if (coupon.userId.includes(userId)) {
        return res.json({ success: false, message: "Coupon Already used"  });
    }

    if (totalAmount < coupon.minimumPrice) {
        return res.json({
            success: false,
            message: `Your total must be at least ${coupon.minimumPrice} to apply this coupon.`
        });
    }
    const discountAmount =
        coupon.discountType === "percentage"
            ? (totalAmount * coupon.discountValue) / 100
            : coupon.discountValue;
    cart.couponDiscount=discountAmount;
    newTotal = totalAmount-discountAmount;

    //add userId to coupon to indicate used once
    coupon.userId.push(userId);
    await coupon.save();
    await cart.save()

    res.json({ success: true, message: 'Coupon applied successfully.',couponDiscount: cart.couponDiscount.toFixed(2),newTotal:newTotal.toFixed(2) });
};

const removeCoupon = async (req, res) => {
        const { couponCode } = req.body;
        const userId = req.session.user.id;
        const coupon = await Coupon.findOne({ couponCode: couponCode });
        if (!coupon) {
            return res.status(404).json({ success: false, message: "Coupon not found or not used by the user." });
        }

        const cart = await Cart.findOne({ userId: userId }).populate({
            path: "items.productId",
            populate: {
                path: 'category',         
                model: 'Category',
            },
          });

          const totalAmount = cart.items.reduce((total, item) => {
            const price = item.productId.price * item.quantity; 
            const offerDiscount = (price * item.productId.category.categoryOffer) / 100;  
            return total + price - offerDiscount;  
        }, 0);
        
        await Cart.updateOne(
            {_id:cart._id},
            {couponDiscount:0}
        );
        await Coupon.updateOne(
            { _id: coupon._id },
            { $pull: { userId: userId } }
        );

        res.json({ success: true, message: "Coupon removed successfully.",newTotal : totalAmount.toFixed(2)
        });
};


module.exports = {
    loadCoupon,
    applyCoupon,
    removeCoupon
}