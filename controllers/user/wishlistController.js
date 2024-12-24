const Product = require('../../models/productSchema')
const Wishlist = require('../../models/wishlistSchema');
const User = require('../../models/userSchema');
const Cart = require('../../models/cartSchema');
  

const wishlistLoad = async (req, res) => {
    try {
      const userId = req.session.user.id;
      const user = await User.findOne({ _id: userId });
  
      if (user) {
        const wishlist = await Wishlist.findOne({ userId: userId }).populate({
          path: "items.productId",
        });
        if (wishlist) {
          res.render("wishlist", {
            wishlist: wishlist,
            userDetails: user,
          });
        } else {
          res.render("wishlist", {
            wishlist: "",
            userDetails: "",
            message: "Wishlist is empty",
          });
        }
      } else {
        res.status(400).json({ message: "User not found" });
      }
    } catch (error) {
      console.log("error loading wishlist :" + error);
      res.status(500).json({ message: "Internal server error" });
    }
  };


  const addToWishlist = async (req, res) => {
    const { productId} = req.query;
    const userId = req.session.user.id;
    try {
        const product = await Product.findById(productId);
        if (!product) {
            req.flash('error_msg', 'Product not found.');
            return res.redirect(`/eachProduct?id=${productId}`);
        }

        let wishlist = await Wishlist.findOne({ userId });

        console.log("check 1");
        
        if (wishlist) {
            const itemIndex = wishlist.items.findIndex(
                (item) => item.productId.toString() === productId
            );
        
            if (itemIndex > -1) {
                req.flash('error_msg', 'Item already added to wishlist.');
                return res.redirect(`/eachProduct?id=${productId}`);
            } else {
                wishlist.items.push({ productId });
            }
        } else {
            wishlist = new Wishlist({
                userId,
                items: [{ productId }],
            });
        }        
        await wishlist.save();
        console.log(wishlist);
        req.flash('success_msg', 'Product added to wishlist successfully.');
        return res.redirect(`/eachProduct?id=${productId}`);
    } catch (error) {
        console.error('Error adding product to wishlist:', error);
        req.flash('error_msg', 'Internal server error.');
        return res.redirect(`/eachProduct?id=${productId}`);
    }
};



const removeWishlist = async (req, res) => {
  try {
      const { id } = req.params; 
      const userId = req.session.user.id;
      const wishlist = await Wishlist.findOne({ userId });
      if (!wishlist) {
          req.flash('error_msg', 'Wishlist not found.');
          return res.redirect('/wishlist');
      }
      
      const itemIndex = wishlist.items.findIndex((item) => item._id.toString() === id);
      if (itemIndex === -1) {
          req.flash('error_msg', 'Item not found in wishlist.');
          return res.redirect('/wishlist');
      }
      const product = await Product.findById(wishlist.items[itemIndex].productId);
      if (!product) {
          req.flash('error_msg', 'Product not found.');
          return res.redirect('/wishlist');
      }

      wishlist.items.splice(itemIndex, 1);
      await wishlist.save();

      req.flash('success_msg', 'Item removed from wishlist successfully.');
      return res.redirect('/wishlist');
  } catch (error) {
      console.error('Error removing item from wishlist:', error);
      req.flash('error_msg', 'Internal server error.');
      return res.redirect('/wishlist');
  }
};

const addToCart = async (req, res) => {
  try {
    const productId = req.params.id;
    const userId = req.session.user.id; 

    const wishlistItem = await Wishlist.findOne({ userId, "items.productId": productId });
    if (!wishlistItem) {
      req.flash("error_msg", "Product not found in wishlist.");
      return res.redirect("/wishlist");
    }

    const cart = await Cart.findOne({ userId });
    if (cart) {
      const productInCart = cart.items.find(item => item.productId.toString() === productId);
      if (productInCart) {
        productInCart.quantity += 1; 
      } else {
        cart.items.push({ productId, quantity: 1 });
      }
      await cart.save();
    } else {

      await Cart.create({ userId, items: [{ productId, quantity: 1 }] });
    }

    await Wishlist.updateOne(
      { userId },
      { $pull: { items: { productId } } }
    );

    req.flash("success_msg", "Product added to cart successfully.");
    res.redirect("/wishlist");
  } catch (error) {
    console.error("Error in addToCart:", error);
    req.flash("error_msg", "Something went wrong. Please try again.");
    res.redirect("/wishlist");
  }
};


  module.exports = {
    wishlistLoad,
    addToWishlist,
    removeWishlist,
    addToCart
  }